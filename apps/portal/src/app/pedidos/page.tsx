import { OrdersBoard, type OrdersTab } from "@/components/orders/OrdersBoard";

const TABS: OrdersTab[] = ["all", "pending", "preparing", "sent", "delivered"];

/**
 * `?estado=pending` abre una pestaña; `?pedido=K3M9QZ` busca ese pedido y lo
 * abre (es a donde lleva "Ver detalle" desde el Inicio).
 */
export default async function PedidosPage({ searchParams }: PageProps<"/pedidos">) {
  const { estado, pedido } = await searchParams;
  const tab = TABS.find((t) => t === estado) ?? "all";
  const code = typeof pedido === "string" ? pedido.replace(/[^A-Za-z0-9]/g, "").toUpperCase() : "";

  // La `key` hace que un enlace nuevo (otra pestaña u otro pedido) reinicie
  // el tablero aunque ya estuviera montado.
  return <OrdersBoard key={`${tab}-${code}`} initialTab={code ? "all" : tab} initialQuery={code} />;
}
