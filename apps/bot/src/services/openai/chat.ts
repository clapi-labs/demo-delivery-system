import { env } from "@/env";

/**
 * El modelo de conversación (RF-13, ADR-08).
 *
 * `gpt-4o-mini` con *tool calling*. Un solo proveedor a propósito — ADR-08 ya
 * decidió OpenAI, así que no hace falta la capa de abstracción multi-proveedor
 * que tendría sentido si eso siguiera abierto.
 *
 * **Nunca lanza.** Devuelve `null` si falta la API key, si OpenAI responde
 * mal, o si la llamada falla por cualquier razón — quien llama responde con
 * el texto fijo de RF-17. Un bot mudo delante de un cliente real es peor que
 * uno que a veces dice "no te entendí".
 */

export type LlmTool = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type LlmResult =
  | { kind: "text"; text: string }
  | { kind: "tool"; name: string; input: Record<string, unknown> };

const MAX_TOKENS = 400;

export function isLlmConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function askLlm(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  tools: LlmTool[],
): Promise<LlmResult | null> {
  if (!isLlmConfigured()) return null;

  try {
    return await callOpenAi(system, messages, tools);
  } catch (error) {
    console.error("[chat] falló la llamada a OpenAI:", error);
    return null;
  }
}

async function callOpenAi(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  tools: LlmTool[],
): Promise<LlmResult | null> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.openai.apiKey}`,
    },
    body: JSON.stringify({
      model: env.openai.chatModel,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "system", content: system }, ...messages],
      tools: tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI respondió ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  if (!message) return null;

  const call = message.tool_calls?.[0];
  if (call) {
    return {
      kind: "tool",
      name: call.function.name,
      input: JSON.parse(call.function.arguments || "{}"),
    };
  }

  return message.content?.trim()
    ? { kind: "text", text: message.content.trim() }
    : null;
}
