# DECISIONS — Registro de decisiones de arquitectura

> Decisiones cerradas y su motivo. No se reabren sin una razón fuerte y
> explícita. Formato: contexto → decisión → consecuencia.

---

## ADR-01 · WhatsApp real, con la Cloud API de Meta

**Contexto.** Una versión anterior (rama `demo-web`) usaba un chat web propio
para que cualquier prospecto probara sin fricción. El enfoque comercial cambió:
en vez de mandar una demo autoservicio, se graba **un video** del sistema real
funcionando, y si un prospecto quiere tocarlo se le agrega puntualmente al
número de prueba y se le saca después.

**Decisión.** El canal es WhatsApp de verdad, vía Cloud API.

**Por qué.** Con el enfoque de video, las limitaciones del número de prueba
dejan de ser un problema: los 5 destinatarios sobran cuando el que graba es uno
mismo, y agregar/sacar un prospecto a mano es justo el control de acceso que se
quiere. A cambio se gana lo único que un chat simulado no puede dar: que lo que
se ve en el video **sea** el producto.

**Consecuencia.** Entra todo lo que el canal real implica y la simulación no
tenía: verificación de firma del webhook, idempotencia por `message_id`, la
ventana de servicio de 24 horas (ADR-07), descarga de multimedia en dos pasos,
y un token permanente de System User en vez del temporal de la consola.

---

## ADR-02 · El chat guía, el menú vende

**Contexto.** Regla central del sistema real (ADR-26 allá): un pedido no puede
nacer de una conversación.

**Decisión.** Se hereda sin excepciones.

**Por qué.** Doble beneficio. Es **fiel** — es el producto que se vende. Y es
**barato** — sin carrito conversacional, el bot no necesita reconocimiento de
productos, desambiguación de presentaciones, alias, RAG ni conversión de
unidades, que es toda la parte cara del sistema real.

**Consecuencia.** El motor de pedido solo se alcanza tras canjear un código. El
candado es estructural: no existe herramienta que escriba un pedido fuera del
canje, y se comprueba contra la fila de la base (`source`, `redeemedAt`), no
contra una variable en memoria.

---

## ADR-03 · Monorepo con tres apps y un paquete compartido

**Contexto.** Tres superficies con dueños distintos: el canal (bot), lo que ve
el cliente (menú) y lo que ve el restaurante (portal).

**Decisión.**

```
apps/bot     webhook de Meta, motor del asistente, ÚNICO camino de envío
apps/menu    catálogo público
apps/portal  pedidos + bandeja
packages/shared   esquema, tipos, catálogo, token, ventana de 24 h
```

Tres proyectos de Vercel, un paquete compartido por fuente (sin paso de build).

**Por qué.** Espeja la separación del sistema real y permite pegar el diseño
del menú y el del portal sin tocar nada más. `packages/shared` existe para que
el esquema y las reglas de dominio tengan **una sola** definición: tres copias
del mismo tipo se desincronizan sin que nadie lo note.

**Consecuencia.** Las apps se hablan por HTTP con `INTERNAL_SECRET`. Solo el
bot habla con Meta — el portal y el menú le piden a él que envíe. No se
construye un segundo camino de salida.

---

## ADR-04 · La bandeja vive en el portal; no se usa Chatwoot

**Contexto.** Al conectar el número a la Cloud API se pierde la vista nativa de
WhatsApp: el dueño deja de ver las conversaciones desde su celular. El sistema
real resuelve eso espejando todo a Chatwoot en un segundo servidor.

**Decisión.** La bandeja se construye dentro del portal. No se levanta
Chatwoot.

**Por qué.** Tres razones, en orden de peso:

1. **Los mensajes ya están en nuestra base.** El bot los escribe al recibirlos
   y al responder. Chatwoot sería una copia de algo que ya tenemos — con su
   propio Postgres, su Redis, su Sidekiq y el bug clásico del eco de mensajes
   salientes.
2. **Una sola pantalla para el restaurante.** Los pedidos y las conversaciones
   son el mismo trabajo; partirlos en dos aplicaciones obliga a tener dos cosas
   abiertas y a saltar entre ellas.
3. **El control del bot queda donde ya están mirando.** Pausar el asistente,
   responder y reactivarlo son tres botones al lado del pedido, no una función
   que hay que ir a buscar a otra herramienta.

**Consecuencia.** Hay que construir la bandeja (lista, hilo, estado), que es
trabajo que Chatwoot regalaba. A cambio no hay servidor extra, no hay
sincronización que se pueda desfasar, y no existe el modo de fallo del eco.

---

## ADR-05 · El link del menú lleva un token firmado

**Contexto.** El menú es una web y el chat es WhatsApp. Cuando el cliente le da
"enviar" en el menú, el sistema tiene que saber **a qué número** contestarle.

**Decisión.** El bot firma un token HMAC con el teléfono y lo pone en el link
(`?t=…`). El menú lo propaga al crear el pedido; el bot lo verifica y contesta.

**Por qué.** Sin esto, la única alternativa es que el cliente copie un código y
lo mande a mano por WhatsApp — que es exactamente la fricción que el sistema
real eliminó. Y **firmado** porque el link viaja por WhatsApp y acaba en el
navegador del cliente: sin firma, cambiar un parámetro de la URL permitiría
pedir a nombre de otro número.

**Consecuencia.** `MENU_TOKEN_SECRET` debe ser idéntico en bot y menú. El token
caduca a las 24 h para que un link reenviado a un grupo deje de servir. Si el
token falta o no vale, el menú cae al modo anónimo y el cliente manda su
`#PEDIDO` a mano — el respaldo nunca se toca.

---

## ADR-06 · Idempotencia en Postgres, no en Redis

**Contexto.** Meta reintenta la entrega del webhook si no recibe un 200 a
tiempo. El mismo mensaje puede llegar dos o tres veces.

**Decisión.** Una tabla `processed_messages` con el `message_id` como clave
primaria. El sistema real usa Redis para esto.

**Por qué.** A esta escala, una tabla resuelve lo mismo sin sumar un servicio
que hay que desplegar, monitorear y pagar. El `INSERT` con clave primaria ya es
atómico: si choca, el mensaje ya se procesó.

**Consecuencia.** Hay que limpiar lo viejo periódicamente. Si algún día el
volumen lo justifica, Redis entra sin cambiar el resto.

---

## ADR-07 · Los avisos al cliente van por un outbox, no directo

**Contexto.** Cuando el portal cambia un estado, hay que avisarle al cliente.
Pero WhatsApp **solo permite mensajes libres dentro de las 24 horas** desde el
último mensaje del cliente; fuera de esa ventana Meta rechaza todo lo que no
sea una plantilla aprobada.

**Decisión.** El portal escribe el aviso en la tabla `notifications`. Un
barrido periódico (Vercel Cron) intenta entregarlo.

**Por qué.** Dos fallos que no pueden bloquear la cocina: que Meta esté caída y
que la ventana esté cerrada. Cambiar un pedido a "en camino" tiene que
funcionar siempre; que el cliente se entere es un efecto deseable, no una
precondición.

**Consecuencia.** El aviso puede llegar con retraso, o no llegar si la ventana
nunca se reabre. El portal muestra cuánto queda de ventana para que el agente
sepa a qué atenerse antes de escribir.

---

## ADR-08 · `gpt-4o-mini` de OpenAI

**Contexto.** El bot necesita un modelo para preguntas libres, transcripción de
audio y lectura de comprobantes.

**Decisión.** OpenAI: `gpt-4o-mini` para conversación y visión, `whisper-1`
para audio.

**Por qué.** Es lo que ya corre en el sistema real, así que el comportamiento
del video coincide con el del producto. Y las tres capacidades salen del mismo
proveedor y la misma llave, que a esta escala vale más que optimizar cada una
por separado.

**Consecuencia.** La capa del modelo queda detrás de tres funciones
(`chat`, `transcribe`, `vision`) para que cambiar de proveedor sea local.
Ninguna lanza: si fallan, el bot responde con un texto fijo.

---

## ADR-09 · El modelo nunca decide el flujo del pedido

**Contexto.** Sería más corto dejar que el modelo maneje todo el turno.

**Decisión.** La máquina de estados —canje, dirección, pago, cierre— es código
determinista. El modelo solo interviene en preguntas libres y al escalar.

**Por qué.** Un modelo que se sale del carril rompe la grabación justo cuando
importa. Un pedido tiene respuesta correcta y no se negocia con un modelo de
lenguaje.

**Consecuencia.** Las rutas deterministas (saludo, pedir el menú, canjear
código, botones, fuera de horario) ni siquiera llaman al modelo, lo que además
baja costo y latencia.

---

## ADR-10 · El comprobante se guarda siempre

**Contexto.** El cliente manda la foto de una transferencia y el sistema
intenta leerla.

**Decisión.** La imagen se guarda en disco **antes** de intentar interpretarla,
valide o no. La decisión de validación es binaria: cuadra → pago validado; no
cuadra → el pedido **se registra igual** con el pago en revisión y se escala a
una persona con el motivo concreto.

**Por qué.** Un comprobante que el sistema no pudo leer sigue siendo la prueba
de que el cliente pagó. Y dejar al cliente esperando por una duda del sistema
es el peor desenlace posible: pagó, y nadie le responde.

**Consecuencia.** En Vercel el disco es efímero (solo `/tmp`, que se borra
entre invocaciones). Para conservar los comprobantes hace falta almacenamiento
externo — decisión pendiente para la Fase 5.

---

## ADR-11 · El número de WhatsApp se comparte con Qanelo, por rotación manual

**Contexto.** Conseguir un número propio verificado por Meta para una demo
comercial es fricción que no vale la pena pagar dos veces. Se decidió
compartir el número (y la app de Meta) del sistema real
(`mixqanelo-sales-automate-system`, "Qanelo") con este bot. Nunca están
activos los dos a la vez: se rota a mano.

**Cómo funciona, del lado de Meta.** El webhook que Meta conoce es una URL
fija que no cambia nunca — no la tocamos, no tenemos acceso al panel de esa
app. Un nginx delante de los dos bots decide, con un interruptor manual fuera
del despliegue normal, a cuál de los dos reenviar cada entrega. Cuando no nos
toca, nginx simplemente no nos manda nada — no hay nada que este bot deba
hacer para "no recibir".

**Decisión.** El riesgo real no es recibir de más (eso lo resuelve nginx):
es **mandar de más** — que un cron, un reintento en vuelo, o cualquier código
de este lado le escriba al cliente por el número compartido mientras no es
nuestro turno, y el cliente reciba dos bots de negocios distintos por el
mismo chat. Se resuelve con una variable, `BOT_ACTIVE`, apagada por defecto,
comprobada en el **único** camino de salida (`services/whatsapp/client.ts`,
RN-05) antes que cualquier otra cosa — incluso antes de la ventana de 24 h.
Con `BOT_ACTIVE=false` ningún envío sale, así el proceso siga corriendo.

**Por qué ahí y no en el webhook.** Bloquear la entrada no hace falta —
nginx ya no nos manda nada cuando no es nuestro turno—, y bloquearla igual
sería redundante. Lo único que de verdad puede fallar es la salida, así que
el candado vive donde se puede fallar.

**Consecuencia.** Las credenciales de Meta (`WHATSAPP_*`) son las mismas que
usa Qanelo y no las genera ni las rota este proyecto — pedirlas prestadas es
la única vía. Activar este bot en el número compartido son dos pasos
independientes que alguien tiene que coordinar: (1) `BOT_ACTIVE="true"` en
las variables de este proyecto, y (2) el interruptor de nginx apuntando acá
(fuera de este repo). El orden importa: `BOT_ACTIVE` se prende ANTES de
pedir la rotación de nginx, nunca después — si nginx apunta acá y
`BOT_ACTIVE` sigue en `false`, el peor caso es que el bot se quede callado
un momento, que es seguro; el orden inverso no lo es. Al terminar la demo, se
apaga `BOT_ACTIVE` antes de devolver la rotación a Qanelo, por la misma
razón.
Además: al recuperar el turno, este bot puede recibir un mensaje de alguien a
mitad de una conversación con Qanelo, sin ningún contexto de ese lado — el
asesor (`bot/advisor.ts`) ya está diseñado para no asumir nunca, así que este
caso no exige código nuevo, solo tenerlo presente.
