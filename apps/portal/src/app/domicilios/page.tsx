"use client";

import { useState } from "react";

import { CouriersView } from "@/components/logistics/CouriersView";
import { SettlementView } from "@/components/logistics/SettlementView";
import { useLogistics } from "@/components/providers/LogisticsProvider";
import { PageHeader, Segmented } from "@/components/ui";

/**
 * Domicilios: quién reparte y cómo se liquida el turno (RF-49, RF-54).
 *
 * Dos pestañas porque son dos momentos distintos del día: la libreta se toca
 * cuando entra o sale alguien del equipo, y el cierre se mira al final del
 * turno.
 */
export default function DomiciliosPage() {
  const { couriers } = useLogistics();
  const [tab, setTab] = useState<"couriers" | "settlement">("couriers");

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-5 sm:px-6 sm:pb-8 lg:px-8 lg:pt-8">
      <PageHeader
        title="Domicilios"
        description="Tus domiciliarios y las flotas que llamas cuando se llena la cocina."
      />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "couriers", label: "Repartidores", count: couriers.filter((c) => c.active).length },
          { value: "settlement", label: "Cierre de turno" },
        ]}
        className="mt-5 sm:max-w-sm"
      />

      <div className="mt-5">{tab === "couriers" ? <CouriersView /> : <SettlementView />}</div>
    </div>
  );
}
