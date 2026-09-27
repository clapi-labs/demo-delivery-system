"use client";

import { useCallback, useEffect, useState } from "react";

import { formatCOP, formatPhone, mapsLink } from "@sistema/shared";

import { BikeIcon, CheckIcon, MapIcon, PhoneIcon } from "@/components/icons";
import { useToast } from "@/components/providers/ToastProvider";
import { Skeleton, buttonPrimary, buttonSecondary } from "@/components/ui";

/**
 * Los pedidos de un domiciliario, en su celular (RF-53).
 *
 * Está pensada para usarse con una mano, en la calle y con sol: pocas cosas,
 * grandes, y lo que hay que hacer siempre visible. Tres datos por pedido —a
 * dónde va, a quién, cuánto cobra— y un botón.
 *
 * Marcar entregado pasa por el mismo camino que el tablero del restaurante,
 * así que el cliente recibe su aviso de WhatsApp igual que si lo hubiera
 * marcado el cajero. Eso es todo el punto: que el domiciliario no tenga que
 * llamar al local para que alguien mueva la comanda.
 */

type Task = {
  orderId: number;
  code: string;
  customerName: string | null;
  phone: string | null;
  address: string | null;
  addressNotes: string | null;
  total: number;
  paymentMethod: string | null;
  status: string;
  deliveredAt: string | null;
};

type State =
  | { kind: "loading" }
  | { kind: "error"; reason: "bad_token" | "no_secret" | "network" }
  | { kind: "ready"; courier: { name: string }; tasks: Task[] };

export function DriverBoard({ token }: { token: string }) {
  const toast = useToast();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setState({ kind: "error", reason: "bad_token" });
      return;
    }
    try {
      const res = await fetch(`/api/driver?t=${encodeURIComponent(token)}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; courier?: { name: string }; tasks?: Task[] }
        | null;

      if (!res.ok || !data?.courier) {
        const reason = data?.error === "no_secret" ? "no_secret" : "bad_token";
        setState({ kind: "error", reason });
        return;
      }
      setState({ kind: "ready", courier: data.courier, tasks: data.tasks ?? [] });
    } catch {
      setState({ kind: "error", reason: "network" });
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `load` es async; el setState ocurre después del `await`.
    load();
    // Cada minuto, no cada cinco segundos: esto corre con los datos del
    // celular de alguien que está manejando.
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const deliver = async (task: Task) => {
    setBusy(task.orderId);
    try {
      const res = await fetch("/api/driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, orderId: task.orderId, action: "deliver" }),
      });
      if (!res.ok) throw new Error("failed");
      toast({ message: `${task.code} entregado`, description: "El cliente ya recibió el aviso." });
      await load();
    } catch {
      toast({ message: "No se pudo marcar", description: "Revisa la señal e inténtalo otra vez." });
    } finally {
      setBusy(null);
    }
  };

  if (state.kind === "loading") {
    return (
      <div className="mx-auto max-w-lg space-y-3 px-4 py-6">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface text-ink-3 shadow-sm ring-1 ring-black/5">
          <BikeIcon className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-title">
          {state.reason === "network" ? "Sin conexión" : "Este link ya no sirve"}
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          {state.reason === "network"
            ? "Revisa la señal y vuelve a abrir el link."
            : "Pídele al restaurante que te mande uno nuevo: los links se vencen por seguridad."}
        </p>
      </div>
    );
  }

  // Cerrado es cerrado, lo haya marcado él o el restaurante desde el tablero:
  // si no se mira el estado del pedido, un pedido que el cajero ya cerró le
  // sigue apareciendo por entregar.
  const isDone = (t: Task) => Boolean(t.deliveredAt) || t.status === "delivered";
  const pending = state.tasks.filter((t) => !isDone(t));
  const done = state.tasks.filter(isDone);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <header>
        <p className="text-sm text-ink-2">Hola, {state.courier.name}</p>
        <h1 className="text-2xl font-semibold tracking-title">
          {pending.length === 0
            ? "No tienes pedidos pendientes"
            : `${pending.length} ${pending.length === 1 ? "pedido por entregar" : "pedidos por entregar"}`}
        </h1>
      </header>

      <ul className="mt-5 space-y-3">
        {pending.map((task) => (
          <li key={task.orderId} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-sm text-ink-3">#{task.code}</p>
              <p className="text-lg font-semibold tabular-nums tracking-title">{formatCOP(task.total)}</p>
            </div>

            <p className="mt-2 text-[17px] font-medium leading-snug">
              {task.address ?? "Sin dirección: llama al restaurante"}
            </p>
            {task.addressNotes ? <p className="mt-0.5 text-sm text-ink-2">{task.addressNotes}</p> : null}

            <p className="mt-2 text-sm text-ink-2">
              {task.customerName ?? "Cliente"}
              {" · "}
              {task.paymentMethod === "efectivo" || !task.paymentMethod ? (
                <strong className="text-ink">cobrar {formatCOP(task.total)} en efectivo</strong>
              ) : (
                <span>ya pagó por {task.paymentMethod}</span>
              )}
            </p>

            {/* `flex` y no `grid-cols-2`: un pedido sin teléfono deja un solo
                botón, y así ocupa el ancho entero en vez de media tarjeta. */}
            <div className="mt-3 flex gap-2">
              {task.address ? (
                <a
                  href={mapsLink(task.address)}
                  target="_blank"
                  rel="noreferrer"
                  className={`${buttonSecondary} flex-1 text-maps-ink ring-maps/40 hover:bg-maps-soft`}
                >
                  <MapIcon className="h-4 w-4" />
                  Mapa
                </a>
              ) : null}
              {task.phone ? (
                <a href={`tel:+${task.phone}`} className={`${buttonSecondary} flex-1`}>
                  <PhoneIcon className="h-4 w-4" />
                  Llamar
                </a>
              ) : null}
            </div>

            <button
              onClick={() => deliver(task)}
              disabled={busy === task.orderId}
              className={`${buttonPrimary} mt-2 w-full`}
            >
              <CheckIcon className="h-4 w-4" />
              {busy === task.orderId ? "Marcando…" : "Entregado"}
            </button>
          </li>
        ))}
      </ul>

      {done.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-ink-2">Entregados hoy ({done.length})</h2>
          <ul className="mt-2 space-y-2">
            {done.map((task) => (
              <li key={task.orderId} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-sm shadow-sm ring-1 ring-black/5">
                <CheckIcon className="h-4 w-4 shrink-0 text-ok-ink" />
                <span className="min-w-0 flex-1 truncate text-ink-2">
                  <span className="font-mono text-xs">#{task.code}</span> · {task.address ?? "sin dirección"}
                </span>
                <span className="shrink-0 tabular-nums text-ink-3">{formatCOP(task.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-8 text-center text-xs text-ink-3">
        Al marcar un pedido como entregado, el restaurante y el cliente se enteran solos.
        {state.tasks.some((t) => t.phone) ? " El teléfono del cliente es solo para la entrega." : ""}
      </p>
    </div>
  );
}
