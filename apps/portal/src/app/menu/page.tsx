"use client";

import { useState } from "react";

import { ProductsView } from "@/components/menu/ProductsView";
import { PromotionsView } from "@/components/menu/PromotionsView";
import { useMenu } from "@/components/providers/MenuProvider";
import { PageHeader, Segmented } from "@/components/ui";

/**
 * El menú del restaurante: productos, disponibilidad y promociones.
 *
 * Frontend completo sobre datos en memoria; las escrituras ya pasan por
 * `src/lib/portal-api.ts`, que es donde se conecta la base.
 */
export default function MenuPage() {
  const { promotions } = useMenu();
  const [tab, setTab] = useState<"products" | "promotions">("products");

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 sm:px-6 sm:pb-10 lg:px-8 lg:pt-8">
      <PageHeader title="Menú" description="Lo que ven tus clientes cuando abren el link del menú." />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "products", label: "Productos" },
          { value: "promotions", label: "Promociones", count: promotions.filter((p) => p.active).length },
        ]}
        className="mt-5 sm:max-w-sm"
      />

      <div className="mt-5">{tab === "products" ? <ProductsView /> : <PromotionsView />}</div>
    </div>
  );
}
