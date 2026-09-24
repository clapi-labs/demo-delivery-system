import { BUSINESS, verifyMenuToken } from "@sistema/shared";
import { getCatalog, getPromotions } from "@sistema/shared/db";

import { MenuApp } from "@/components/menu/MenuApp";
import { env } from "@/env";
import { parseAddParam } from "@/lib/cart";

type SearchParams = { t?: string; q?: string; add?: string };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { t, q, add } = await searchParams;

  const [catalog, promotions, payload] = await Promise.all([
    getCatalog(),
    getPromotions(),
    Promise.resolve(t ? verifyMenuToken(t, env.menuTokenSecret) : null),
  ]);

  return (
    <MenuApp
      catalog={catalog}
      promotions={promotions}
      initialQuery={q ?? ""}
      initialAdd={parseAddParam(add)}
      token={payload ? (t ?? null) : null}
      business={{
        name: BUSINESS.name,
        tagline: BUSINESS.tagline,
        hours: BUSINESS.hours,
        address: BUSINESS.address,
        deliveryFee: BUSINESS.deliveryFee,
        whatsappNumber: BUSINESS.whatsappNumber,
      }}
    />
  );
}
