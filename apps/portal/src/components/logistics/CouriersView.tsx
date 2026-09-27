"use client";

import { useState } from "react";

import { COURIER_PAYMENT_LABEL, formatPhone } from "@sistema/shared";

import { BikeIcon, BotIcon, InfoIcon, PhoneIcon, PlusIcon, StoreIcon, TrashIcon } from "@/components/icons";
import { useLogistics } from "@/components/providers/LogisticsProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Sheet } from "@/components/Sheet";
import {
  EmptyState,
  Field,
  Segmented,
  Switch,
  buttonBrand,
  buttonSecondary,
  inputClass,
} from "@/components/ui";
import { courierGroups, type Courier, type CourierKind, type CourierPayment } from "@/lib/logistics";

/**
 * La libreta de repartidores (RF-49).
 *
 * Se registra una vez y queda disponible para todos los pedidos. Dos grupos
 * porque son dos formas distintas de trabajar, no dos nombres del mismo:
 * al **propio** el sistema le manda la ficha y él marca la entrega; a la
 * **flota** le escribe el restaurante desde su WhatsApp (ADR-12).
 *
 * Desactivar en vez de borrar es lo normal: un domiciliario de vacaciones
 * vuelve, y borrarlo obligaría a registrarlo otra vez. Borrar existe para el
 * que ya no trabaja ahí — y no se lleva su arqueo, que queda con el nombre
 * congelado en cada entrega.
 */

const BLANK: Omit<Courier, "driverUrl"> = {
  id: 0,
  kind: "internal",
  name: "",
  phone: "",
  paymentMode: null,
  notes: null,
  active: true,
  sortOrder: 0,
};

export function CouriersView() {
  const { couriers, loading, linksReady, saveCourier, toggleCourier, deleteCourier } = useLogistics();
  const [editing, setEditing] = useState<Omit<Courier, "driverUrl"> | null>(null);
  const [openings, setOpenings] = useState(0);

  const groups = courierGroups(couriers);

  const edit = (courier: Omit<Courier, "driverUrl">) => {
    setOpenings((n) => n + 1);
    setEditing(courier);
  };

  return (
    <div className="space-y-6">
      {!linksReady ? (
        <p className="flex items-start gap-2 rounded-xl bg-warn-soft p-3 text-sm text-warn-ink">
          <InfoIcon className="h-4 w-4 shrink-0 translate-y-0.5" />
          <span>
            Falta <code className="font-mono">COURIER_TOKEN_SECRET</code> (o{" "}
            <code className="font-mono">MENU_TOKEN_SECRET</code>) en el entorno del portal, así que
            todavía no se puede generar el link de la pantalla de cada domiciliario. Todo lo demás
            funciona.
          </span>
        </p>
      ) : null}

      <div className="flex justify-end">
        <button onClick={() => edit(BLANK)} className={buttonBrand}>
          <PlusIcon className="h-4 w-4" />
          Registrar
        </button>
      </div>

      {loading && couriers.length === 0 ? (
        <p className="text-sm text-ink-3">Cargando…</p>
      ) : couriers.length === 0 ? (
        <EmptyState icon={<BikeIcon />} title="Todavía no hay a quién asignarle un domicilio">
          Registra a tus domiciliarios y a la flota que llamas cuando se te llena la cocina. Después,
          asignar un pedido son dos toques.
        </EmptyState>
      ) : (
        <>
          <Group
            title="Domiciliarios propios"
            hint="El sistema les manda la ficha por WhatsApp y ellos marcan la entrega desde su link."
            couriers={groups.internal}
            onEdit={edit}
            onToggle={toggleCourier}
            onDelete={deleteCourier}
          />
          <Group
            title="Flotas externas"
            hint="El sistema no les escribe: te abre el chat con la ficha puesta y tú le das enviar."
            couriers={groups.agency}
            onEdit={edit}
            onToggle={toggleCourier}
            onDelete={deleteCourier}
          />
        </>
      )}

      <CourierSheet
        key={openings}
        courier={editing}
        onClose={() => setEditing(null)}
        onSave={async (courier) => {
          const saved = await saveCourier(courier);
          if (saved) setEditing(null);
        }}
      />
    </div>
  );
}

function Group({
  title,
  hint,
  couriers,
  onEdit,
  onToggle,
  onDelete,
}: {
  title: string;
  hint: string;
  couriers: Courier[];
  onEdit: (courier: Courier) => void;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  if (couriers.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold tracking-title">{title}</h2>
      <p className="mt-0.5 text-sm text-ink-2">{hint}</p>
      <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {couriers.map((courier) => (
          <li key={courier.id}>
            <CourierCard courier={courier} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CourierCard({
  courier,
  onEdit,
  onToggle,
  onDelete,
}: {
  courier: Courier;
  onEdit: (courier: Courier) => void;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);

  const copyLink = async () => {
    if (!courier.driverUrl) return;
    try {
      await navigator.clipboard.writeText(courier.driverUrl);
      toast({
        message: "Link copiado",
        description: `Mándaselo a ${courier.name} una vez: con ese link ve sus pedidos y marca las entregas.`,
      });
    } catch {
      toast({ message: "El navegador no dejó copiar", description: "Abre el link y compártelo desde ahí." });
    }
  };

  return (
    <div className={`card p-4 ${courier.active ? "" : "opacity-70"}`}>
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            courier.kind === "agency" ? "bg-st-sent-soft text-st-sent-ink" : "bg-sunken text-ink-2"
          }`}
        >
          {courier.kind === "agency" ? <StoreIcon className="h-5 w-5" /> : <BikeIcon className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold tracking-title">{courier.name}</p>
          <p className="flex items-center gap-1.5 truncate text-sm tabular-nums text-ink-2">
            <PhoneIcon className="h-3.5 w-3.5 shrink-0 text-ink-3" />
            {formatPhone(courier.phone)}
          </p>
          {courier.kind === "agency" && courier.paymentMode ? (
            <p className="mt-1 text-xs text-ink-3">{COURIER_PAYMENT_LABEL[courier.paymentMode]}</p>
          ) : null}
          {courier.notes ? <p className="mt-1 text-xs text-ink-3">{courier.notes}</p> : null}
        </div>
        <Switch
          checked={courier.active}
          onChange={() => onToggle(courier.id)}
          label={courier.active ? "Disponible" : "No disponible"}
          size="sm"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
        <button onClick={() => onEdit(courier)} className={`${buttonSecondary} h-9 px-3 text-xs`}>
          Editar
        </button>
        {courier.driverUrl ? (
          <button onClick={copyLink} className={`${buttonSecondary} h-9 px-3 text-xs`}>
            <BotIcon className="h-3.5 w-3.5" />
            Copiar su link
          </button>
        ) : null}
        {confirm ? (
          <span className="flex items-center gap-2">
            <button
              onClick={() => setConfirm(false)}
              className="ease-ui h-9 rounded-lg px-2.5 text-xs font-medium text-ink-2 hover:bg-sunken"
            >
              No
            </button>
            <button
              onClick={() => onDelete(courier.id)}
              className="ease-ui h-9 rounded-lg bg-danger px-3 text-xs font-medium text-white hover:brightness-95"
            >
              Sí, borrar
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="ease-ui ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-danger-ink hover:bg-danger-soft"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Borrar
          </button>
        )}
      </div>
    </div>
  );
}

/** El editor. `courier.id === 0` es uno nuevo. */
function CourierSheet({
  courier,
  onClose,
  onSave,
}: {
  courier: Omit<Courier, "driverUrl"> | null;
  onClose: () => void;
  onSave: (courier: Omit<Courier, "driverUrl">) => void;
}) {
  const [draft, setDraft] = useState(courier ?? BLANK);
  const set = (patch: Partial<Omit<Courier, "driverUrl">>) => setDraft((d) => ({ ...d, ...patch }));

  const digits = draft.phone.replace(/\D/g, "");
  // Un repartidor sin teléfono no se puede despachar, y guardarlo a medias es
  // un registro que falla justo cuando hay prisa.
  const valid = draft.name.trim().length > 1 && digits.length >= 10;

  return (
    <Sheet
      open={courier !== null}
      onClose={onClose}
      title={draft.id ? draft.name || "Editar" : "Registrar repartidor"}
      subtitle="Se registra una vez y queda para todos los pedidos."
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className={`${buttonSecondary} flex-1`}>
            Cancelar
          </button>
          <button
            onClick={() => onSave({ ...draft, phone: digits })}
            disabled={!valid}
            className={`${buttonBrand} flex-1`}
          >
            Guardar
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Tipo">
          <Segmented<CourierKind>
            value={draft.kind}
            onChange={(kind) =>
              set({ kind, paymentMode: kind === "agency" ? (draft.paymentMode ?? "cash_base") : null })
            }
            className="w-full"
            options={[
              { value: "internal", label: "Propio" },
              { value: "agency", label: "Flota externa" },
            ]}
          />
        </Field>

        <Field label="Nombre">
          <input
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={draft.kind === "agency" ? "Bejarano Mensajería" : "Carlos Pérez"}
            className={inputClass}
          />
        </Field>

        <Field
          label="WhatsApp"
          hint="Con indicativo del país y sin espacios. Es el número al que se le manda la ficha."
        >
          <input
            value={draft.phone}
            onChange={(e) => set({ phone: e.target.value })}
            inputMode="tel"
            placeholder="573001112233"
            className={`${inputClass} tabular-nums`}
          />
        </Field>

        {draft.kind === "agency" ? (
          <Field label="Cómo cobra" hint="Es lo que se le dice en la ficha de cada pedido.">
            <Segmented<CourierPayment>
              value={draft.paymentMode ?? "cash_base"}
              onChange={(paymentMode) => set({ paymentMode })}
              className="w-full"
              options={[
                { value: "cash_base", label: "Base en efectivo" },
                { value: "account", label: "A cuenta" },
              ]}
            />
          </Field>
        ) : null}

        <Field label="Notas" hint="Turno, placa, tarifa acordada… lo que te sirva recordar.">
          <input
            value={draft.notes ?? ""}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Turno de la tarde"
            className={inputClass}
          />
        </Field>

        <Switch
          checked={draft.active}
          onChange={(active) => set({ active })}
          label="Disponible para asignar"
        />
      </div>
    </Sheet>
  );
}
