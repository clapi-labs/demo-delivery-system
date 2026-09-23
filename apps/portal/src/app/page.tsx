import Link from "next/link";

import { formatCOP, formatPhone } from "@sistema/shared";

import { StatusBadge } from "@/components/StatusBadge";
import { getPortalOrders } from "@/db/orders";
import { minutesSince, relativeTime } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

/** Medianoche de hoy en la zona del negocio, para "pedidos de hoy". */
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default async function DashboardPage() {
  const orders = await getPortalOrders();

  const today = startOfToday();
  const todayOrders = orders.filter((o) => new Date(o.createdAt) >= today);
  const salesToday = todayOrders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total, 0);
  const pending = orders.filter((o) => o.status === "pending").length;
  const inProgress = orders.filter(
    (o) => o.status === "preparing" || o.status === "sent",
  ).length;

  const metrics = [
    { label: "Pedidos hoy", value: String(todayOrders.length) },
    { label: "Ventas hoy", value: formatCOP(salesToday) },
    { label: "Pedidos nuevos", value: String(pending) },
    { label: "En curso", value: String(inProgress) },
  ];

  const recent = orders.slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="text-xl font-semibold">Inicio</h1>
      <p className="mt-1 text-sm text-muted-foreground">Resumen del restaurante hoy.</p>

      <div className="mt-8 flex divide-x divide-border border-y border-border">
        {metrics.map((m) => (
          <div key={m.label} className="flex-1 px-6 py-5 first:pl-0">
            <p className="eyebrow">{m.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Pedidos recientes</h2>
          <Link href="/pedidos" className="text-sm text-primary hover:underline">
            Ver todos
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="mt-6 rounded-md border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Todavía no hay pedidos. Cuando un cliente envíe el suyo desde el menú, aparece
            acá solo.
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 font-medium">Pedido</th>
                <th className="py-2 font-medium">Cliente</th>
                <th className="py-2 font-medium">Total</th>
                <th className="py-2 font-medium">Estado</th>
                <th className="py-2 text-right font-medium">Hora</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-0">
                  <td className="py-3 font-medium">{order.code}</td>
                  <td className="py-3">
                    {order.customerName ??
                      (order.phone ? formatPhone(order.phone) : "Sin nombre")}
                  </td>
                  <td className="py-3 tabular-nums">{formatCOP(order.total)}</td>
                  <td className="py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="py-3 text-right text-muted-foreground">
                    {relativeTime(minutesSince(order.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
