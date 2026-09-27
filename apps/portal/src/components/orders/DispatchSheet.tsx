"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { COURIER_PAYMENT_LABEL, formatPhone, whatsappLink } from "@sistema/shared";

import { BikeIcon, BotIcon, CheckIcon, ChatIcon, StoreIcon } from "@/components/icons";
import { useLogistics } from "@/components/providers/LogisticsProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Sheet } from "@/components/Sheet";
import { Segmented, buttonPrimary, buttonSecondary, inputClass } from "@/components/ui";
import { NOTIFY_REASON, courierGroups, type Courier, type CourierPayment, type NotifyResult } from "@/lib/logistics";
import { customerLabel, type PortalOrder } from "@/lib/orders";

/**
 * Asignar quién lleva el pedido (RF-50 a RF-52).
 *
 * Dos caminos en la misma hoja, porque el restaurante trabaja de las dos
 * maneras el mismo día:
 *
 * - **Propio**: el sistema le manda la ficha por WhatsApp y él marca la
 *   entrega desde su link. Si la ventana de 24 h está cerrada —el caso normal
 *   con alguien que nunca le escribió al bot— se ofrece el mismo atajo de las
 *   agencias en vez de un error.
 * - **Agencia**: el sistema NO escribe. Redacta la ficha y abre el chat de la
 *   agencia con el texto puesto; el cajero solo da enviar (ADR-12).
 *
 * El paso final es el mismo en los dos: anotar la moto si la agencia la dice y
 * marcar *En camino*, que es lo que dispara el aviso al cliente (RF-30).
 */

type Props = {
  order: PortalOrder;
  open: boolean;
  onClose: () => void;
  /** Mover el pedido a "Enviado": el aviso al cliente sale de ahí. */
  onDispatch: () => void;
};

export function DispatchSheet({ order, open, onClose, onDispatch }: Props) {
  const { couriers, assign, setVehicle, notify, ticketFor } = useLogistics();
  const toast = useToast();

  const groups = courierGroups(couriers.filter((c) => c.active));
  const assignedKind = order.delivery?.kind;

  // El estado arranca donde está el pedido, y **no se reinicia con un
  // efecto**: la hoja se vuelve a montar en cada apertura (la comanda le
  // cambia la `key`), así que estos valores iniciales ya son los correctos.
  const assigned = order.delivery;
  const [kind, setKind] = useState<"internal" | "agency">(assignedKind ?? "internal");
  const [courierId, setCourierId] = useState<number | null>(assigned?.courierId ?? null);
  const [payment, setPayment] = useState<CourierPayment>(assigned?.paymentMode ?? "cash_base");
  const [vehicle, setVehicleCode] = useState(assigned?.vehicleCode ?? "");
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState("");
  const [result, setResult] = useState<NotifyResult | null>(null);
  /** `true` cuando el cajero pide cambiar de repartidor uno ya asignado. */
  const [reassigning, setReassigning] = useState(false);

  // Si el pedido ya tiene repartidor, se le pide su ficha al servidor: el
  // texto lleva datos del negocio que el navegador no tiene, y con ella se
  // puede reabrir el atajo de WhatsApp sin reasignar nada.
  useEffect(() => {
    if (!open || !assigned) return;
    let alive = true;
    ticketFor(order).then(({ ticket: text, courierGone }) => {
      // Si al repartidor lo borraron de la libreta, no hay ficha que mostrar:
      // la hoja se queda en el paso de elegir, que es lo que toca hacer.
      if (alive && !courierGone) setTicket(text);
    });
    return () => {
      alive = false;
    };
  }, [open, order, assigned, ticketFor]);

  const list = kind === "internal" ? groups.internal : groups.agency;
  const chosen = list.find((c) => c.id === courierId) ?? null;
  const ready = Boolean(ticket && chosen) && !reassigning;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ message: "Ficha copiada", description: "Pégala en el chat de la agencia." });
    } catch {
      toast({
        message: "El navegador no dejó copiar",
        description: "Selecciona el texto de la ficha y cópialo a mano.",
      });
    }
  };

  const doAssign = async () => {
    if (!chosen) return;
    setBusy(true);
    setReassigning(false);
    const text = await assign(order, chosen, {
      paymentMode: chosen.kind === "agency" ? payment : null,
      vehicleCode: vehicle || null,
    });
    if (!text) {
      setBusy(false);
      return;
    }
    setTicket(text);

    // Al propio se le intenta avisar solo; a la agencia le escribe el
    // restaurante desde su WhatsApp, así que no hay nada que intentar.
    if (chosen.kind === "internal") {
      const sent = await notify(order, chosen);
      setResult(sent);
      if (sent.sent) {
        toast({ message: `${chosen.name} ya tiene la ficha`, description: "Le llegó por WhatsApp." });
      }
    }
    setBusy(false);
  };

  const saveVehicle = async () => {
    await setVehicle(order, vehicle);
    toast({ message: vehicle ? `Moto ${vehicle} anotada` : "Se quitó el número de la moto" });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={ready ? "Ya tiene repartidor" : "Asignar repartidor"}
      subtitle={
        <>
          Pedido <span className="font-mono">#{order.code}</span> · {customerLabel(order)}
        </>
      }
      footer={
        ready ? (
          <div className="flex gap-2">
            <button onClick={onClose} className={`${buttonSecondary} flex-1`}>
              Cerrar
            </button>
            {order.status === "pending" || order.status === "preparing" ? (
              <button
                onClick={() => {
                  onDispatch();
                  onClose();
                }}
                className={`${buttonPrimary} flex-1`}
              >
                <BikeIcon className="h-4 w-4" />
                En camino
              </button>
            ) : null}
          </div>
        ) : (
          <button onClick={doAssign} disabled={!chosen || busy} className={`${buttonPrimary} w-full`}>
            {busy ? "Asignando…" : chosen ? `Asignar a ${chosen.name}` : "Elige quién lo lleva"}
          </button>
        )
      }
    >
      {ready && chosen ? (
        <Assigned
          courier={chosen}
          ticket={ticket}
          result={result}
          vehicle={vehicle}
          onVehicle={setVehicleCode}
          onSaveVehicle={saveVehicle}
          onCopy={() => copy(ticket)}
          onChange={() => setReassigning(true)}
        />
      ) : (
        <div className="space-y-5">
          <Segmented<"internal" | "agency">
            value={kind}
            onChange={(v) => {
              setKind(v);
              setCourierId(null);
            }}
            className="w-full"
            options={[
              { value: "internal", label: "Propio", count: groups.internal.length },
              { value: "agency", label: "Flota externa", count: groups.agency.length },
            ]}
          />

          {list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-2">
              <p className="font-medium text-ink">
                {kind === "internal" ? "No hay domiciliarios propios" : "No hay flotas registradas"}
              </p>
              <p className="mt-1">
                Regístralos una vez en Domicilios y quedan disponibles para todos los pedidos.
              </p>
              <Link href="/domicilios" onClick={onClose} className={`${buttonSecondary} mt-3`}>
                Ir a Domicilios
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {list.map((courier) => (
                <li key={courier.id}>
                  <label
                    className={`ease-ui flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                      courierId === courier.id
                        ? "border-brand bg-brand-soft"
                        : "border-line bg-surface hover:bg-sunken"
                    }`}
                  >
                    <input
                      type="radio"
                      name="courier"
                      checked={courierId === courier.id}
                      onChange={() => setCourierId(courier.id)}
                      className="sr-only"
                    />
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        courier.kind === "agency" ? "bg-st-sent-soft text-st-sent-ink" : "bg-sunken text-ink-2"
                      }`}
                    >
                      {courier.kind === "agency" ? <StoreIcon className="h-4 w-4" /> : <BikeIcon className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{courier.name}</span>
                      <span className="block truncate text-xs tabular-nums text-ink-3">
                        {formatPhone(courier.phone)}
                        {courier.notes ? ` · ${courier.notes}` : ""}
                      </span>
                    </span>
                    {courierId === courier.id ? <CheckIcon className="h-5 w-5 shrink-0 text-brand-ink" /> : null}
                  </label>
                </li>
              ))}
            </ul>
          )}

          {kind === "agency" && list.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Cómo cobra</p>
              <div className="mt-2">
                <Segmented<CourierPayment>
                  value={payment}
                  onChange={setPayment}
                  size="sm"
                  className="w-full"
                  options={[
                    { value: "cash_base", label: "Base en efectivo" },
                    { value: "account", label: "A cuenta" },
                  ]}
                />
              </div>
              <p className="mt-2 text-xs text-ink-2">
                {payment === "cash_base"
                  ? "La ficha le dice cuánto cobrar exacto, para que lleve el cambio."
                  : "La ficha le dice que no cobre: queda a la cuenta de la agencia."}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}

/** El segundo paso: qué hacer ahora que ya está asignado. */
function Assigned({
  courier,
  ticket,
  result,
  vehicle,
  onVehicle,
  onSaveVehicle,
  onCopy,
  onChange,
}: {
  courier: Courier;
  ticket: string;
  result: NotifyResult | null;
  vehicle: string;
  onVehicle: (value: string) => void;
  onSaveVehicle: () => void;
  onCopy: () => void;
  onChange: () => void;
}) {
  const sent = result?.sent === true;
  const failure = result && !result.sent ? result.reason : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl bg-sunken p-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            courier.kind === "agency" ? "bg-st-sent-soft text-st-sent-ink" : "bg-surface text-ink-2 shadow-sm"
          }`}
        >
          {courier.kind === "agency" ? <StoreIcon className="h-5 w-5" /> : <BikeIcon className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold tracking-title">{courier.name}</p>
          <p className="truncate text-xs tabular-nums text-ink-3">{formatPhone(courier.phone)}</p>
        </div>
        <button
          onClick={onChange}
          className="ease-ui shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface hover:text-ink"
        >
          Cambiar
        </button>
      </div>

      {/* Qué pasó con el aviso automático. Solo aplica al propio. */}
      {courier.kind === "internal" ? (
        sent ? (
          <p className="flex items-start gap-2 rounded-xl bg-ok-soft p-3 text-sm text-ok-ink">
            <BotIcon className="h-4 w-4 shrink-0 translate-y-0.5" />
            <span>
              Le llegó la ficha por WhatsApp, con el enlace para marcar la entrega él mismo.
            </span>
          </p>
        ) : failure ? (
          <p className="rounded-xl bg-warn-soft p-3 text-sm text-warn-ink">{NOTIFY_REASON[failure]}</p>
        ) : null
      ) : (
        <p className="text-sm text-ink-2">
          El sistema no le escribe a la agencia: la ficha se abre en <strong>tu</strong> WhatsApp con
          todo puesto y tú solo le das enviar.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href={whatsappLink(courier.phone, ticket)}
          target="_blank"
          rel="noreferrer"
          className={`${buttonSecondary} flex-1 text-whatsapp-ink ring-whatsapp/40 hover:bg-whatsapp-soft`}
        >
          <ChatIcon className="h-4 w-4" />
          {courier.kind === "agency" ? "Abrir el chat" : "Mandársela yo"}
        </a>
        <button onClick={onCopy} className={`${buttonSecondary} flex-1`}>
          Copiar ficha
        </button>
      </div>

      {/* La ficha a la vista: el cajero tiene que poder leer lo que va a
          mandar antes de mandarlo. */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">La ficha</p>
        <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-sunken p-3 font-sans text-[13px] leading-relaxed text-ink-2">
          {ticket}
        </pre>
      </div>

      {courier.kind === "agency" ? (
        <div>
          <label htmlFor="moto" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            Número de la moto
          </label>
          <p className="mt-1 text-xs text-ink-2">
            Cuando la agencia conteste “va la moto M-12”, anótalo acá: queda en el pedido y en el
            cierre del turno.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              id="moto"
              value={vehicle}
              onChange={(e) => onVehicle(e.target.value)}
              placeholder="M-12"
              className={inputClass}
            />
            <button onClick={onSaveVehicle} className={buttonSecondary}>
              Guardar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
