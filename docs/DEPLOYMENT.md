# DEPLOYMENT — Configuración y despliegue

> Fuente de verdad operativa. Se actualiza en el momento en que algo cambia.

**Estado:** nada desplegado todavía. Estructura lista y verificada contra
Postgres local.

---

## 1. Neon (Fase 1)

1. [neon.tech](https://neon.tech) → proyecto nuevo (región más cercana).
2. Copiar la *Connection string* → `DATABASE_URL`.
3. `npm run db:push`

**Por qué Neon y no Supabase:** el plan gratuito de Supabase pausa el proyecto
tras 7 días sin actividad. Neon autosuspende el compute pero despierta en menos
de un segundo y no archiva nada.

---

## 2. Meta / WhatsApp — número compartido con Qanelo (ADR-11)

**Esto ya NO es "crear una app de Meta".** El número, la app y el webhook son
de Qanelo (`mixqanelo-sales-automate-system`); este bot los pide prestados
por rotación manual, nunca los toca directamente.

### 2.1 Pedir las credenciales

Las cuatro son las mismas que usa Qanelo — pedírselas a quien administra esa
app (no hay panel de Meta al que este proyecto tenga acceso):

| Variable | Qué es |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | El "Phone number ID" del número compartido |
| `WHATSAPP_ACCESS_TOKEN` | El token permanente de System User de esa app |
| `WHATSAPP_APP_SECRET` | El App Secret de esa app — firma cada webhook |
| `WHATSAPP_VERIFY_TOKEN` | El verify token que ya está puesto en el webhook |

**No se generan ni se rotan desde acá.** Si alguna de las cuatro cambia, hay
que pedir la nueva — regenerarla por cuenta propia rompe a Qanelo.

### 2.2 El webhook: nada que configurar en Meta

La URL que Meta conoce (`https://staging.qanelo.com/webhook`) es fija y no se
toca — está fuera del alcance de este proyecto por diseño. Un nginx delante
de los dos bots decide, con un interruptor manual, a cuál reenviar cada
entrega. **Ni el GET de verificación ni la suscripción a `messages` se tocan
acá**: eso ya está configurado del lado de Qanelo y sobrevive a la rotación.

Lo que sí hay que entregarle a quien administra esa rotación, una vez el bot
esté desplegado:

1. La URL real de este despliegue (el destino al que el nginx debe reenviar
   cuando le toque el turno a este bot): `https://<bot>.vercel.app/api/webhook/whatsapp`.
2. Confirmación de que el `GET` del challenge responde bien:
   ```bash
   curl "https://<bot>.vercel.app/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=<WHATSAPP_VERIFY_TOKEN>&hub.challenge=PRUEBA"
   # debe devolver exactamente: PRUEBA
   ```
3. Confirmación de que una firma inválida se rechaza (nunca 200):
   ```bash
   curl -i -X POST -H "Content-Type: application/json" -d '{}' https://<bot>.vercel.app/api/webhook/whatsapp
   # debe devolver 403, nunca 200 — si devuelve 200, no pedir la rotación todavía
   ```
4. Cómo se "apaga" este bot: no hay un proceso que detener (Vercel es
   serverless) — el equivalente es `BOT_ACTIVE`. Ver 2.3.

### 2.3 `BOT_ACTIVE` — el candado de la rotación

Activar este bot en el número compartido son **dos pasos independientes**, en
este orden:

1. Poner `BOT_ACTIVE="true"` en las variables de entorno de Vercel y
   redesplegar (o esperar a que tome el nuevo valor).
2. Recién ahí, pedir que el interruptor de nginx apunte hacia este bot:
   ```bash
   # del lado de Qanelo, no de este repo
   ./rotar-webhook.sh otro https://<bot>.vercel.app/api/webhook/whatsapp
   ```

**El orden importa.** Si nginx ya apunta acá y `BOT_ACTIVE` sigue en `false`,
el peor caso es que el bot no conteste un momento — seguro. Al revés
(`BOT_ACTIVE=true` con nginx todavía en Qanelo) no pasa nada tampoco, porque
sin la entrada del webhook no hay a quién responder. El error real solo
ocurre si `BOT_ACTIVE=true` sigue puesto **después** de devolver el turno:
ahí sí un cron o un reintento podría escribirle al cliente equivocado. Por
eso, para terminar la demo, el orden se invierte: primero devolver la
rotación (`./rotar-webhook.sh qanelo`), después `BOT_ACTIVE="false"`.

### 2.4 Probar en local sin desplegar

No hace falta URL pública para desarrollar: los scripts de verificación
(`npm run verify:*`) mockean la Graph API. Para probar el webhook de verdad
con Meta enviando de verdad, hace falta pedirle a quien administra la
rotación que apunte temporalmente hacia un túnel:

```bash
npx localtunnel --port 3001
# o
ngrok http 3001
```

Esto **no se hace sin avisar** — apunta el tráfico real del número compartido
a una máquina de desarrollo, y hay que devolver la rotación a Qanelo apenas
se termine de probar.

---

## 3. OpenAI (Fase 3)

[platform.openai.com](https://platform.openai.com) → *API keys* → crear una.
Cargar algo de saldo; el consumo a esta escala es de centavos.

---

## 4. Secretos propios

```bash
openssl rand -hex 32   # INTERNAL_SECRET
openssl rand -hex 32   # MENU_TOKEN_SECRET
```

`MENU_TOKEN_SECRET` tiene que ser **idéntico** en el bot y en el menú, o el
pedido deja de volver solo a WhatsApp y todo el mundo cae al respaldo del
código a mano.

---

## 5. Vercel (Fase 6)

Tres proyectos desde el mismo repo. En cada uno, *Root Directory*:

| Proyecto | Root Directory | Variables |
|---|---|---|
| `bot` | `apps/bot` | Todas |
| `menu` | `apps/menu` | `DATABASE_URL`, `MENU_TOKEN_SECRET`, `INTERNAL_SECRET`, `BOT_URL`, negocio |
| `portal` | `apps/portal` | `DATABASE_URL`, `INTERNAL_SECRET`, `BOT_URL`, negocio |

**Orden que importa:** las variables se cargan **antes** del primer deploy.

Después del primer despliegue hay que volver atrás y rellenar `MENU_URL`,
`PORTAL_URL` y `BOT_URL` con las URLs reales — no se conocen hasta que Vercel
las asigna. Es un ida y vuelta inevitable.

### El cron del outbox

En `apps/bot/vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/outbox", "schedule": "* * * * *" }] }
```

> El plan Hobby de Vercel limita los crons a **una ejecución diaria**. Para que
> los avisos salgan en minutos hace falta Pro, o dispararlo desde fuera (un
> cron-job.org gratuito llamando a la URL con el secreto). Se decide en la
> Fase 5.

---

## 6. Verificación

```bash
curl https://<bot>.vercel.app/api/health
```

Devuelve `{"ok":true,"missing":[]}` o la lista de lo que falta. Existe porque
en serverless un despliegue sin una variable **levanta bien** y solo falla
cuando escribe el primer cliente.

Después, el recorrido completo:

1. Escribirle "hola" al número de prueba → contesta con el botón del menú.
2. El link lleva `?t=…`.
3. Armar un pedido y enviarlo → el mensaje llega solo a WhatsApp.
4. Dirección y pago → el pedido aparece en el portal.
5. Cambiar el estado → llega el aviso.
6. Responder desde la bandeja → el bot se calla en ese chat.
7. Marcar resuelta → el bot retoma.
8. Mandar una **nota de voz** → la entiende.

---

## 7. Costos

| Pieza | Plan | Costo |
|---|---|---|
| Vercel | Hobby | $0 (ver la nota del cron) |
| Neon | Free | $0 |
| WhatsApp | Número de prueba | $0 |
| OpenAI | Pago por uso | centavos por conversación |
