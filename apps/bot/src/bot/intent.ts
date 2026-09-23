import { normalize } from "@sistema/shared";

/**
 * Detectores deterministas (RF-11, RF-12, ADR-09).
 *
 * Todo lo que se puede reconocer sin un modelo se reconoce sin un modelo: es
 * más rápido, más barato y no depende de que OpenAI esté arriba.
 *
 * El orden en que se consultan va **de lo más específico a lo más vago**, y no
 * es un detalle: "ayúdame a pedir" y "ayúdame" tienen que caer en sitios
 * distintos. Lo que las separa es si el cliente **nombró la cosa**.
 */

const has = (text: string, terms: string[]) => {
  const t = normalize(text);
  return terms.some((term) => t.includes(term));
};

export function isGreeting(text: string) {
  const t = normalize(text).trim();
  return /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|ola|q hubo|quiubo|buen dia)\b/.test(
    t,
  );
}

/** "mándame el menú", "la carta" */
export function isMenuRequest(text: string) {
  return has(text, ["menu", "menú", "la carta", "catalogo", "catálogo"]);
}

/**
 * "¿cómo pido?", "ayúdame a pedir".
 *
 * Exige un verbo de pedir cerca: sin eso, "cómo estás" entraría acá.
 */
export function isHowToOrderRequest(text: string) {
  const t = normalize(text);
  const asksHow = /\b(como|komo)\b/.test(t) || t.includes("ayudame a");
  const aboutOrdering = /\b(pido|pedir|ordeno|ordenar|compro|comprar|funciona)\b/.test(
    t,
  );
  return asksHow && aboutOrdering;
}

/**
 * "ayuda", "no entiendo", "soporte".
 *
 * **"ayuda con MI pedido" no entra acá**: el posesivo señala un pedido que ya
 * existe, o sea un problema, y eso va al modelo, que puede escalar. Es la
 * misma distinción del sistema real.
 */
export function isHelpRequest(text: string) {
  const t = normalize(text);
  if (/\bmi (pedido|orden|domicilio)\b/.test(t)) return false;
  if (isHowToOrderRequest(text)) return false;

  return has(text, [
    "ayuda",
    "ayudame",
    "no entiendo",
    "soporte",
    "estoy perdido",
  ]);
}

/** Pedir una persona explícitamente. Siempre escala (RF-28). */
export function isHumanRequest(text: string) {
  const t = normalize(text);
  return (
    /\b(hablar|habla|comunicar|pasame|pasar|atienda|atender)\b/.test(t) &&
    /\b(persona|humano|alguien|agente|asesor|operador|encargado|dueno|dueño)\b/.test(
      t,
    )
  );
}

/** El respaldo de siempre para que el asistente retome (RF-30). */
export function isResumeRequest(text: string) {
  return /^\s*reiniciar\s*$/i.test(text);
}

/** Preguntas del negocio que se contestan con datos fijos, sin modelo. */
export function isBusinessInfoRequest(text: string) {
  return has(text, [
    "horario",
    "a que hora",
    "estan abiertos",
    "están abiertos",
    "cuanto cobran el domicilio",
    "cuanto vale el domicilio",
    "pedido minimo",
    "pedido mínimo",
    "como pago",
    "cómo pago",
    "metodos de pago",
    "métodos de pago",
    "hacen domicilio",
    "a donde llegan",
    "cobertura",
  ]);
}
