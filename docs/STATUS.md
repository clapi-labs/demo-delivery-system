# STATUS — Estado del proyecto

> La lectura más importante al empezar una sesión.

**Última actualización:** 2026-09-24

---

## Dónde estamos

**Fases 0 a 5 conectadas a Neon de punta a punta.** El portal ya no tiene
ninguna pantalla sobre datos de demostración: Pedidos, Conversaciones y el
Menú leen y escriben la base real. Lo determinista, el asesor con modelo
(RF-13) y el menú público (RF-20 a RF-27) funcionan contra APIs reales — Neon
y OpenAI.

Verificado con WhatsApp real, no solo contra la base: responder desde la
bandeja (RF-33 a RF-36) y los avisos de cambio de estado del pedido
(RF-30/31, tres mensajes entregados).

**El bloqueo de Meta se resolvió, pero distinto a lo planeado: número
compartido con Qanelo por rotación manual, no un número propio (ADR-11).**
El código ya tiene el candado (`BOT_ACTIVE`) y el webhook responde rápido
(`after()`); lo que falta es operativo, no de código: conseguir los cuatro
valores `WHATSAPP_*`, desplegar (Fase 6) para tener una URL real que darle a
la rotación, y coordinar el cambio. Ver la sección de más abajo.

Falta la transcripción de voz (RF-14, bloqueada por lo mismo hasta que haya
tráfico real de Meta), crear/editar productos desde el portal (necesita dónde
guardar la foto) y los comprobantes de pago (RF-37 a RF-39).

| Fase | Estado |
|---|---|
| 0 · Estructura | ✅ |
| 1 · Base de datos y catálogo | ✅ (Neon) |
| 2 · Canal de WhatsApp | ✅ código, verificado contra Neon; el candado de rotación (ADR-11) también verificado; falta desplegar y coordinar la rotación para la prueba en vivo |
| 3 · Motor del asistente | ✅ lo determinista y el asesor con modelo (OpenAI real); ⬜ la voz — falta `services/whatsapp/media.ts` + Whisper, y tráfico real de Meta para probarlo |
| 4 · Menú público | ✅ catálogo, carrito, personalización, envío del pedido y el endpoint interno del bot que lo recibe |
| 5 · Portal y bandeja | ✅ Pedidos, Conversaciones y Menú sobre Neon; outbox de avisos (RF-30/31) verificado con WhatsApp real; ⬜ crear/editar productos (falta almacenamiento de imágenes) y los comprobantes (RF-37 a RF-39) |
| 6 · Despliegue y video | ⬜ Ahora es el siguiente paso obligado: sin URL pública no hay a quién rotarle el webhook |

---

## El cambio de enfoque (2026-09-22)

Se abandonó la demo web autoservicio y se pasó a **WhatsApp real + video de
ventas**. La versión anterior está archivada en la rama `demo-web` (commit
`c65a67c`); lo reutilizable se migra por fases.

Lo que se conserva de aquella y resultó ser la mejor idea del proyecto: **la
bandeja de conversaciones vive dentro del portal**, en vez de espejar todo a
Chatwoot (ADR-04). Los mensajes ya están en nuestra base, el restaurante tiene
una sola pantalla y el control del bot queda al lado de los pedidos.

---

## Hecho en la Fase 1 — catálogo

- `packages/shared/src/db/queries/catalog.ts`: `getCatalog()`, la misma
  consulta para las tres apps.
- Catálogo semilla migrado de la demo anterior: 5 categorías, 25 productos,
  personalizaciones. Dos productos agotados a propósito.
- `npm run db:seed` carga el catálogo (reemplaza todo; no hay `demo_id`, es un
  solo restaurante).

**Verificado con `npm run verify:catalog` — 11/11** contra la base real: la
forma completa (categorías → productos → grupos → opciones), búsqueda con
tilde, productos agotados presentes pero marcados.

---

## Hecho en la Fase 2 — el canal

- **Normalización** (`services/whatsapp/normalize.ts`): convierte el payload
  de Meta en `IncomingMessage[]`, función pura. Reconoce texto, audio, imagen,
  botón; descarta `statuses`; no revienta con tipos desconocidos.
- **Idempotencia** (`db/queries/idempotency.ts`): `processed_messages` con
  `waMessageId` como clave primaria — el `INSERT` es la comprobación atómica,
  no un `SELECT` seguido de un `INSERT`.
- **Conversación** (`db/queries/conversation.ts`): registra el hilo, actualiza
  `lastInboundAt` en cada mensaje del cliente (el reloj de la ventana de 24 h)
  y `lastMessageAt` en cada mensaje de cualquier rol.
- **Cliente de envío** (`services/whatsapp/client.ts`): `sendText`,
  `sendButtons`, `sendCta`. Los tres comprueban la ventana de 24 h **antes**
  de llamar a la red — si está cerrada, no se intenta.
- El webhook (`app/api/webhook/whatsapp/route.ts`) ya queda armado de punta a
  punta: firma → normalizar → idempotencia → registrar → un acuse mínimo.
  **El acuse es temporal a propósito** — la Fase 3 lo reemplaza por el
  orquestador de verdad.

**Verificado con `npm run verify:channel` — 16/16** contra la base real:
normalización de los 5 tipos de mensaje, idempotencia (primera vez sí, segunda
no), conversación (creación, no duplica, actualiza el reloj correcto, conserva
el nombre si no llega uno nuevo).

---

## El número de WhatsApp ahora es compartido con Qanelo (2026-09-23, ADR-11)

Se resolvió el bloqueo de Meta, pero no como se esperaba: en vez de un número
propio, este bot va a rotar manualmente el número real de Qanelo
(`mixqanelo-sales-automate-system`) — nunca los dos activos a la vez. El
webhook que Meta conoce es fijo y no se toca; un nginx del lado de Qanelo
decide, con un interruptor manual, a cuál de los dos bots reenviar cada
entrega. Este proyecto no tiene ni tendrá acceso al panel de Meta.

Lo que cambió en el código:

- **`services/whatsapp/client.ts` tiene un candado nuevo, `BOT_ACTIVE`**
  (`checkActive()`), comprobado ANTES que la ventana de 24 h en `sendText`,
  `sendButtons` y `sendCta` — los tres, por separado, porque cada uno llama a
  `post()` de forma independiente. Por defecto **apagado**
  (`optional("BOT_ACTIVE", "false")`): hay que prenderlo a propósito. Es el
  único punto de todo el sistema por el que podría escaparse un mensaje al
  número compartido fuera de turno (un cron del outbox, un reintento en
  vuelo), así que el candado vive ahí y en ningún otro lado (RN-05).
- **El webhook responde 200 ANTES de procesar**, no después. Antes,
  `POST /api/webhook/whatsapp` esperaba a que terminara todo el procesamiento
  (incluida la llamada a OpenAI y el envío de la respuesta) para recién ahí
  acusar recibo — funcionaba, pero es exactamente el patrón que un partner
  externo señaló como riesgo real: si el procesamiento se demora, Meta
  reintenta por lentitud, no por error, y el reintento se procesa dos veces.
  Se resolvió con `after()` de Next.js: el `200 OK` sale de inmediato, y
  `processWebhook()` corre después, en segundo plano.
- **`/api/health` ahora también reporta `botActive`** — para que quien
  administra la rotación pueda comprobar el estado del candado sin tener
  acceso a las variables de Vercel.

Documentado en `docs/DECISIONS.md` (ADR-11), `docs/ARCHITECTURE.md`
(diagrama y tabla de degradación) y reescrito por completo
`docs/DEPLOYMENT.md` §2 — ya no dice "crear una app de Meta", dice a quién
pedirle las credenciales y qué hay que entregarle a cambio.

**Verificado con `npm run verify:bot-active` — 8/8**: con `BOT_ACTIVE` sin
poner o en `"false"`, los tres métodos de envío cortan en `bot_inactive` sin
tocar la red; con `"true"`, el candado se abre y el envío llega a intentarse
de verdad (contra una Graph API mockeada). Se tuvo que agregar
`BOT_ACTIVE="true"` a los scripts de verificación existentes que sí ejercitan
envíos (`verify:window`, `verify:orchestrator`, `verify:bot-menu-order`) — sin
eso, el candado nuevo los hacía fallar a todos, cortando antes de llegar a lo
que cada uno prueba de verdad.

**Todavía pendiente, del lado operativo (no de código):** conseguir los
cuatro valores `WHATSAPP_*` de quien administra la app de Meta, desplegar
este bot para tener una URL pública real (Fase 6), entregar esa URL más las
dos comprobaciones (`curl` del challenge y del rechazo de firma inválida —
ver `docs/DEPLOYMENT.md` §2.2), y solo entonces coordinar: primero
`BOT_ACTIVE="true"` en Vercel, después el `rotar-webhook.sh` del lado de
Qanelo. Nunca al revés.

**Verificado con `npm run verify:window` — 4/4**: el cliente de envío corta
**antes** de llamar a `fetch` cuando no hay conversación previa o cuando el
último mensaje fue hace más de 24 h. Se probó envolviendo `global.fetch` para
comprobar que de verdad nunca se llama — no solo que el resultado sea el
esperado.

**Lo que NO se pudo probar sin credenciales:** el envío real a la Graph API
(`sendText`/`sendButtons`/`sendCta` con la ventana abierta). Eso es la Fase 2
en vivo — se prueba en cuanto lleguen los datos de Meta (docs/DEPLOYMENT.md
§2), escribiéndole al número desde un celular.

---

## Hecho en la Fase 3 — el motor

Migrado y adaptado de la demo anterior (`messages.ts`, `intent.ts` son casi
1:1; `menu-link.ts` y `engine.ts` cambian para usar teléfono + token firmado
en vez de sesión + `demo_id`):

- **`bot/messages.ts`** — todo el texto del cliente, con los mensajes nuevos
  que exige el canal real: comprobante de pago, degradación de audio/imagen,
  tope de mensajes.
- **`bot/intent.ts`** — los detectores deterministas, sin cambios de lógica.
- **`bot/menu-link.ts`** — el link ahora lleva el **token firmado** (ADR-05)
  en vez de una sesión, y apunta a la URL absoluta de `apps/menu` (son
  despliegues distintos).
- **`bot/order-guard.ts`** — el candado (`assertMenuOrder`), separado del
  motor en su propio archivo.
- **`bot/engine.ts`** — la máquina de estados: canje → dirección → pago →
  cierre. Efectivo y transferencia cierran igual (`status = pending`); leer el
  comprobante es explícitamente Fase 5, y se documentó por qué no hace falta
  un estado de conversación intermedio para eso.
- **`bot/orchestrator.ts`** — las 11 puertas, en orden: reiniciar, pausado,
  fuera de horario, tope de mensajes, audio/imagen (degradado), pedido en
  curso, código a mano, ayuda/escalamiento, rutas fijas, saludo, asesor.
  También decide **qué tipo de mensaje mandar** (texto, botones o CTA) según
  la forma de la respuesta — un solo lugar, no una decisión repetida en cada
  ruta.
- El webhook ya no tiene ningún acuse propio: delega el 100% a
  `orchestrator.handleIncoming()`. Solo entiende protocolo de Meta.
- `db/queries/orders.ts` y `db/queries/conversation.ts` completos (antes
  stubs): historial, conteo de mensajes recientes, canje atómico.

**El asesor real (RF-13) ya está conectado.** Se construyeron
`services/openai/chat.ts` (tool calling contra la API real, degrada a `null`
si falla) y `bot/advisor.ts` (el modelo solo extrae qué nombró el cliente; el
catálogo resuelve precio y stock — ADR-08/ADR-09), y `orchestrator.ts` llama a
`runAdvisor()` en vez del mensaje fijo de degradación. **Verificado con
`npm run verify:advisor` — 9/9** contra OpenAI real (no un doble): precio
correcto, no inventa uno distinto, dice "no manejamos X" solo cuando el
catálogo lo confirma, producto agotado sin ofrecer sustituto, escala a persona
cuando corresponde, charla simple sin forzar el menú. Corrido tres veces
seguidas para confirmar estabilidad frente a la no-determinismo del modelo.

**La transcripción de voz (RF-14) sigue con el enchufe listo pero sin
conectar** — falta `services/whatsapp/media.ts` (descarga en dos pasos) y
`services/openai/transcribe.ts` (Whisper); hoy todo `kind: "audio"` degrada
con gracia a un mensaje fijo (RF-17).

**Verificado con `npm run verify:orchestrator` — 24/24** contra Neon (la base
real), con `fetch` reemplazado por un doble solo para Meta y OpenAI (nunca
toca esas dos redes, nunca necesita credenciales reales de ninguna):

- El candado: sin canjear no pasa, canjeado sí, un código no se canjea dos
  veces (RN-01).
- El flujo completo por teléfono: saludo (CTA) → código → resumen (texto) →
  dirección inválida (repregunta) → dirección válida → botones de pago → pago
  por botón → confirmación (texto) → `status = pending`.
- Un código ya canjeado por otra conversación no reinicia el flujo.
- "reiniciar" funciona con el bot pausado y solo entonces (RF-19); pausado no
  manda **nada** más (RN-04).
- Audio e imagen degradan con gracia sin `OPENAI_API_KEY` (RF-14, RF-17).
- Qué tipo de envío corresponde a cada respuesta (CTA vs. botones vs. texto
  plano), inspeccionando el cuerpo real que se habría mandado a la Graph API.

**Dos bugs reales, los dos en el script de prueba, no en el producto** (ver
"Tropezones" abajo): códigos de pedido con dígitos fuera del alfabeto
permitido, y una aserción que esperaba texto plano donde el diseño
correctamente manda un botón.

---

## Hecho en la Fase 4 — el menú

El usuario pasó un prototipo de diseño (Lovable/TanStack Start, en
`prototipo_menu_app/`, fuera del repo): paleta oscura, tipografía Bebas
Neue/Barlow, fotos de stock por categoría. Se portó **la parte visual tal
cual** —colores, tipografía, layout, el hero, las fotos— a `apps/menu`
(Next.js), pero la lógica de datos NO se copió: el prototipo pedía nombre,
dirección y método de pago dentro del carrito, lo que rompe ADR-02 (un
pedido no puede armarse completo fuera de la máquina de estados del bot).
Confirmado con el usuario: el frontend debía verse igual, no comportarse
igual.

- **`packages/shared/src/domain/catalog.ts`** — `resolveOptions` y
  `unitPriceWithOptions`: de qué opciones existen de verdad en un producto y
  cuánto suma cada una. Los usan tanto el menú (vista previa del precio en el
  navegador) como `POST /api/orders` (el cálculo que de verdad cuenta,
  RN-02) — una sola función, no dos que se puedan desincronizar.
- **`apps/menu/src/components/menu/`** — `MenuApp` (el árbol interactivo:
  búsqueda, categorías con scrollspy, carrito), `ProductCard`,
  `ProductOptions` (la ficha de personalización — no existía en el
  prototipo, que no tenía productos con opciones), `CartPanel`, `use-cart`
  (persistencia en `localStorage`, RF-21).
- **A propósito, el carrito NO tiene paso de "tus datos".** Arma el pedido y
  lo manda; la dirección y el pago los sigue pidiendo el asistente por chat
  después de canjear el código (`apps/bot/src/bot/engine.ts`, ya construido
  en la Fase 3) — el menú no le quita ese trabajo.
- **`apps/menu/src/app/api/orders/route.ts`** — crea el pedido `draft`,
  **recalcula cada precio contra el catálogo** (RN-02: lo que manda el
  navegador son referencias, nunca cifras), y si el token es válido avisa al
  bot. Si el bot no confirma (o no hay token), el pedido queda creado igual
  para el respaldo `#PEDIDO <código>` (RF-27) — nunca revienta por eso.
- **`apps/bot/src/app/api/internal/menu-order/route.ts`** — el otro lado del
  contrato (RF-26): protegido con `INTERNAL_SECRET`, **vuelve a verificar el
  token él mismo** (ADR-05: no se confía en lo que diga el menú), y antes de
  canjear comprueba en orden que el negocio esté abierto, el asistente no
  esté pausado en esa conversación y la ventana de 24 h esté abierta —a
  diferencia del canje manual por chat, acá no hay un mensaje entrante que
  reabra la ventana sola, así que hay que comprobarlo a mano. `deliverReply`
  se exportó de `bot/orchestrator.ts` para que este endpoint entregue la
  respuesta sin pasar por `handleIncoming` (no hay mensaje entrante).

**Verificado con `npm run verify:menu-order` — 12/12** (`apps/menu/tsconfig.json`,
contra Neon, `fetch` mockeado solo para la llamada al bot): el precio se
recalcula e ignora lo que mande el cliente, las opciones eligen bien la
línea, sin token se crea igual para el respaldo, y un SKU inexistente o
agotado se descarta sin tumbar el pedido completo.

**Verificado con `npm run verify:bot-menu-order` — 12/12** (`apps/bot/tsconfig.json`,
contra Neon, `fetch` mockeado solo para `graph.facebook.com`): rechaza sin
`INTERNAL_SECRET`, 404 si el código no existe, token inválido no canjea ni
llama a Meta, pausado no canjea ni llama a Meta (RN-04), el camino feliz
canjea y avisa, y RN-01 (un código no se canjea dos veces) se sostiene
también por este camino.

---

## Hecho en la Fase 5 — el portal (frontend, datos de demostración)

El usuario pidió esta vez el diseño directamente (sin prototipo externo): un
portal "SaaS corporativo, sobrio" — sidebar oscuro, contenido claro, tablas y
listas en vez de tarjetas, sin gradientes ni glow. Pidió explícitamente **no**
construir un sistema empresarial: sin permisos, sin auditoría, sin reportes
financieros. Y pidió datos ficticios, no conexión real todavía — mismo
patrón por fases que ya se usó con el menú (frontend primero, conectar
después).

- **`apps/portal/src/lib/demo-data.ts`** — la única fuente de datos de esta
  vuelta. Los tipos siguen de cerca el esquema real a propósito
  (`OrderStatus` con los mismos cuatro valores que `schema.ts`, formas
  compatibles con `CatalogProduct`/`conversations`/`messages`): conectar a
  Neon después es cambiar de dónde viene el arreglo, no rediseñar la
  pantalla.
- **`components/Sidebar.tsx`** — Inicio, Pedidos, Conversaciones, Catálogo;
  Configuración y Usuario abajo, sin funcionalidad todavía (el usuario no
  pidió construirlas, solo que estuvieran en el sidebar).
- **`app/page.tsx` (Inicio)** — franja horizontal de métricas con
  separadores, no tarjetas (petición explícita), y una tabla compacta de
  pedidos recientes.
- **`app/pedidos/page.tsx`** — la pantalla más importante, tal como pidió el
  usuario. Tabs de filtro + búsqueda, lista de pedidos (cliente, productos,
  total, pago, estado), y un panel lateral (`components/Panel.tsx`, el mismo
  patrón de drawer que ya se usó en el menú) con el detalle completo y un
  botón grande que avanza el pedido al siguiente estado
  (`nuevo → preparación → enviado → entregado`).
- **`app/conversaciones/page.tsx`** — bandeja de solo lectura: lista de
  conversaciones a la izquierda, hilo a la derecha distinguiendo Cliente/Bot,
  indicador "Bot activo"/"WhatsApp conectado" y las métricas del bot que
  pidió el usuario (mensajes procesados, pedidos generados). **A propósito NO
  tiene cuadro de respuesta** — el usuario no lo pidió para esta vuelta y
  RF-33/RF-36 (responder pausa el bot, ventana cerrada bloquea el cuadro)
  quedan pendientes para cuando se conecte de verdad.
- **`app/catalogo/page.tsx`** — categorías como filtros, tabla de productos
  con Activar/Desactivar en un clic, y un panel para editar o crear producto
  (nombre, descripción, precio, categoría, disponible; la imagen queda como
  placeholder — subir archivos es Fase 6).

**No se corrió ningún script de verificación contra Neon para esta fase**:
es frontend puro sobre datos en memoria, no hay nada que verificar contra la
base todavía. Se comprobó con `npm run build`, `typecheck`, `lint` (los tres
limpios) y sirviendo el build con `next dev` para confirmar que las cuatro
rutas renderizan con los datos de ejemplo.

---

## Rediseño del portal (2026-09-23, rama `portal-redesign`)

El usuario pidió rehacer el portal pensando en el celular, con esta
prioridad: pedidos, conversaciones, diseño general/Inicio, menú. Pidió
explícitamente **solo frontend** en conversaciones y menú ("la lógica real de
conexión, pausa del bot, envío de mensajes, etc., la conectaré yo después") y
trabajar en una rama aparte, sin tocar `main`.

- **Diseño** (segunda vuelta, sobre un brief de UI/UX del usuario). Una sola
  tipografía, Geist, con títulos a -0.02em (se quitó la condensada). Neutros
  zinc: riel zinc-900, contenido zinc-100, tarjetas blancas con sombra corta
  y anillo de 1px (`card` en `globals.css`), `rounded-xl` en tarjetas y
  `rounded-full` en pastillas. Acento naranja de marca `hsl(28 91% 54%)`.
  Colores semánticos con un solo significado: rojo = urgente (pedido sin
  aceptar hace 10+ min), ámbar = esperando (cliente que pide una persona),
  verde = activo/entregado, gris = inactivo/agotado; siempre con texto al
  lado. Íconos de **Lucide** (`components/icons.tsx` los envuelve) y
  animaciones con **Motion** (sucesor de Framer Motion): pestañas con
  indicador deslizante, tarjetas que entran y salen, hoja con resorte,
  avisos. Carga con skeletons, no con spinners. Sin emojis: las categorías
  del menú usan símbolos (`components/menu/MenuSymbol.tsx`).
- **Tres tamaños.** Celular (< 768 px): barra de navegación abajo con
  contadores, hojas que suben desde abajo, chat a pantalla completa. Tablet
  (768–1279 px): riel compacto de íconos, pedidos en dos columnas por estado
  (tablero de tres columnas desde 1024 px), hojas laterales; la lista de
  Conversaciones pasa a 320 px para que quepan sus pestañas. Escritorio (≥ 1280 px): riel completo con el
  widget plegable del asistente; el panel del cliente en Conversaciones solo
  desde 1536 px. Lo que aparece "al pasar el cursor" depende de si hay mouse
  (variante `can-hover:`), no del ancho: en una tablet táctil se ve siempre.
  Botones y campos de 44 px en táctil, y campos a 16 px para que iOS no haga
  zoom. Un solo scroll: el de `<main>`.
- **Estado compartido en el layout** (`components/providers/`): pedidos,
  conversaciones y menú viven en providers, no en cada página. Así un pedido
  nuevo avisa esté donde esté el restaurante, los contadores de la
  navegación están siempre al día y los cambios en el menú sobreviven a
  navegar.
- **Pedidos** (`app/pedidos`, `components/orders/OrderTicket.tsx`). Escritorio:
  tres columnas (Nuevos, En preparación, Enviados), los más viejos arriba.
  Arriba, pestañas con contador: Todos, Nuevos, En preparación, Enviados y
  Entregados (con los cancelados aparte). En celular y tablet vertical
  "Todos" apila las mismas tres secciones (Nuevos primero); las pestañas que
  no caben se desplazan de lado con el borde desvanecido y la elegida siempre
  queda a la vista. El aviso de "desliza" sale en todo equipo táctil, no por
  ancho. `?estado=` abre una pestaña y `?pedido=CODIGO` abre ese pedido. Avanzar un pedido es
  **un solo gesto**: el botón de la tarjeta, deslizarla a la derecha (dedo) o
  arrastrarla a otra columna (mouse). Cada cambio muestra "Deshacer" en vez
  de pedir confirmación. Tocar la tarjeta despliega el detalle ahí mismo
  (dirección con mapa, teléfono, "Ver chat", cambiar a cualquier estado,
  cancelar con confirmación en línea). El cronómetro de cada pedido cambia de
  color a los 5/10 min (nuevo), 20/30 (preparación) y 30/45 (enviado).
  **Sigue conectado a Neon** por `GET/POST /api/orders`; la actualización es
  optimista y un sondeo que llega a mitad de camino no la revierte.
- **Conversaciones** (`components/inbox/`). Lista con los que "te necesitan"
  arriba, hilo tipo chat (cliente / bot / tú / avisos del sistema), botones y
  CTA del bot pintados como los vio el cliente. "Intervenir" pausa el bot en
  ese chat y habilita el cuadro; "Devolver al bot" lo reactiva. Abrir un chat
  NO lo pausa. Con la ventana de 24 h cerrada el cuadro se bloquea con el
  motivo. Panel del cliente con su ventana y sus pedidos reales.
  `?tel=` abre un chat directo (lo usa "Ver chat" desde un pedido).
- **Menú** (`app/menu`, `components/menu/`; `/catalogo` redirige aquí).
  Productos por categoría, **disponible/agotado con un interruptor en la
  fila**, editor en hoja (foto, nombre, descripción, precio, categoría,
  opciones de personalización), modo "Organizar" para reordenar productos y
  categorías y ocultar categorías, y **promociones** (porcentaje, precio fijo
  o 2x1; por categoría, producto o todo el menú; por días y horario).
  El menú de demostración sale del mismo catálogo semilla que la base
  (`@sistema/shared/db/seed-data`, export nuevo del paquete compartido).
- **Inicio** (`components/dashboard/Dashboard.tsx`). Métricas con tendencia
  contra ayer a la misma hora, gráfico con detalle al pasar el cursor (pedidos
  y ventas de la hora), cocina en micro-tarjetas y acciones rápidas por fila
  (Aceptar, Ver detalle). Lo urgente arriba
  (pedidos sin aceptar y cuánto lleva el más viejo, chats que esperan a una
  persona, agotados), cifras de hoy (ventas, pedidos, ticket promedio,
  cancelados), pedidos por hora, la cocina ahora y los últimos pedidos.
- **`NEXT_PUBLIC_PORTAL_DEMO="true"`** carga pedidos de ejemplo en memoria
  (y a los 25 s "entra" uno nuevo para ver el aviso). Sirve para grabar o
  probar sin base; nunca en producción.

**Dónde se conecta cada cosa:** todo lo que falta está en
`apps/portal/src/lib/portal-api.ts`, marcado con `TODO(backend)` y con la
regla que tiene que respetar (RN-05 para enviar, RN-02 para promociones).
Las pantallas no llaman a `fetch` directo; al conectar, cambia el cuerpo de
esas funciones y la carga inicial de `InboxProvider`/`MenuProvider`.
**Las promociones no tienen tabla en el esquema** — la forma propuesta está
en `apps/portal/src/lib/menu.ts` (`Promotion`), y el descuento tiene que
calcularse en el servidor al crear el pedido, no en el navegador.

**Verificado:** `tsc --noEmit`, `eslint` y `next build` del portal limpios;
las cinco rutas responden 200 en `next dev` con el modo demostración. No se
pudo revisar visualmente en el navegador desde la sesión (la extensión de
Chrome no respondía).

---

## La bandeja se conectó a Neon y al envío real (2026-09-23/24)

Tres cosas, en la misma sesión:

- **`GET /api/inbox` deja de leer `demo-data.ts`.** `apps/portal/src/db/inbox.ts`
  lee `conversations`/`messages` directo — un chat por número está
  garantizado por el esquema (`conversations.phone` es `unique()`), no por
  lógica nueva.
- **Se arregló un crash real en producción.** `apps/bot` guardaba en
  `messages.meta` el `{id,title}[]` interno de los botones (lo que necesita
  la API de WhatsApp), no los títulos que pinta `Thread.tsx`. Un objeto crudo
  como hijo de React tira el error #31 y deja la pantalla en blanco — así se
  descubrió, abriendo Conversaciones. `bot/types.ts` ahora expone
  `inboxMeta(reply)` para que `orchestrator.ts` y `menu-order/route.ts`
  guarden ya la forma que la interfaz necesita, y `apps/portal/src/db/inbox.ts`
  sanea lo que ya estaba mal guardado, para no tener que tocar la base a mano.
- **RF-33 a RF-36 (pausar, reactivar, responder) ya son reales,** no solo el
  frontend:
  - "Intervenir"/"Devolver al bot" → `POST /api/inbox` (`action: "pause"`
    o `"resume"`) escribe `conversations.bot_paused` directo — no hay envío
    a WhatsApp de por medio, así que RN-05 no aplica acá — y deja un mensaje
    `kind: "system"` real en el hilo (para que quien mire después sepa qué
    pasó, no solo quien hizo el clic).
  - "Responder" → `POST /api/inbox` (`action: "send"`) resuelve el teléfono
    y reenvía la llamada, con el secreto compartido, a
    `POST /api/internal/send` en `apps/bot` — el único camino de salida
    (RN-05) —, que pausa el bot, llama a `sendText()` (ya comprobaba
    `BOT_ACTIVE` y la ventana de 24 h) y registra el mensaje con
    `role: "agent"`.
  - **Verificado con un envío real:** un mensaje mandado desde la bandeja del
    portal en local llegó al WhatsApp del número de prueba del usuario,
    confirmado por él mismo.
- Variables nuevas en el portal (antes solo tenía `DATABASE_URL`): `BOT_URL`
  e `INTERNAL_SECRET` en Vercel (Production y Preview) — el mismo valor que
  ya usa `demo-delivery-system-bot`.

**Lo que sigue sin conectar, a propósito:** el outbox (RF-30/31, avisos de
cambio de estado de un pedido) y el Menú del portal (RF sobre `products`,
`categories`, promociones — estas últimas sin tabla todavía).

---

## Segunda fusión de `portal-redesign`: celular y tablet (2026-09-24)

Un solo commit de la rama (`09fab73`), **solo estilos y disposición** — ningún
archivo del backend recién conectado se toca, así que la fusión no tuvo
conflictos de código (el detalle de cada ajuste está arriba, en "Rediseño del
portal"). Lo que cambia:

- Pedidos: en celular y tablet vertical, "Todos" apila las tres secciones
  (Nuevos, En preparación, Enviados) en vez de una lista mezclada.
- Pestañas que se desplazan de lado con el borde desvanecido; la elegida se
  trae a la vista sola.
- Áreas táctiles de 36–44 px en la comanda, que vuelven a su tamaño con mouse
  (variante `can-hover:`).
- Arreglos de desbordamiento en Inicio, Menú y la cabecera del chat.

`npm run build` (las tres apps) y `eslint` pasan; Conversaciones sigue
mostrando los hilos reales, los mensajes de sistema y la ventana de 24 h.

---

## Promociones, recomendaciones y avisos de pedido (2026-09-24)

La última tanda antes del video. Cuatro cosas, en orden de dependencia:

### 1. Las promociones existen de verdad

Tabla `promotions` nueva, con la forma que el portal ya había propuesto
(tipo, valor, alcance, días, franja horaria). Las **reglas** viven en
`packages/shared/src/domain/promotions.ts` porque las necesitan las tres
apps: a qué productos aplica, qué precio deja, y si corre hoy.

Dos detalles que costaron pensarse:

- **El día es el del negocio, no el del servidor.** En Vercel las funciones
  corren en UTC: un viernes a las 7 p.m. en Colombia el servidor ya cree que
  es sábado, y una promo de viernes se apagaría cinco horas antes de tiempo.
- **Las promos apuntan a categorías y productos por id**, así que la semilla
  las declara por `slug`/`sku` y `seedPromotions()` los resuelve — sembrar el
  catálogo lo borra y lo reinserta, y los ids cambian. Por eso va siempre
  después de `seedCatalog`, en la misma corrida.

### 2. El Menú del portal dejó de ser una maqueta

`GET /api/menu` lee el catálogo real (el mismo `getCatalog()` del menú
público y del bot, con `includeHidden` para que el restaurante vea lo que
escondió) y las promociones. Marcar agotado escribe en `products.available`,
y el menú público y el asistente lo reflejan al instante porque leen esa
misma columna.

Las tarjetas muestran ahora **las mismas fotos por categoría que ve el
cliente**, copiadas a `apps/portal/src/assets/`. Se copiaron en vez de
compartirse desde `packages/shared` porque son importaciones estáticas de
Next, que solo funcionan dentro de una app; el precio es medio mega en el
repositorio contra servir las fotos de una app desde otra por URL absoluta,
que se rompe en cada despliegue de vista previa.

**Crear y editar productos sigue sin guardarse** (falta dónde poner la foto,
ver "Pendiente de decidir") y ahora **la interfaz lo dice en pantalla**: en
una demo, editar un precio creyendo que quedó guardado es peor que no poder
editarlo.

### 3. El asistente contesta por promociones y recomienda por ingredientes

Dos herramientas nuevas, con el reparto de trabajo de ADR-08 intacto — el
modelo dice *qué* preguntaron, el código resuelve la respuesta:

- `lookup_promotions`: el modelo solo extrae el día ("hoy", "el viernes");
  qué promoción corre, a qué aplica y en cuánto deja cada producto sale de la
  tabla. Inventarse un descuento es la clase de error que el restaurante
  termina teniendo que honrar.
- `recommend_products`: "una hamburguesa que no tenga queso". Filtra contra
  la descripción real. Dos asimetrías que importan: lo que se **excluye** no
  mira las opciones (descartar la de pollo porque se le *puede* agregar queso
  sería absurdo), lo que se **incluye** sí (quien pide algo picante se
  conforma con unas alitas cuya salsa lo es). Y una tabla corta traduce
  cortes a categorías: sin ella, a quien pedía algo sin carne se le ofrecía
  costilla.

`lookup_products` además recibe **cantidades y todos los productos
nombrados**: pedir tres cosas deja las tres en el carrito, no solo la
primera.

Verificado con `npm run verify:advisor` contra OpenAI y Neon reales, 12/12.

### 4. Los avisos de cambio de estado (RF-30, RF-31)

El portal encola en `notifications` y le pide al bot que entregue; el envío
sale por `sendText` (RN-05). El texto lo redacta `orderStatusMessage()` en
`@sistema/shared`, que es lo que comparten los dos.

**Hay dos disparadores, y no son dos caminos.** El cron de Vercel corre una
vez al día en el plan gratuito, y un cliente que se entera mañana de que su
pedido salió hoy no se entera de nada; por eso el portal llama además a
`/api/internal/outbox` apenas encola. Los dos ejecutan el mismo
`flushOutbox()`. Si el empujón falla, el cron lo recoge — por eso el portal
no espera su respuesta y el cambio de estado responde 200 igual.

**Esto no cuesta dinero.** Meta cobra las conversaciones que inicia el
negocio con plantilla, no los mensajes de servicio dentro de la ventana de
24 h, y un cliente que acaba de pedir siempre está dentro. (`wa.me` no servía
para esto: es un link que *abre* un chat, no puede empujar un mensaje.)

Verificado de punta a punta: tres avisos reales entregados al WhatsApp del
número de prueba, y los tres quedaron también en el hilo de la bandeja.

### Lo que queda cojo a propósito

**Una promoción no cambia todavía lo que el cliente paga.** El asistente la
anuncia con el precio con descuento, pero el menú cobra el precio lleno: el
recálculo del servidor (RN-02) no mira las promociones. Es el único punto
donde la demo puede contradecirse en cámara —preguntar por la promo y luego
pedir ese producto— y está pendiente de decidir si se toca, porque es el
camino del dinero.

---

## Decisiones que conviene no reabrir

Todas en `DECISIONS.md`. Las que más cuesta corregir después:

1. **El token firmado en el link** (ADR-05). Sin él no hay vuelta automática a
   WhatsApp y todo el mundo cae al código a mano.
2. **El outbox para los avisos** (ADR-07). Enviar directo parece más simple
   hasta que la ventana de 24 h se cierra y el aviso se pierde sin rastro.
3. **Un solo camino de salida** (RN-05). Que el portal llame a Meta por su
   cuenta duplica el registro de lo enviado y el manejo de errores.

---

## Tropezones (para no repetirlos)

- **La validación de variables de entorno al importar el módulo rompía el
  build**, y no solo en `env.ts`: `packages/shared/src/db/client.ts` tenía el
  mismo problema — `throw` si faltaba `DATABASE_URL`, evaluado por Next al
  recolectar datos de cada ruta durante el build, incluso sin haber ningún
  request real. La solución en `env.ts` fue getters; en `client.ts` fue un
  **Proxy** que construye la conexión real en el primer acceso a una
  propiedad, no al importar el módulo. Mismo principio en los dos sitios:
  validar en el primer uso, nunca en el import.
- **Faltaba `eslint.config.js` en las tres apps** desde el scaffolding
  original — nunca se habían corrido. Un primer intento con `FlatCompat` (el
  patrón que genera `create-next-app` en algunas plantillas) rompía con
  `Converting circular structure to JSON` porque cargaba una segunda copia de
  `eslint-plugin-react` por resolución de módulos "legacy". La solución:
  `eslint-config-next` en Next 16 ya exporta flat config nativo — se importa
  directo (`import nextConfig from "eslint-config-next"`), sin `FlatCompat`.
- **El narrowing por `switch` sobre un campo `type` no funciona si un miembro
  de la unión declara ese campo como `string` genérico** (`WaOtherMessage` en
  `services/whatsapp/types.ts`). TypeScript no excluye ese miembro de ninguna
  rama porque cualquier literal es asignable a `string`. Se resolvió con
  narrowing por **presencia de propiedad** (`"text" in message`) en vez de por
  valor del discriminante — sí distingue los miembros correctamente.
- **`tsx` no resuelve los alias `@/*` de una app** cuando el script se corre
  desde la raíz del monorepo: esos alias solo existen en el `tsconfig.json` de
  esa app. Se resuelve pasando `--tsconfig apps/bot/tsconfig.json` a `tsx`.
- **Un código de prueba generado a mano (`` `Z${Date.now()}`.slice(0,6) ``)
  puede caer fuera del alfabeto del código de pedido.** El alfabeto excluye
  0, 1, 5 y 8 (además de I/L/O/B) para que no se confundan al leerlos en voz
  alta; `Date.now()` los usa todo el tiempo. `parseOrderCode` nunca reconocía
  esos códigos de prueba, y el flujo completo del pedido parecía no avanzar
  — no era un bug del motor, era el script generando datos inválidos.
  **Regla:** cualquier dato de prueba con una forma restringida se genera con
  la función real (`generateOrderCode()`), nunca a mano.
- **Una aserción de prueba asumió que "no repetir el saludo" significaba "no
  mandar el link otra vez".** Un segundo saludo cae al respaldo del asesor
  (`resolveAdvisorReply`), que a propósito SÍ ofrece el menú porque su texto
  fijo dice "mira el menú" — quitarle el botón dejaría un texto que promete
  algo que no está. El código estaba bien; la aserción tenía la expectativa
  equivocada.
- **El asesor real, probado en vivo, afirmaba por su cuenta que "no
  manejamos sushi"** en vez de llamar a `lookup_products` — exactamente el
  fallo que ADR-08/ADR-09 previenen (el modelo decidiendo verdad de catálogo).
  Pasaba solo con negaciones: el prompt ya cubría "sí existe, cuánto vale",
  pero no "creo que no existe". Se corrigió reforzando la "REGLA QUE NO SE
  ROMPE" en `advisor.ts` para prohibir explícitamente también las negaciones
  por cuenta propia. Verificado corriendo `verify:advisor` tres veces seguidas
  (el modelo no es determinista).
- **El driver HTTP de Neon (`@neondatabase/serverless`) usa `fetch` para
  hablar con la base — igual que WhatsApp y OpenAI.** Invisible mientras se
  probó solo contra Postgres local por Docker (ese driver usa `pg`/TCP, nunca
  toca `fetch`). Al apuntar `DATABASE_URL` a Neon por primera vez,
  `verify-window-guard.ts` (contaba CUALQUIER llamada a `fetch` como si fuera
  WhatsApp) y `verify-orchestrator.ts` (trataba "todo lo que no es OpenAI"
  como si fuera WhatsApp, devolviéndole a Neon una respuesta falsa con la
  forma equivocada) rompieron: el primero con falsos negativos, el segundo con
  un `DrizzleQueryError` real al insertar. **Regla:** cualquier mock de
  `fetch` en un script de verificación debe distinguir por host de forma
  explícita (`graph.facebook.com`, `api.openai.com`) y dejar pasar todo lo
  demás a un `realFetch` capturado antes de sobreescribir — nunca asumir que
  "lo que no es X es Y".
- **Los scripts de verificación que ejercitan el orquestador dependen de la
  hora real** — `isOpenNow()` no es un detalle interno, es una puerta real
  del enrutador (paso 3) y ahora también de `/api/internal/menu-order`. Un
  script corrido después de `BUSINESS_CLOSES_HOUR` (22 por defecto) falla con
  "cerrado" en vez del motivo que se está probando, con síntomas que no
  apuntan para nada a la causa real. **Regla:** cualquier script que ejercite
  código detrás de `isOpenNow()` fija `BUSINESS_OPENS_HOUR="0"` y
  `BUSINESS_CLOSES_HOUR="24"` al principio, igual que ya fija credenciales
  falsas de Meta — el horario del negocio no es algo que un test de lógica
  deba dejar en manos del reloj de quien lo corre.
- **"Copiar el diseño" resultó ambiguo entre verse igual y comportarse
  igual**, y valía la pena preguntar en vez de asumir: el prototipo pedía
  nombre, dirección y método de pago dentro del carrito, lo que contradice
  ADR-02 (un pedido no puede armarse completo fuera de la conversación con el
  bot). Se confirmó con el usuario que "el frontend debe quedar igual" era
  sobre lo visual —colores, tipografía, fotos, layout— no sobre reabrir esa
  decisión. Ante una instrucción de "copiar literal" que choca con una
  decisión ya cerrada, preguntar cuál de las dos cede es más barato que
  adivinar mal en cualquier dirección.

---

## Pendiente de decidir (no bloquea todavía)

1. **Dónde se guardan los comprobantes.** En Vercel el disco es efímero.
   Conservarlos exige almacenamiento externo. Se decide en la Fase 5.
2. **El cron del outbox en plan Hobby** solo corre una vez al día. Para que los
   avisos salgan en minutos: Vercel Pro, o dispararlo desde fuera.
3. **Autenticación del portal.** Hoy no tiene. Para grabar da igual; antes de
   un restaurante real, no.

---

## Notas para la próxima sesión

- **Portal:** pedidos y conversaciones (lectura, pausar/reactivar/responder)
  ya son reales. Solo falta el Menú del portal — llenar las funciones
  `TODO(backend)` de `apps/portal/src/lib/portal-api.ts` (`getCatalog()` ya
  existe) — y el outbox (RF-30/31), que es aparte: los avisos de cambio de
  estado de un pedido todavía no le llegan al cliente. Las pantallas no
  deberían cambiar.
- **Lo único que falta de la Fase 3 es la voz (RF-14).** Mismo patrón de
  enchufe que ya se usó para el asesor: falta `services/whatsapp/media.ts`
  (descarga en dos pasos: `GET /{media-id}` da una URL temporal, se descarga
  con el mismo token) y `services/openai/transcribe.ts` (Whisper). El punto de
  conexión es `toRouteInput()` en `orchestrator.ts` — hoy todo `kind: "audio"`
  cae directo a `voiceUnavailable()`.
- No copiar el reconocimiento de productos del sistema real: bajo menu-first no
  hace falta, y es la parte más cara de allá.
- `DATABASE_URL` en `.env.local` ya apunta a Neon (producción), no a Postgres
  local. El driver se elige solo por la forma de la URL
  (`packages/shared/src/db/client.ts`); Docker local sigue funcionando si hace
  falta, solo cambiando la variable.
- Para probar el webhook en local hace falta un túnel (`localtunnel`/`ngrok`) y
  reconfigurar la URL en Meta cada vez que se reinicia.
- Scripts de verificación: `npm run verify:catalog`, `verify:channel`,
  `verify:window`, `verify:orchestrator`, `verify:advisor`, `verify:menu-order`,
  `verify:bot-menu-order`, `verify:bot-active`. Todos corren contra Neon real;
  `verify:advisor` además llama a OpenAI de verdad (gasta cuota). Los que
  tocan envío o el horario del negocio fijan `BOT_ACTIVE="true"` y
  `BUSINESS_OPENS_HOUR="0"`/`CLOSES_HOUR="24"` (si no, el candado de ADR-11 o
  el horario cortan antes de llegar a lo que cada script prueba de verdad) y
  reemplazan `fetch` por un doble solo para
  `graph.facebook.com`/`api.openai.com`/la URL del bot — todo lo demás pasa a
  un `realFetch` real, porque Neon también usa `fetch` (ver Tropezones).
- **El siguiente paso de verdad es Fase 6 (desplegar), no más código de
  Meta.** El checklist para activar el número compartido (ADR-11,
  `docs/DEPLOYMENT.md` §2):
  1. Pedir los cuatro `WHATSAPP_*` a quien administra la app de Meta de
     Qanelo — no se generan desde acá.
  2. Desplegar este bot a Vercel para tener una URL pública real.
  3. Correr los dos `curl` de `DEPLOYMENT.md` §2.2 (challenge y rechazo de
     firma inválida) contra esa URL — si el segundo devuelve 200, no pedir
     la rotación todavía.
  4. `BOT_ACTIVE="true"` en Vercel **primero**, recién después pedir
     `./rotar-webhook.sh otro https://<bot>.vercel.app/api/webhook/whatsapp`
     del lado de Qanelo. Al terminar la demo, al revés: primero
     `rotar-webhook.sh qanelo`, después `BOT_ACTIVE="false"`.
  Tampoco está puesto `BUSINESS_WHATSAPP_NUMBER` (el número real para el link
  de respaldo del menú, RF-27) — hoy usa el placeholder de `.env.example`; se
  llena con el mismo número compartido.
- **La Fase 4 (menú) quedó completa.** `apps/menu` tiene el catálogo real
  (con fotos de relleno del prototipo por categoría hasta que haya fotos del
  negocio), personalización, carrito persistente y el envío del pedido,
  wireado con `apps/bot/src/app/api/internal/menu-order/route.ts`. Falta
  únicamente diseño final si el negocio quiere reemplazar la paleta/fotos
  heredadas del prototipo — la lógica no cambia con eso.
- `apps/bot/.env.local` y `apps/menu/.env.local` son **symlinks** a
  `../../.env.local` (el único real, en la raíz) — sin eso, `next dev`
  corrido con `--workspace` no encuentra las variables porque busca
  `.env.local` en el cwd de cada app, no en la raíz del monorepo.
- `ConversationPhase` en el esquema incluye `"awaiting_voucher"`, que
  `engine.ts` decidió NO usar (ver el comentario en `closeOrder`): dejar esa
  fase sin código que la maneje habría creado un estado sin salida. Si la
  Fase 5 necesita distinguir "esperando comprobante" como fase explícita,
  revisar esa decisión primero — hoy no hace falta porque `voucher.ts` puede
  encontrar el pedido por teléfono + `paymentMethod` sin depender de la fase.
