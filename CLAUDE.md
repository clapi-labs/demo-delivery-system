# CLAUDE.md — Guía para el agente

## Qué es este proyecto

Sistema de automatización de pedidos por **WhatsApp real** (Cloud API de Meta).
Versión reducida del sistema en producción
(`~/code/mixqanelo-sales-automate-system`), construida para grabar un video de
ventas y para que un prospecto puntual pueda probarla desde su propio WhatsApp.

## Cómo trabajamos: Spec-Driven Development

**La fuente de verdad son los documentos en `docs/`, no el código.**

**Orden de lectura al empezar cualquier tarea:**

1. `docs/STATUS.md` — qué se hizo, qué falta. La lectura más importante.
2. `docs/SPEC.md` — qué hace el sistema y qué deliberadamente no.
3. `docs/REQUIREMENTS.md` — el `RF-xx` que vas a implementar.
4. `docs/ARCHITECTURE.md` — dónde encaja la pieza.
5. `docs/DECISIONS.md` — decisiones cerradas. No reabrir sin razón fuerte.
6. `docs/DEVELOPMENT_PLAN.md` — la fase activa y su criterio de salida.
7. `docs/DEPLOYMENT.md` — **siempre que la tarea toque Meta, Vercel o Neon.**

## Las reglas que gobiernan el diseño

> **El chat guía, el menú vende.** Un pedido no puede nacer de una
> conversación (ADR-02).

> **Un solo camino de salida.** Todo mensaje al cliente sale por `apps/bot`.
> El portal y el menú le piden a él que envíe (RN-05).

## Reglas que no se rompen

- **El webhook se verifica siempre.** Sin comprobar la firma HMAC, esa URL es
  un endpoint público que manda WhatsApps en nombre del restaurante.
- **Idempotencia antes de procesar.** Meta reintenta. Sin `processed_messages`
  el cliente recibe respuestas duplicadas.
- **Los `statuses` no son mensajes.** Son acuses de lo nuestro. Procesarlos
  hace que el bot le conteste a su propio acuse.
- **Consultar la ventana de 24 h antes de cualquier envío.** Fuera de ella Meta
  rechaza todo lo que no sea plantilla aprobada.
- **El modelo nunca decide el flujo del pedido.** La máquina de estados es
  código (ADR-09).
- **Los precios se resuelven contra la base**, nunca contra el link ni el
  navegador (RN-02).
- **Nunca versionar secretos.** Todo a `.env.local`; plantilla en
  `.env.example`.
- **Nada que importe `db` puede importarse desde un componente de cliente.** El
  bundle del navegador se trae el driver de Postgres y el build revienta.

## Commits

- **Nunca agregar `Co-Authored-By: Claude` ni ninguna firma de IA — en
  commits, en push, en pull requests, en ningún lado.** Los commits y los PR
  deben verse como trabajo del autor del repositorio, sin mención del agente
  que ayudó a escribirlos. Se ve poco profesional y no es negociable. Misma
  regla que en `mixqanelo-sales-automate-system`.
- Mensajes en español, claros y descriptivos.
- Verificar con `git log --oneline` antes de hacer push.

## Estilo

- Código simple y legible por encima de clever. Comenta lo no obvio.
- Cambios pequeños y verificables; di qué tocas y por qué.
- Si una tarea contradice el spec, **detente y avísalo** en vez de improvisar.
- Al terminar un requerimiento, actualiza `REQUIREMENTS.md` y `STATUS.md`.

## Stack

Monorepo npm workspaces · Next.js 16 (App Router) · TypeScript · Tailwind 4 ·
Drizzle + Neon Postgres · WhatsApp Cloud API · OpenAI `gpt-4o-mini` · Vercel.

## Estructura

```
apps/
  bot/      webhook de Meta, motor del asistente, ÚNICO camino de envío
  menu/     catálogo público
  portal/   pedidos + bandeja de conversaciones
packages/
  shared/   esquema, tipos, catálogo, token del menú, ventana de 24 h
docs/       fuente de verdad
scripts/    verificaciones
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev:bot` / `dev:menu` / `dev:portal` | Servidores (3001 / 3002 / 3003) |
| `npm run build` | Compila las tres apps |
| `npm run verify` | Token, ventana de 24 h, código de pedido, formato |
| `npm run db:push` | Aplica el esquema |
| `npm run db:studio` | Explorador de la base |

## Lo que NO se debe asumir

- Que un envío va a llegar. La ventana de 24 h puede estar cerrada.
- Que un webhook llega una sola vez. Meta reintenta.
- Que el token de Meta no expira. El de la consola dura 24 horas; hace falta
  uno de System User.
- Que el disco persiste. En Vercel solo `/tmp`, y se borra entre invocaciones.
