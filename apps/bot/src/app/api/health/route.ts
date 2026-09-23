import { assertEnv, env } from "@/env";

export const dynamic = "force-dynamic";

/**
 * Healthcheck del despliegue.
 *
 * Existe por una razón concreta: en serverless, un despliegue al que le falta
 * una variable de entorno **levanta bien** y solo falla cuando llega el primer
 * mensaje real. Esto lo hace visible de inmediato.
 *
 * También expone `botActive` (ADR-11): quien administra la rotación del
 * número compartido puede comprobar acá mismo si el candado de salida está
 * prendido o apagado, sin tener acceso a las variables de Vercel.
 *
 * Solo dice QUÉ falta o el estado del candado, nunca el valor de un secreto.
 */
export async function GET() {
  const { ok, missing } = assertEnv();

  return Response.json(
    { ok, missing, botActive: env.botActive, checkedAt: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
