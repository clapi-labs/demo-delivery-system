import { BUSINESS, verifyMenuToken } from "@sistema/shared";
import { getCatalog } from "@sistema/shared/db";

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

  const [catalog, payload] = await Promise.all([
    getCatalog(),
    Promise.resolve(t ? verifyMenuToken(t, env.menuTokenSecret) : null),
  ]);

  return (
    <MenuApp
      catalog={catalog}
      initialQuery={q ?? ""}
      initialAdd={parseAddParam(add)}
      token={payload ? (t ?? null) : null}
      business={{
        name: BUSINESS.name,
        hours: BUSINESS.hours,
        address: BUSINESS.address,
        deliveryFee: BUSINESS.deliveryFee,
        whatsappNumber: BUSINESS.whatsappNumber,
      }}
    />
  );
}
