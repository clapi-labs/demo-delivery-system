/**
 * Variables de entorno del menú.
 *
 * Mismo patrón que `apps/bot/src/env.ts`: se validan al leerlas, no al
 * importar el módulo, porque Next evalúa los módulos durante el build incluso
 * sin un request real.
 */

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${key}. Ver .env.example y docs/DEPLOYMENT.md.`,
    );
  }
  return value;
}

export const env = {
  /** Firma los links del menú. Idéntico en bot y menú, o el pedido no vuelve. */
  get menuTokenSecret() {
    return required("MENU_TOKEN_SECRET");
  },
  /** A dónde avisar cuando el cliente envía un pedido (RF-26). */
  get botUrl() {
    return required("BOT_URL");
  },
  get internalSecret() {
    return required("INTERNAL_SECRET");
  },
};
