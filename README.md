# Sistema de pedidos por WhatsApp

Automatización de pedidos para restaurantes: un asistente atiende por WhatsApp,
el cliente arma su pedido en un menú digital y todo aterriza en un portal donde
el equipo lo gestiona — y desde donde puede tomar el control de cualquier
conversación.

Versión reducida del sistema en producción, construida para grabar un video de
ventas y para pruebas puntuales con prospectos.

## Documentación

La fuente de verdad son los documentos en `docs/`, no el código:

| Documento | Para qué |
|---|---|
| [`STATUS.md`](docs/STATUS.md) | Qué se hizo y qué sigue. **Empieza acá.** |
| [`DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) | Las fases y qué hace falta en cada una |
| [`SPEC.md`](docs/SPEC.md) | Qué hace el sistema y qué deliberadamente no |
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Dónde encaja cada pieza |
| [`DECISIONS.md`](docs/DECISIONS.md) | Decisiones cerradas y su motivo |
| [`REQUIREMENTS.md`](docs/REQUIREMENTS.md) | Los `RF-xx` y su estado |
| [`DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Configurar Meta, Neon y Vercel |

## Estructura

```
apps/
  bot/      webhook de Meta, motor del asistente, único camino de envío
  menu/     catálogo público
  portal/   pedidos + bandeja de conversaciones
packages/
  shared/   esquema, tipos, catálogo, token del menú, ventana de 24 h
```

Tres despliegues independientes en Vercel, un paquete compartido por fuente.

## Poner a andar

```bash
npm install
cp .env.example .env.local   # ver docs/DEPLOYMENT.md para cada variable
npm run db:push
npm run dev:bot              # :3001
npm run dev:menu             # :3002
npm run dev:portal           # :3003
```

### Base de datos local

En producción corre contra Neon; para desarrollo alcanza Postgres en Docker. El
driver se elige solo según la forma de `DATABASE_URL`:

```bash
docker run -d --name dds-pg \
  -e POSTGRES_PASSWORD=demo -e POSTGRES_USER=demo -e POSTGRES_DB=demo \
  -p 55432:5432 postgres:16-alpine

# en .env.local
DATABASE_URL="postgresql://demo:demo@localhost:55432/demo"
```

### Probar el webhook en local

Meta necesita una URL pública:

```bash
npx localtunnel --port 3001
```

Apuntar el webhook de Meta a esa URL. Cambia cada vez que se reinicia el túnel.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila las tres apps |
| `npm run lint` | ESLint en las tres |
| `npm run verify` | Token del menú, ventana de 24 h, código de pedido |
| `npm run verify:catalog` | Catálogo contra la base real |
| `npm run verify:channel` | Normalización del webhook, idempotencia, conversación |
| `npm run verify:window` | El envío corta antes de llamar a la red con la ventana cerrada |
| `npm run verify:orchestrator` | El motor completo: candado, máquina de estados, tope de mensajes |
| `npm run db:push` | Aplica el esquema |
| `npm run db:seed` | Carga el catálogo |
| `npm run db:studio` | Explorador visual de la base |

## Ramas

| Rama | Qué es |
|---|---|
| `main` | El sistema con WhatsApp real |
| `demo-web` | La demo autoservicio con chat web simulado (archivada) |
