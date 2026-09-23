# SPEC — Sistema de pedidos por WhatsApp

> Qué hace el sistema y qué deliberadamente no hace. Documento vivo.

---

## 1. Para qué existe

Un restaurante atiende sus pedidos por WhatsApp sin que nadie tenga que estar
pegado al celular. Un asistente responde, guía al cliente al menú, cierra el
pedido y lo entrega al portal donde el equipo lo gestiona — y desde ese mismo
portal alguien puede tomar el control de cualquier conversación.

Es una versión reducida del sistema que ya corre en producción
(`mixqanelo-sales-automate-system`), construida para **grabar un video de
ventas** y, cuando haga falta, dejar que un prospecto concreto lo toque desde
su propio WhatsApp.

## 2. El negocio ficticio

**Sabor Urbano** — comida rápida. Nombre, precios y productos inventados. Se
eligió comida rápida porque permite mostrar personalizaciones (término,
extras, acompañamiento), que es lo que separa un menú digital de un catálogo
plano.

## 3. Las tres piezas

### 3.1 El bot (`apps/bot`)

El asistente en WhatsApp. Puede:

- Saludar y mandar el link del menú.
- Responder del negocio: horario, domicilio, cobertura, métodos de pago.
- Decir si un producto existe y cuánto vale, **con datos del catálogo**.
- Entender **notas de voz** igual que texto.
- Cerrar el pedido que vino del menú: dirección y método de pago.
- Recibir y **leer el comprobante** de una transferencia.
- **Escalar a una persona** y callarse hasta que le devuelvan el turno.

No puede, a propósito: armar un pedido por chat (§4).

### 3.2 El menú (`apps/menu`)

Catálogo público con ficha de producto, personalizaciones y carrito. Acepta
tres parámetros que manda el asistente:

- `?t=<token>` — quién es el cliente. **Es lo que hace que el pedido vuelva
  solo a WhatsApp.**
- `?q=<texto>` — abrir con el buscador lleno.
- `?add=SKU:cant,…` — abrir con el carrito armado.

### 3.3 El portal (`apps/portal`)

Lo que ve el restaurante, en una sola pantalla:

- **Pedidos** — entrando en vivo, con su detalle y el cambio de estado
  (Pendiente → En preparación → En camino → Entregado).
- **Conversaciones** — la bandeja: lista de chats, hilo, y el control del
  asistente (pausar / responder / reactivar). Reemplaza a Chatwoot (ADR-04).
- **Resumen** — pedidos del día, ticket promedio, productos más pedidos.

## 4. La regla central: el chat guía, el menú vende

**Un pedido no puede nacer de una conversación.**

```
cliente → WhatsApp → el asistente responde y manda el link (con token)
                                    │
                                    ▼
                    menú → carrito → enviar → pedido + código
                                    │
                                    ▼
          el bot recibe el aviso y escribe al cliente solo
                                    │
                        dirección → pago → registrado
                                    │
                                    ▼
                              portal (en vivo)
```

El candado es estructural: el motor de pedido solo se alcanza tras canjear un
código, y se comprueba contra la fila de la base (`source`, `redeemedAt`), no
contra una variable en memoria.

## 5. Lo que impone WhatsApp y hay que respetar

Tres reglas de Meta que atraviesan todo el diseño:

| Regla | Consecuencia |
|---|---|
| **Ventana de 24 horas** — solo se pueden mandar mensajes libres dentro de las 24 h desde el último mensaje del cliente | Los avisos van por un outbox con reintentos (ADR-07). El portal muestra cuánto queda antes de dejar escribir. El cliente siempre inicia. |
| **Webhooks reintentados** — si no se acusa 200 a tiempo, Meta reenvía | Idempotencia por `message_id` antes de procesar nada (ADR-06) |
| **Firma HMAC** en cada entrega | Sin verificarla, el webhook es un endpoint público que manda WhatsApps en nombre del restaurante |

## 6. Cómo llega a un prospecto

1. **Un video.** El recorrido completo grabado. Es el camino normal.
2. **Prueba puntual.** El número de WhatsApp es compartido con Qanelo, por
   rotación manual (ADR-11) — pero **sigue siendo el número de prueba
   gratuito de Meta** (`verified_name: "Test Number"`, sin verificar,
   confirmado contra la Graph API), no uno propio verificado. Eso significa
   que el control de acceso tiene DOS capas, no una:
   1. La rotación (`BOT_ACTIVE` + el interruptor de nginx): mientras no le
      toca el turno a este bot, nadie puede tocarlo.
   2. **La lista de hasta 5 destinatarios** del número de prueba, que se
      administra en el panel de Meta de quien lo controla (Qanelo) — un
      número que NO esté en esa lista no puede recibir respuesta del bot
      aunque la rotación esté bien apuntada. Agregar a alguien a esa lista lo
      coordina quien tiene acceso al panel, no este repo.

## 7. Qué NO hace, a propósito

| No hace | Por qué |
|---|---|
| Reconocimiento difuso de productos, RAG, alias | El menú-first lo vuelve innecesario (§4) |
| Domiciliarios que se autoasignan | Se muestra el cambio de estado, no el rol completo |
| Integración con POS | No hay POS que integrar |
| Multi-restaurante | Un solo negocio. Multi-tenant se agrega si el producto lo pide |
| Autenticación del portal | Pendiente. Para grabar da igual; antes de un cliente real, no |
| Plantillas de Meta para reabrir la ventana | Requieren aprobación de Meta y no aportan al video |
