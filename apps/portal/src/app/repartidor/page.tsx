import { DriverBoard } from "@/components/logistics/DriverBoard";

export const metadata = {
  title: "Mis domicilios",
  // Un link con token no tiene por qué aparecer en un buscador.
  robots: { index: false, follow: false },
};

/**
 * La pantalla del domiciliario (RF-53).
 *
 * **No es el portal del restaurante**: la abre el domiciliario en su celular
 * con el link que le mandaron, y solo ve sus pedidos del día y un botón para
 * marcar la entrega. Sin usuario ni contraseña — se lo autoriza el token
 * firmado del link (`courier-token.ts`), porque un domiciliario no va a
 * registrarse en nada y pedírselo es garantizar que siga llamando al local.
 *
 * `AppProviders` la deja fuera de los providers del portal a propósito: nadie
 * tiene que bajarle al teléfono la lista completa de pedidos ni los chats.
 */
export default async function RepartidorPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  return <DriverBoard token={typeof t === "string" ? t : ""} />;
}
