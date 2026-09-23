import Link from "next/link";

import { formatCOP } from "@sistema/shared";

import { StatusBadge } from "@/components/StatusBadge";
import { DASHBOARD_METRICS, DEMO_ORDERS, orderTotal, relativeTime } from "@/lib/demo-data";

const METRICS = [
  { label: "Pedidos hoy", value: String(DASHBOARD_METRICS.ordersToday) },
  { label: "Ventas hoy", value: formatCOP(DASHBOARD_METRICS.salesToday) },
  { label: "Pedidos pendientes", value: String(DASHBOARD_METRICS.pendingOrders) },
  { label: "Conversaciones activas", value: String(DASHBOARD_METRICS.activeConversations) },
];

export default function DashboardPage() {
  const recent = [...DEMO_ORDERS].sort((a, b) => a.minutesAgo - b.minutesAgo).slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="text-xl font-semibold">Inicio</h1>
      <p className="mt-1 text-sm text-muted-foreground">Resumen del restaurante hoy.</p>

      <div className="mt-8 flex divide-x divide-border border-y border-border">
        {METRICS.map((m) => (
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

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 font-medium">Pedido</th>
              <th className="py-2 font-medium">Cliente</th>
              <th className="py-2 font-medium">Total</th>
              <th className="py-2 font-medium">Estado</th>
              <th className="py-2 font-medium text-right">Hora</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((order) => (
              <tr key={order.id} className="border-b border-border last:border-0">
                <td className="py-3 font-medium">{order.code}</td>
                <td className="py-3">{order.customerName}</td>
                <td className="py-3 tabular-nums">{formatCOP(orderTotal(order))}</td>
                <td className="py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="py-3 text-right text-muted-foreground">
                  {relativeTime(order.minutesAgo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
