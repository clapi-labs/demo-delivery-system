# PLAN — Pedidos por llamada (agente de voz → portal)

> **Estado: ejecutado (2026-09-27).** Este documento se deja como el plan con
> el que se construyó. Lo que quedó hecho está en `STATUS.md` § Fase 8 y en
> ADR-13; el repo de voz lo documenta en su `docs/ARQUITECTURA.md`.
>
> **Dónde difiere lo construido del plan** (y por qué):
>
> - **Los productos se identifican por SKU, no por id numérico.** Es lo que el
>   catálogo ya devolvía y lo que el agente ve en su prompt.
> - **`buildOrderLines` no devuelve un `ok: true | false`**, sino las líneas
>   que sí se armaron *más* las listas de rechazos. El menú las ignora, la voz
>   falla con ellas. Con un discriminado, el menú habría tenido que fingir que
>   nunca falla.
> - **Exigir los grupos obligatorios es opcional** (`requireOptionGroups`). El
>   menú **no puede** exigirlos: el link `?add=SKU:2` que manda el bot no trae
>   opciones, y rechazarlo dejaría al cliente con un carrito vacío sin saber
>   por qué.
> - **El plazo de la página es uno solo de 12 s**, no 8 s para el agente. Con
>   8 s medidos desde después de conectar, un `LIVEKIT_URL` muerto dejaba la
>   pantalla congelada igual: el reloj tiene que arrancar en el clic.
> - **`web/main.py` no importa `brasa/`**: se construye con `web/` como
>   contexto en Railway. Repite seis líneas de un GET en vez de acoplar los dos
>   contextos de build.
> - **Se agregó `scripts/verify_contrato.py`** en el repo de voz, para el
>   `AGENT_NAME` y los demás fallos silenciosos.
>
> Toca **dos repos**: este (rama `llamadas`) y `demo-voice-agent`
> (rama `brasa-y-pan`).

---

## 1. Qué se quiere

Hay un agente de voz en LiveKit (`demo-voice-agent`, rama `pedidos`) que ya
toma pedidos hablando: una página web en Railway donde se da clic y la
conversación arranca. Hoy guarda esos pedidos en **su propia base de datos**
(`chicken_store`, 4 productos de pollo) y ahí se quedan.

Lo que hace falta: **que un pedido cerrado por llamada aterrice en el portal
de Brasa & Pan**, con su comanda, su cronómetro, su repartidor y su aviso al
cliente — igual que uno que entró por el menú. Y que, si algo falla, el
cliente no se quede colgado: que se le diga que el servicio está caído y que
escriba por WhatsApp.

### Las tres cosas que hay que resolver

| | Problema | Decisión |
|---|---|---|
| **Catálogo** | El agente vende 4 productos de pollo de su propia base; Brasa & Pan tiene 25 productos con personalizaciones y promociones en Neon | El agente **deja de tener base de datos** y lee el catálogo de este sistema por HTTP |
| **Destino del pedido** | El agente escribe en su Postgres | Llama a un endpoint interno de este sistema, que crea el pedido con los precios resueltos contra la base (RN-02) |
| **Cuando falla** | Hoy no hay respaldo: si algo se cae, la llamada se pierde | Tres niveles de respaldo, todos terminando en "escríbenos por WhatsApp" (§7) |

---

## 2. Esto reabre ADR-02, y hay que decirlo en voz alta

**ADR-02 dice que un pedido no puede nacer de una conversación.** RN-03 lo
repite: «un pedido sin `source = "menu"` y sin canjear no se registra jamás».
`bot/order-guard.ts` lo hace cumplir en código.

Un pedido por llamada es, literalmente, un pedido nacido de una conversación.
**No se puede implementar esto sin reabrir esa decisión**, así que el paso 1
de la ejecución es escribir **ADR-13** con este razonamiento:

**Por qué ADR-02 existe:** en un chat de texto, el modelo interpreta lo que el
cliente escribe y puede equivocarse en el producto o en el precio sin que
nadie lo note; el menú es la única fuente confiable de qué se pidió y cuánto
vale. En un chat, además, mandar el menú es gratis: es un link.

**Por qué la voz es un caso distinto, no una excepción por conveniencia:**

1. **El modelo nunca dice un precio ni arma un pedido.** Pasa `product_id` y
   `quantity`; el precio, las promociones y el total los calcula este sistema
   contra la base, con `priceLine()` — la misma función que usa el carrito del
   menú. Es exactamente la protección que ADR-02 buscaba, aplicada un nivel
   más abajo.
2. **Hay un paso de confirmación que el chat no tiene.** El agente lee el
   pedido completo en voz alta y espera un "sí" explícito antes de cerrarlo
   (ya está así en la rama `pedidos`). Un chat de WhatsApp nunca tuvo eso.
3. **En una llamada no hay menú que mandar.** Negarse a tomar el pedido no
   protege al cliente: lo pierde.

**Qué NO cambia:** el candado del chat de WhatsApp se queda tal cual. Un
pedido por chat sigue siendo imposible. La excepción se limita a un canal
donde el pedido lo construye el sistema, y queda **auditable en la base**:
`orders.source = "call"`.

> Si al leer esto el dueño del producto no está de acuerdo, **el plan se
> detiene acá**: lo demás depende de esta decisión.

---

## 3. La arquitectura

```
Navegador (página de Railway)
    │  clic en "Llamar"
    ▼
web/main.py (FastAPI)  ── GET /api/estado ──►  delivery-system  (¿está arriba?)
    │  token con RoomAgentDispatch(agent_name="agente-brasa")
    ▼
LiveKit Cloud ──► agent.py (worker)
    │                 instructions = prompt + catálogo REAL de Brasa & Pan
    │                 tools: search_products, add_item_to_order,
    │                        set_item_quantity, vaciar_pedido,
    │                        confirm_order, finalizar_llamada
    │
    ├── GET  /api/internal/catalog      (una vez al arrancar la sesión)
    └── POST /api/internal/voice-order  (al cerrar el pedido)
            │
            ▼
      apps/menu (Next.js)  ── precios con priceLine() ──►  Neon
            │                   orders (source="call", status="pending")
            │                   order_items (con selectedOptions)
            ▼
      Portal: la comanda aparece en "Nuevos" con su badge 📞
            └─► de ahí sigue el camino normal: asignar repartidor,
                cambiar estado, aviso al cliente por WhatsApp
```

**El agente de voz no toca Neon directamente.** Dos razones: una es que
duplicaría la resolución de precios (y con ella RN-02 y RN-10 dejarían de
estar en un solo sitio); la otra es que un repo en Python con las credenciales
de la base de producción es una superficie que no hace falta abrir — le basta
un `INTERNAL_SECRET` y dos endpoints.

### Lo que se descartó

| Alternativa | Por qué no |
|---|---|
| Que el agente escriba en Neon con SQL propio | Dos repos escribiendo las mismas tablas, la lógica de precios duplicada y ninguna idempotencia. Es justo lo que este sistema evita con `/api/internal/*` |
| Copiar el catálogo de Brasa & Pan a la base del agente | Dos catálogos que se desincronizan: marcar "agotado" en el portal no llegaría a la llamada y el bot seguiría vendiendo lo que no hay |
| Que el pedido entre como `draft` y se canjee con un código | El código existe para que el pedido vuelva del navegador al chat. En una llamada no hay nada que canjear: el cliente ya confirmó hablando |
| Meter el endpoint en `apps/portal` | La resolución de precios y el catálogo viven en `apps/menu`. El portal **lee** pedidos, no los crea |

---

## 4. Paso a paso en este repo (`demo-delivery-system`)

> Ramificar desde `main` **con `domicilios` ya mergeado**: el paso 4.5 toca
> `OrderTicket.tsx`, que esa rama reescribió. Rama sugerida: `voz`.

### 4.1 Esquema: de dónde vino el pedido

`packages/shared/src/db/schema.ts`, tabla `orders`:

- `source` ya existe (`notNull().default("menu")`). Se agrega el valor
  `"call"` como tipo: `text("source").notNull().$type<OrderSource>()` con
  `OrderSource = "menu" | "call"` en `domain/order-status.ts`.
- **Nueva columna `sourceRef: text("source_ref")`**, con índice único parcial.
  Es la clave de idempotencia: el `room_name` de LiveKit (`brasa-xxxxxx`),
  único por llamada. Si el modelo invoca `confirm_order` dos veces —pasa— el
  segundo `INSERT` choca contra el índice y el endpoint devuelve **el mismo
  pedido** en vez de crear un duplicado. Que lo garantice la base y no el
  código, igual que `deliveries_order_idx`.

`npm run db:push`. Es aditivo: no rompe nada de lo que ya corre.

### 4.2 Sacar el armado de líneas a `packages/shared`

Hoy vive dentro de `apps/menu/src/app/api/orders/route.ts` (líneas ~85-145):
resolver el producto por SKU, aplicar `priceLine()` con las promociones del
instante, congelar el nombre con la promo, armar `selectedOptions`.

Se extrae a `packages/shared/src/domain/order-lines.ts`:

```ts
export type RawLine = { sku: string; optionIds: number[]; quantity: number };
export type BuiltLine = { productId, nameSnapshot, unitPrice, quantity,
                          selectedOptions, lineTotal };
export type BuildResult =
  | { ok: true; lines: BuiltLine[]; subtotal: number }
  | { ok: false; unavailable: string[]; unknown: string[] };

export function buildOrderLines(
  catalog, promotions, raw: RawLine[], now: Date,
): BuildResult
```

**La diferencia que importa entre el menú y la voz:** el menú, si un producto
ya no está disponible, lo **descarta en silencio** y sigue (el cliente lo ve
en pantalla). En una llamada eso es inaceptable — el cliente pidió tres cosas
y le llegarían dos sin que nadie se enterara. Por eso `buildOrderLines`
devuelve la lista de lo que no se pudo y **el endpoint de voz falla entero**
con esa lista, para que el agente se lo diga: «se me acabó la cerveza, ¿te la
quito o cambiamos por otra?».

El endpoint del menú se refactoriza para usar la misma función y conservar su
comportamiento actual (descartar y seguir). Cubierto por
`npm run verify:menu-order` (19/19) y `verify:promotions`, que tienen que
seguir pasando sin tocarlos.

### 4.3 `GET /api/internal/catalog` (en `apps/menu`)

Protegido con `INTERNAL_SECRET`. Devuelve el catálogo tal como lo necesita una
conversación hablada, **con el precio de hoy ya resuelto**:

```json
{
  "business": { "name": "Brasa & Pan", "deliveryFee": 5000,
                "deliveryTime": "30 a 45 minutos", "minOrder": 20000,
                "whatsappNumber": "57..." },
  "categories": [
    { "slug": "hamburguesas", "name": "Hamburguesas",
      "products": [
        { "id": 12, "sku": "BURG-DOBLE", "name": "Doble Tocineta",
          "description": "…", "price": 26000, "priceNow": 20800,
          "promotion": "Hora feliz de hamburguesas", "available": true,
          "optionGroups": [
            { "id": 4, "name": "Término de la carne", "required": true,
              "type": "single",
              "options": [{ "id": 9, "name": "Tres cuartos", "priceDelta": 0 }] }
          ] } ] } ]
}
```

- `priceNow` sale de `priceLine()` en el servidor: **el agente nunca calcula
  una promoción**, solo lee el precio que le dan. Es RN-02 y RN-10 aplicadas a
  la voz.
- Los agotados van con `available: false` y el prompt le dice al agente que no
  los ofrezca. Se mandan igual para que, si el cliente los pide, pueda decir
  "hoy no hay" en vez de "no existe".
- `optionGroups` solo con lo necesario para preguntar: el agente pregunta
  **únicamente los `required`** (el término de la carne), nunca los opcionales
  — 25 productos × extras opcionales en una llamada es una tortura.

### 4.4 `POST /api/internal/voice-order` (en `apps/menu`)

El corazón de la conexión. Protegido con `INTERNAL_SECRET`.

```json
{
  "callId": "brasa-a1b2c3",
  "customerName": "Jose David",
  "phone": "573116426370",
  "address": "Cra 119A #60B-75, apto 902 torre 4",
  "addressNotes": "Portón verde",
  "paymentMethod": "efectivo",
  "items": [{ "sku": "BURG-DOBLE", "optionIds": [9], "quantity": 2 }]
}
```

Qué hace, en orden:

1. Valida el secreto y el cuerpo. `phone` se normaliza a dígitos y **puede ir
   vacío**: una llamada web no trae número (§6.4).
2. `buildOrderLines(...)`. Si algo no está disponible → **422** con
   `{ unavailable: ["Cerveza Nacional"] }`. No crea nada.
3. Inserta el pedido con `source: "call"`, `sourceRef: callId`,
   **`status: "pending"`** (entra directo a la cocina: no hay nada que
   canjear) y `redeemedAt: now` para que quede explícito que no está a medias.
4. Si `sourceRef` ya existía → devuelve ese pedido con `duplicated: true`.
   Idempotencia, no error.
5. Encola el aviso al cliente en el outbox (`enqueueOrderNotification`) con un
   texto nuevo: «Recibimos tu pedido *CÓDIGO* por teléfono…». Si ese número
   nunca le escribió al bot, `enqueueOrderNotification` devuelve `false` y no
   pasa nada — degradación ya existente, no hay que inventar nada.
6. Responde `201` con `{ code, total, subtotal, deliveryFee, eta, duplicated }`.

**El agente lee el total de esta respuesta, no el que sumó.** Si una promoción
se venció en medio de la llamada, el número que se le dice al cliente es el
que quedó guardado.

### 4.5 Que el portal diga de dónde viene

- `PortalOrder` gana `source`. En la comanda, un badge junto al código:
  **📞 Por llamada** (usar `PhoneIcon`, tono `st-sent-soft`). Un pedido por
  teléfono se atiende distinto —el cliente no está en WhatsApp— y la cocina
  tiene que verlo de un golpe.
- En Inicio, la tarjeta de Pedidos puede desglosar `menú / llamada`. Opcional;
  bonito para el video.
- `paymentLabel` ya cubre el caso de "sin confirmar", así que no hay que
  tocarlo.

### 4.6 Documentos y verificación

- **ADR-13** en `DECISIONS.md` (§2 de este plan).
- `REQUIREMENTS.md`: Fase 8 · Pedidos por llamada, RF-56 a RF-60.
- `RN-14`: «un pedido por llamada lo construye el sistema, no el modelo: el
  modelo solo pasa ids y cantidades».
- `ARCHITECTURE.md`: los dos endpoints nuevos en la tabla de internos.
- `.env.example`: nada nuevo de este lado (reusa `INTERNAL_SECRET`).
- **`npm run verify:voice-order`** (script nuevo, contra Neon real, con el
  patrón de `verify-menu-order.ts`): pedido normal crea comanda `pending` con
  `source="call"`; el mismo `callId` dos veces no duplica; un producto agotado
  devuelve 422 y **no** crea nada; las promociones se aplican al total; un
  secreto inválido da 401; un carrito vacío da 400.

---

## 5. Paso a paso en `demo-voice-agent`

### 5.1 La rama

```bash
git fetch origin
git checkout -b brasa-y-pan origin/pedidos
```

Desde `pedidos`, no desde `main`: `pedidos` es la que tiene la interfaz web,
el cierre de llamada corregido, el ambiente de sala y las mejoras de
naturalidad. `main` no.

### 5.2 Fuera la base de datos propia

Es el cambio más grande de la rama, y es una **resta**:

- Se borra `database/`, `docker-compose.yml` y el `schema.sql` de pollo.
- Se agrega `brasa/api.py`: un cliente HTTP (`httpx.AsyncClient`) con
  `get_catalog()` y `confirm_order(...)`, apuntando a `DELIVERY_API_URL` con
  `Authorization: Bearer $INTERNAL_SECRET`.
- Timeouts explícitos (5 s para el catálogo, 10 s para confirmar) y **dos
  reintentos con backoff** solo en `confirm_order`: es la llamada que no se
  puede perder.

El catálogo se pide **una sola vez al arrancar la sesión** y se guarda en
`userdata`, igual que hoy hace `build_menu_prompt_block()`. Un catálogo de 25
productos entra sin problema en las `instructions`.

### 5.3 Las tools, con los mismos contratos

Se conservan los seis nombres y la forma de las respuestas
(`{"success": bool, "message": str}`), porque el prompt y el flujo ya están
afinados alrededor de eso. Lo que cambia por dentro:

| Tool | Cambio |
|---|---|
| `search_products` | Ya no hace SQL con `pg_trgm`: busca en memoria sobre el catálogo cacheado (nombre, descripción, categoría) con `difflib.get_close_matches`. Con el menú completo en el prompt, esta tool es el respaldo para lo ambiguo, no el camino principal |
| `add_item_to_order` | Valida `available` en vez de `stock` (Brasa & Pan no lleva inventario, lleva disponible/agotado). Gana un parámetro `option_ids: list[int]` y **rechaza el ítem si falta un grupo `required`**, con un mensaje que le dice al agente qué preguntar: «falta el término de la carne» |
| `set_item_quantity` | Igual, sin la revalidación de stock |
| `vaciar_pedido` | Sin cambios |
| `confirm_order` | Ya no escribe SQL: llama a `POST /api/internal/voice-order`. Gana `phone` y `payment_method` como parámetros obligatorios (§6.4). Devuelve el `code` y el `total` **del servidor** |
| `finalizar_llamada` | Hoy se niega a cerrar si `order_id` es `None`. Eso hay que ajustarlo: si `confirm_order` falló por caída del backend, el agente **tiene** que poder despedirse y colgar (§7.2). Nueva condición: cerrar si hay pedido confirmado **o** si ya se dio el mensaje de respaldo |

`ItemPedido` gana `option_ids` y `sku`; `PedidoEnCurso` gana `phone`,
`payment_method` y `call_id` (el `room_name`, que ya está disponible en el
`JobContext`).

### 5.4 El prompt de Brasa & Pan

`agent.py: Assistant.__init__`. Lo que cambia:

- El negocio: hamburguesería y asados, no pollo. Nombre del agente y saludo.
- `agent_name="agente-brasa"` (hoy `agente-pollo`) — y **el mismo cambio en
  `web/main.py`**, en `RoomAgentDispatch`. Si se cambia uno y no el otro, la
  sala queda vacía y el navegador se queda esperando, sin error visible. Es la
  trampa número uno de esta rama.
- Reglas nuevas en el prompt:
  - Preguntar el **término de la carne** cuando el producto lo exige, y nada
    más (los extras solo si el cliente los menciona).
  - Pedir **teléfono** y **forma de pago** (efectivo / transferencia /
    datáfono) antes de confirmar, además del nombre y la dirección que ya pide.
  - **Nunca decir un total que no venga de una tool.** Los precios ya vienen
    en el menú inyectado; el total final lo dice `confirm_order`.
  - Si el cliente pregunta por promociones, responder con el `promotion` que
    trae el catálogo, sin inventar condiciones.
- Los apellidos de `APELLIDOS_A_RECONOCER` se quedan: el problema de
  transcripción es el mismo.

### 5.5 La interfaz web

`web/static/index.html` y `web/main.py`:

- Textos y marca de Brasa & Pan (el diseño oscuro y minimal de `pedidos` se
  queda; no hay que rediseñar nada).
- `agent_name="agente-brasa"` en el dispatch.
- **`GET /api/estado`** nuevo: consulta `DELIVERY_API_URL/api/health` y
  responde `{ "ok": true|false }`. La página lo llama al cargar (§7.1).
- Un bloque de respaldo con el número real de WhatsApp, oculto por defecto.

---

## 6. Decisiones de producto que este plan toma

### 6.1 El pedido entra como "Nuevo", no como borrador
Un pedido por llamada ya está confirmado por el cliente en voz. Entra a la
cocina directo.

### 6.2 El agente pide la forma de pago
Una pregunta más en la llamada, y a cambio la comanda queda completa y la
ficha del repartidor puede decir «cobrar $35.000 en efectivo» (módulo de
domicilios, ADR-12). Sin esto, todo pedido por teléfono llega con "pago sin
confirmar" y alguien tiene que llamar de vuelta.

### 6.3 El agente pregunta solo los grupos obligatorios
Leer en voz alta los extras de 25 productos es insoportable. Los opcionales
se atienden si el cliente los menciona.

### 6.4 El teléfono se pregunta, no se adivina
Una llamada web no trae número (`customer_phone` queda `NULL` hoy). Se le
pregunta: «¿a qué número te confirmamos por WhatsApp?». Con eso:

- La comanda tiene a quién llamar si hay un problema con la dirección.
- El aviso de estado por WhatsApp **se intenta** — y solo llega si ese número
  ya le había escrito al bot (ventana de 24 h). Si no, el pedido igual está
  completo en el portal. Eso hay que decírselo al prospecto tal cual: no es
  una falla, es cómo funciona WhatsApp.

### 6.5 Lo que queda fuera
- **Telefonía real (SIP).** El código ya captura el número SIP y el
  `agent_name` está puesto para un dispatch rule, pero conectar un número
  colombiano es trámite con operador, no código. Cuando se haga, **nada de
  este plan cambia**: el teléfono llegaría solo y `confirm_order` no se toca.
- Transferir la llamada a una persona.
- Que el agente consulte el estado de un pedido anterior por voz.

---

## 7. El respaldo cuando algo falla

Tres niveles, en el orden en que el cliente los encontraría.

### 7.1 Antes de hablar: el servicio está caído
Al cargar la página, `GET /api/estado`. Si el sistema de pedidos no responde,
el botón de llamar queda deshabilitado y se muestra:

> **El pedido por llamada está fuera de servicio en este momento.**
> Escríbenos por WhatsApp y te atendemos ahí mismo. → [Abrir WhatsApp]

Mejor no dejar entrar a una llamada de cuatro minutos que no puede terminar en
un pedido.

### 7.2 Durante la llamada: se cayó al confirmar
`confirm_order` reintenta dos veces. Si sigue fallando, **no miente**:
devuelve `success: False` con un mensaje que el agente dice tal cual:

> «Se me cayó el sistema de pedidos y no quiero dejarte el pedido a medias.
> Escríbenos al WhatsApp 300 123 4567 y te lo tomamos ahí mismo con todo lo
> que me dijiste.»

Y además:

- Loguea el pedido completo como una línea estructurada
  (`[pedido-no-guardado] {...}`), para poder recuperarlo de los logs de
  Railway. En Railway el disco es efímero: una cola en archivo no sobrevive.
- `finalizar_llamada` **debe poder cerrar** en este camino (§5.3), o el agente
  se queda sin poder colgar, repitiendo el error.

### 7.3 Si LiveKit falla
Si `/api/token` falla, si la conexión WebRTC no se establece, o si **el agente
no entra a la sala en 8 segundos** (el caso silencioso: `agent_name` mal
puesto o el worker caído), la página muestra el mismo bloque de WhatsApp y
corta la llamada. Hoy eso se queda en "conectando…" para siempre.

---

## 8. Variables de entorno nuevas

En `demo-voice-agent` (Railway, los dos servicios):

| Variable | Para qué |
|---|---|
| `DELIVERY_API_URL` | La URL del menú de Brasa & Pan (`…-menu.vercel.app`) |
| `INTERNAL_SECRET` | **El mismo** valor que ya tienen las tres apps de este sistema |
| `BUSINESS_WHATSAPP_NUMBER` | El número del respaldo, para los tres niveles de §7 |

Las de LiveKit y `LLM_MODEL`/`STT_MODEL` se quedan como están. **Se van**
`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

De este lado no hace falta ninguna nueva.

---

## 9. Cómo se prueba, en orden

1. **El endpoint solo**, con `curl` y `INTERNAL_SECRET`: pedido normal,
   repetido con el mismo `callId`, con un producto agotado, con promoción
   activa. `npm run verify:voice-order`.
2. **El portal**: que la comanda aparezca en "Nuevos" con su badge 📞, con las
   opciones en el renglón y el total correcto.
3. **El agente por consola** (`uv run python agent.py console`): catálogo de
   Brasa & Pan cargado, un pedido completo de punta a punta, y la comanda
   apareciendo en el portal. Sin micrófono: la consola alcanza.
4. **La página web en local** (`web/`): una llamada real con micrófono, el
   pedido cerrado, y el portal.
5. **Los tres respaldos**, provocados a mano: bajar el endpoint
   (`DELIVERY_API_URL` a un puerto muerto) para §7.1 y §7.2, y cambiar
   `agent_name` a propósito para §7.3.
6. **Railway**: desplegar las dos piezas y repetir 4 y 5 contra producción.

---

## 10. Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| `agent_name` cambiado en un lado y no en el otro → sala vacía, sin error | El timeout de 8 s de §7.3 lo convierte en un mensaje claro. Y está escrito en §5.4 como la trampa principal |
| El modelo invoca `confirm_order` dos veces | `sourceRef` único en la base (§4.1) |
| Una promoción se vence en medio de la llamada | El total que se le dice al cliente es el de la respuesta del endpoint, no el que sumó el agente (§4.4) |
| El cliente dicta mal la dirección y nadie la valida | Igual que hoy en el chat: el agente la repite y espera confirmación. El portal la muestra tal cual y el repartidor tiene el teléfono |
| Dos llamadas simultáneas | `session.userdata` ya aísla el estado por llamada (está resuelto en `pedidos`) |
| El prospecto no entiende por qué el WhatsApp de confirmación a veces no llega | Decirlo antes: la ventana de 24 h de Meta no es negociable (§6.4) |

---

## 11. Orden de ejecución sugerido

1. ADR-13 (§2). **Si esto no se aprueba, nada más se hace.**
2. Este repo: esquema (§4.1) → `buildOrderLines` (§4.2) → los dos endpoints
   (§4.3, §4.4) → `verify:voice-order` → badge en el portal (§4.5) → docs.
   Se puede mergear solo: no rompe nada y queda listo para el agente.
3. Repo de voz: rama (§5.1) → cliente HTTP (§5.2) → tools (§5.3) → prompt
   (§5.4) → web y respaldos (§5.5, §7).
4. Pruebas 1 a 5 de §9, y despliegue.

El paso 2 y el 3 los puede hacer una sesión distinta cada uno: el contrato
entre los dos está escrito en §4.3 y §4.4.
