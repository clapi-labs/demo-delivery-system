import { Inbox } from "@/components/inbox/Inbox";

/**
 * `?tel=573001112233` abre directo el chat de ese cliente: es a donde lleva
 * "Ver chat" desde un pedido.
 */
export default async function ConversacionesPage({ searchParams }: PageProps<"/conversaciones">) {
  const { tel } = await searchParams;
  const initialPhone = typeof tel === "string" ? tel.replace(/\D/g, "") : undefined;

  // La `key` hace que un "Ver chat" desde otro pedido abra ese chat aunque
  // la bandeja ya estuviera montada.
  return <Inbox key={initialPhone ?? "all"} initialPhone={initialPhone} />;
}
