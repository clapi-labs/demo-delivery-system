import { BUSINESS } from "@sistema/shared";

import { Dashboard } from "@/components/dashboard/Dashboard";

/**
 * Inicio. Los datos del negocio salen del servidor (viven en variables de
 * entorno que el navegador no ve); todo lo demás se lee en vivo de los
 * mismos providers que usan Pedidos, Conversaciones y Menú.
 */
export default function DashboardPage() {
  return (
    <Dashboard
      business={{
        name: BUSINESS.name,
        opensAt: BUSINESS.opensAt,
        closesAt: BUSINESS.closesAt,
        timezone: BUSINESS.timezone,
      }}
    />
  );
}
