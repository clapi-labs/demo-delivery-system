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
| RF-12 | Fuera de horario: se contesta el horario sin llamar al modelo | ✅ |
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
| RF-28 | Tablero de pedidos en vivo | 🟡 frontend hecho, con datos de demostración — falta conectar a Neon y el sondeo en vivo |
| RF-29 | Cambio de estado: Pendiente → Preparando → En camino → Entregado | 🟡 el flujo y los botones funcionan en el frontend; falta persistirlo |
| RF-30 | El cambio de estado encola un aviso en el outbox | ⬜ |
| RF-31 | Barrido del outbox por cron, con reintentos y control de ventana | ⬜ |
| RF-32 | Bandeja: lista de conversaciones, hilo y estado del asistente | 🟡 frontend hecho (lista + hilo + indicador de pausa/escalado), con datos de demostración |
| RF-33 | Responder desde la bandeja pausa al asistente en ESA conversación | ⬜ (el frontend de esta vuelta es de solo lectura, sin cuadro de respuesta) |
| RF-34 | Marcar resuelta reactiva al asistente en ESA conversación | ⬜ |
| RF-35 | La bandeja muestra cuánto queda de la ventana de 24 h | 🟡 se muestra en el frontend; falta calcularlo con `windowRemaining()` sobre datos reales |
| RF-36 | Con la ventana cerrada, el cuadro de texto se bloquea con el motivo | ⬜ |
| RF-37 | El comprobante se guarda siempre, valide o no | ⬜ |
| RF-38 | Validación binaria: cuadra → validado; no cuadra → registrado y escalado | ⬜ |
| RF-39 | Una referencia de transferencia no se acepta dos veces | ⬜ |
| RF-40 | Resumen: pedidos, ticket promedio, productos más pedidos | 🟡 el Inicio muestra pedidos/ventas del día como franja de métricas (datos de demostración); falta ticket promedio y productos más pedidos |

## Despliegue · Fase 6

| ID | Requerimiento | Estado |
|---|---|---|
| RF-41 | Las tres apps en Vercel con sus variables | ⬜ |
| RF-42 | `/api/health` reporta qué variables faltan | ✅ |
| RF-43 | Endpoints internos protegidos con `INTERNAL_SECRET` | 🟡 `/api/internal/menu-order` sí (RF-26); `/api/internal/send` (Fase 5) sigue sin construir |

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
