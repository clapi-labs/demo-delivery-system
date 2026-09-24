# REQUIREMENTS — Sistema de pedidos por WhatsApp

> Cada pieza de código se relaciona con un `RF-xx`.
> ⬜ Pendiente · 🟡 En curso · ✅ Hecho

## Fundación · Fase 1

| ID | Requerimiento | Estado |
|---|---|---|
| RF-01 | Esquema en Neon con las 12 tablas | ✅ |
| RF-02 | Catálogo consultable desde las tres apps | ✅ |
| RF-03 | Datos semilla del restaurante: categorías, productos, personalizaciones | ✅ |

## Canal de WhatsApp · Fase 2

| ID | Requerimiento | Estado |
|---|---|---|
| RF-04 | Verificación del webhook (`GET` con `hub.challenge`) | ✅ |
| RF-05 | Verificación de firma HMAC en cada entrega; sin firma válida, 403 | ✅ |
| RF-06 | Idempotencia por `message_id`: un reintento de Meta no duplica respuesta | ✅ |
| RF-07 | Los `statuses` (acuses) se descartan y nunca se procesan como mensajes | ✅ |
| RF-08 | Envío de texto, botones y link con CTA — un solo camino de salida | ✅ (código; el envío real se prueba en vivo, RF-08 no admite mock) |
| RF-09 | Ningún envío se intenta con la ventana de 24 h cerrada | ✅ |
| RF-10 | El webhook responde 200 siempre, incluso si el procesamiento falla | ✅ |

## Motor del asistente · Fase 3

| ID | Requerimiento | Estado |
|---|---|---|
| RF-11 | Rutas deterministas sin modelo: saludo, menú, cómo pedir, ayuda, negocio | ✅ |
| RF-12 | Fuera de horario: se contesta el horario sin llamar al modelo | ✅ Implementado y verificado; **desactivado en la demo** — el horario por defecto es 0–24. Se reactiva poniendo `BUSINESS_OPENS_HOUR`/`CLOSES_HOUR` |
| RF-13 | El asistente responde de productos con datos reales del catálogo | ✅ `bot/advisor.ts` conectado, verificado contra OpenAI real (`verify:advisor`, 9/9) |
| RF-14 | Notas de voz: se transcriben y entran al mismo flujo que un texto | ⬜ Degrada con gracia (probado); la transcripción real necesita `OPENAI_API_KEY` |
| RF-15 | Máquina de estados: canje → dirección → pago → cierre | ✅ |
| RF-16 | Ningún pedido se registra sin haber canjeado un código (candado) | ✅ |
| RF-17 | Si el modelo falla, respuesta fija + link. Nunca silencio | ✅ |
| RF-18 | Tope de mensajes por cliente por hora | ✅ |
| RF-19 | "reiniciar" reactiva el asistente (respaldo del cliente) | ✅ |

## Menú público · Fase 4

| ID | Requerimiento | Estado |
|---|---|---|
| RF-20 | Catálogo por categorías con ficha y personalizaciones | ✅ |
| RF-21 | Carrito persistente; solo guarda SKU, opciones y cantidad | ✅ |
| RF-22 | `?q=` abre con el buscador lleno | ✅ |
| RF-23 | `?add=` abre con el carrito armado, suma y no duplica al recargar | ✅ |
| RF-24 | Los precios se recalculan en el servidor contra la base | ✅ |
| RF-25 | El token firmado del link identifica el teléfono; sin él, modo anónimo | ✅ |
| RF-26 | Enviar el pedido avisa al bot y el mensaje llega solo a WhatsApp | ✅ (verificado con doble de Meta; falta la prueba en vivo con credenciales reales) |
| RF-27 | Respaldo: el cliente puede mandar `#PEDIDO <código>` a mano | ✅ |

## Portal y bandeja · Fase 5

| ID | Requerimiento | Estado |
|---|---|---|
| RF-28 | Tablero de pedidos en vivo | ✅ tablero por columnas (escritorio) y por pestañas (celular), conectado a Neon con sondeo cada 5 s y aviso de pedido nuevo en todo el portal |
| RF-29 | Cambio de estado: Pendiente → Preparando → En camino → Entregado | ✅ un toque, deslizar (celular) o arrastrar (escritorio), con "Deshacer"; se guarda en Neon vía `POST /api/orders` |
| RF-30 | El cambio de estado encola un aviso en el outbox | ✅ `POST /api/orders` escribe en `notifications` y le pide al bot que lo entregue ya; el texto lo redacta `orderStatusMessage()` en `@sistema/shared` (lo comparten portal y bot) |
| RF-31 | Barrido del outbox por cron, con reintentos y control de ventana | ✅ `bot/outbox.ts`, llamado por `/api/cron/outbox` (Vercel Cron) y por `/api/internal/outbox` (el empujón del portal). 5 intentos; la ventana la sigue comprobando `sendText`. Verificado: 3 avisos reales entregados por WhatsApp |
| RF-32 | Bandeja: lista de conversaciones, hilo y estado del asistente | ✅ lista con "Te necesitan", hilo tipo chat, datos del cliente y sus pedidos, sobre las conversaciones reales de Neon (`GET /api/inbox`) |
| RF-33 | Responder desde la bandeja pausa al asistente en ESA conversación | ✅ "Intervenir"/responder llaman a `POST /api/inbox` (pausa en Neon) y `POST /api/internal/send` en `apps/bot` (envío real + pausa antes de enviar); verificado con un mensaje real entregado por WhatsApp |
| RF-34 | Marcar resuelta reactiva al asistente en ESA conversación | ✅ "Devolver al bot" llama a `POST /api/inbox`, que limpia `bot_paused`/`escalation_reason` en Neon |
| RF-35 | La bandeja muestra cuánto queda de la ventana de 24 h | ✅ `windowRemaining()` sobre `lastInboundAt` real (viene de Neon desde que se conectó `GET /api/inbox`) |
| RF-36 | Con la ventana cerrada, el cuadro de texto se bloquea con el motivo | ✅ `Thread.tsx` bloquea `submit()` y el cuadro cuando `windowRemaining().open` es falso, con dato real |
| RF-37 | El comprobante se guarda siempre, valide o no | ⬜ |
| RF-38 | Validación binaria: cuadra → validado; no cuadra → registrado y escalado | ⬜ |
| RF-39 | Una referencia de transferencia no se acepta dos veces | ⬜ |
| RF-40 | Resumen: pedidos, ticket promedio, productos más pedidos | 🟡 el Inicio muestra ventas, pedidos, ticket promedio, cancelados, pedidos por hora y lo urgente; falta productos más pedidos |
| RF-44 | Menú del portal sobre el catálogo real, con foto por categoría | ✅ `GET /api/menu` lee `getCatalog({includeHidden})`; marcar agotado escribe en `products.available`. Crear/editar productos sigue sin guardar (falta almacenamiento de imágenes) y la interfaz lo dice |
| RF-45 | Promociones: crear, editar, pausar y borrar desde el portal | ✅ tabla `promotions` + `POST /api/menu`; las reglas (a qué aplica, qué precio deja, qué días corre) viven en `@sistema/shared` |
| RF-46 | El asistente responde por las promociones de un día | ✅ herramienta `lookup_promotions`: el modelo solo dice el día, el código resuelve la promo contra la tabla con nombres y precios reales |
| RF-47 | El asistente recomienda por ingredientes | ✅ herramienta `recommend_products`: filtra por la descripción real del catálogo ("una hamburguesa sin queso") |
| RF-48 | La promoción descuenta el precio real del pedido | ✅ `priceLine()` en `@sistema/shared`, la misma función para la tarjeta del menú, el total del carrito y el recálculo del servidor (RN-02). `npm run verify:promotions` |

## Despliegue · Fase 6

| ID | Requerimiento | Estado |
|---|---|---|
| RF-41 | Las tres apps en Vercel con sus variables | ⬜ |
| RF-42 | `/api/health` reporta qué variables faltan | ✅ |
| RF-43 | Endpoints internos protegidos con `INTERNAL_SECRET` | ✅ `/api/internal/menu-order`, `/api/internal/send` y `/api/internal/outbox`; el cron acepta además `CRON_SECRET` |

---

## Reglas de negocio

| ID | Regla |
|---|---|
| RN-01 | Un código de pedido se canjea **una sola vez** |
| RN-02 | El precio se resuelve contra la base, nunca contra el link o el navegador |
| RN-03 | Un pedido sin `source = "menu"` y sin canjear no se registra jamás |
| RN-04 | Con el asistente pausado, no responde **nada** en esa conversación |
| RN-05 | Todo mensaje saliente pasa por `apps/bot`. No hay segundo camino |
| RN-06 | Tope de 10 productos distintos por link `?add=` |
| RN-07 | Fuera de la ventana de 24 h no se intenta enviar; se reintenta después |
| RN-08 | El comprobante se guarda en disco **antes** de intentar leerlo |
| RN-09 | Con `BOT_ACTIVE=false` (número compartido con Qanelo, ADR-11), ningún envío sale, sin excepción |
| RN-10 | El precio con promoción lo calcula `priceLine()` y nadie más: navegador y servidor tienen que dar el mismo número |
