# DEVELOPMENT_PLAN — Fases, criterios de salida y qué necesito de ti

> Cada fase dice qué queda funcionando, qué tienes que hacer tú y cómo se sabe
> que terminó. El orden no es arbitrario: la Fase 2 es la que valida que el
> canal real funciona, y todo lo demás depende de eso.

---

## Fase 0 — Estructura ✅

**Hecho.** Monorepo con tres apps y el paquete compartido, esquema de base de
datos, documentación, `.env.example` completo.

**Verificado:** las tres apps compilan; el esquema se aplica (12 tablas);
`npm run verify` pasa 19 comprobaciones del token firmado, la ventana de 24 h,
el código de pedido y el formato.

---

## Fase 1 — Base de datos y catálogo ⬜

**Qué queda.** Neon en la nube con el esquema aplicado, consultas del catálogo
y datos semilla del restaurante.

**Tú:** crear el proyecto en [neon.tech](https://neon.tech) y pasarme la
cadena de conexión.

**Criterio de salida.** `npm run db:push` contra Neon y el catálogo consultable
desde las tres apps.

---

## Fase 2 — El canal de WhatsApp ⬜ ← la que importa

**Qué queda.** El webhook recibiendo de verdad, con firma verificada e
idempotencia, y el bot capaz de responder. Al final de esta fase le escribes al
número desde tu celular y te contesta.

**Tú, en [developers.facebook.com](https://developers.facebook.com):**

1. Crear una app de tipo **Business** y agregarle el producto **WhatsApp**.
2. Copiar el **Phone number ID** de *API Setup*.
3. Crear el **token permanente** — el paso que más se falla:
   *Business Settings → Users → System Users → Add → rol Admin →
   Add Assets → tu app de WhatsApp con permiso completo →
   Generate New Token →* marcar `whatsapp_business_messaging` y
   `whatsapp_business_management`, expiración **Never**.
   **No sirve el token que muestra la consola: ese dura 24 horas.**
4. Copiar el **App Secret** de *Settings → Basic*.
5. Agregar tu celular en *API Setup → To* y confirmar el código que llega.
6. Cuando el bot esté desplegado, configurar el **webhook**: la URL que yo te
   dé, el *verify token* que inventaste, y suscribirse al campo **`messages`**.

**Criterio de salida.** Le escribes "hola" al número de prueba desde tu celular
y el bot contesta. Un reintento de Meta no produce respuesta duplicada.

---

## Fase 3 — El motor del asistente ⬜

**Qué queda.** Detectores de intención, máquina de estados del pedido, asesor
con el modelo, notas de voz, pausar/reactivar el bot.

**Tú:** pasarme la `OPENAI_API_KEY`.

**Criterio de salida.** Conversación completa por WhatsApp: saludo → menú →
canje del pedido → dirección → pago → confirmación. Y una **nota de voz** que
el bot entiende igual que un texto.

---

## Fase 4 — El menú público ⬜

**Qué queda.** Catálogo, carrito, personalizaciones, y el envío que hace que el
pedido vuelva solo a WhatsApp.

**Tú:** pasarme el diseño. Va en `apps/menu/src/components/` — su README dice
qué espera el resto del sistema (sobre todo: **propagar el `?t=`**, o se pierde
la vuelta automática).

**Criterio de salida.** Armas un pedido en el menú, le das enviar, y el mensaje
llega a tu WhatsApp sin que hayas escrito ningún código.

---

## Fase 5 — El portal y la bandeja ⬜

**Qué queda.** Tablero de pedidos con cambio de estado, el outbox de avisos, la
bandeja de conversaciones con el control del asistente, y el comprobante de
pago.

**Tú:** pasarme el diseño. Va en `apps/portal/src/components/`.

**Criterio de salida.** Con el celular y el portal al lado: el pedido aparece,
cambiar su estado avisa al cliente, responder desde la bandeja calla al bot en
ese chat y marcarla resuelta lo reactiva.

---

## Fase 6 — Despliegue y video ⬜

**Qué queda.** Las tres apps en Vercel, el webhook apuntando a producción, y
una pasada completa con el sistema real.

**Tú:** cuenta de Vercel conectada a GitHub.

**Criterio de salida.** El recorrido completo grabado de punta a punta sin
cortes ni retoques.

---

## Lo que necesito de ti, en orden

| Cuándo | Qué | Dónde |
|---|---|---|
| Fase 1 | `DATABASE_URL` | neon.tech |
| Fase 2 | Los 4 datos de Meta | developers.facebook.com |
| Fase 3 | `OPENAI_API_KEY` | platform.openai.com |
| Fase 4 | Diseño del menú | — |
| Fase 5 | Diseño del portal | — |
| Fase 6 | Cuenta de Vercel | vercel.com |

**Puedes ir adelantando lo de Meta desde ya**: es lo más lento (hay pasos de
verificación) y es lo que bloquea la fase que de verdad importa.

---

## Dos cosas que conviene decidir antes de la Fase 5

1. **Dónde se guardan los comprobantes.** En Vercel el disco es efímero. Si se
   quieren conservar hace falta almacenamiento externo (Vercel Blob, S3,
   Cloudflare R2). Se decide al llegar allá, pero conviene saberlo.
2. **Autenticación del portal.** Hoy no tiene. Para grabar el video da igual,
   pero antes de que un restaurante real lo use hay que ponerle algo.
