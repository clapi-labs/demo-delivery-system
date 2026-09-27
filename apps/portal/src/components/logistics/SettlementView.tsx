"use client";

import { useEffect, useState } from "react";

import { formatCOP } from "@sistema/shared";

import { BikeIcon, ReceiptIcon, StoreIcon } from "@/components/icons";
import { useLogistics } from "@/components/providers/LogisticsProvider";
import { EmptyState, Skeleton } from "@/components/ui";
import type { Settlement } from "@/lib/logistics";

/**
 * El cierre de turno (RF-54).
 *
 * Responde la pregunta que hoy se contesta de memoria al cerrar: **a quién le
 * debo qué**. Se cuenta sobre lo entregado, no sobre lo asignado — un pedido
 * que salió y volvió no se le liquida a nadie — y separa el efectivo que el
 * mensajero recogió del cliente de lo que queda a la cuenta de la agencia,
 * que son dos platas distintas.
 */

export function SettlementView() {
  const { settlement } = useLogistics();
  const [rows, setRows] = useState<Settlement[] | null>(null);

  useEffect(() => {
    let alive = true;
    settlement()
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [settlement]);

  if (rows === null) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState icon={<ReceiptIcon />} title="Todavía no hay entregas hoy">
        Cuando asignes pedidos, acá aparece cuánto llevó cada uno y cómo se cobra.
      </EmptyState>
    );
  }

  const totals = rows.reduce(
    (sum, r) => ({
      delivered: sum.delivered + r.delivered,
      pending: sum.pending + r.pending,
      total: sum.total + r.total,
      cash: sum.cash + r.cash,
      account: sum.account + r.account,
    }),
    { delivered: 0, pending: 0, total: 0, cash: 0, account: 0 },
  );

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {rows.map((row) => (
          <li key={`${row.kind}:${row.courierName}`} className="card p-4">
            <div className="flex items-start gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  row.kind === "agency" ? "bg-st-sent-soft text-st-sent-ink" : "bg-sunken text-ink-2"
                }`}
              >
                {row.kind === "agency" ? <StoreIcon className="h-5 w-5" /> : <BikeIcon className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold tracking-title">{row.courierName}</p>
                <p className="text-sm text-ink-2">
                  {row.delivered} {row.delivered === 1 ? "entrega" : "entregas"}
                  {row.pending > 0 ? ` · ${row.pending} en la calle` : ""}
                </p>
              </div>
              <p className="shrink-0 text-lg font-semibold tabular-nums tracking-title">
                {formatCOP(row.total)}
              </p>
            </div>

            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm tabular-nums">
              <div className="flex justify-between text-ink-2">
                <dt>Recogió en efectivo</dt>
                <dd className="font-medium text-ink">{formatCOP(row.cash)}</dd>
              </div>
              {row.kind === "agency" ? (
                <div className="flex justify-between text-ink-2">
                  <dt>A cuenta de la agencia</dt>
                  <dd className="font-medium text-ink">{formatCOP(row.account)}</dd>
                </div>
              ) : null}
            </dl>
          </li>
        ))}
      </ul>

      <div className="card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Todo el turno</p>
        <dl className="mt-2 space-y-1 text-sm tabular-nums">
          <div className="flex justify-between text-ink-2">
            <dt>Entregas</dt>
            <dd className="font-medium text-ink">{totals.delivered}</dd>
          </div>
          {totals.pending > 0 ? (
            <div className="flex justify-between text-ink-2">
              <dt>Todavía en la calle</dt>
              <dd className="font-medium text-ink">{totals.pending}</dd>
            </div>
          ) : null}
          <div className="flex justify-between text-ink-2">
            <dt>Efectivo recogido</dt>
            <dd className="font-medium text-ink">{formatCOP(totals.cash)}</dd>
          </div>
          {totals.account > 0 ? (
            <div className="flex justify-between text-ink-2">
              <dt>A cuenta de agencias</dt>
              <dd className="font-medium text-ink">{formatCOP(totals.account)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-line pt-1.5 font-semibold text-ink">
            <dt>Vendido y entregado</dt>
            <dd>{formatCOP(totals.total)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
