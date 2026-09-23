import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/demo-data";

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  preparing: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  sent: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
  delivered: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  cancelled: "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
