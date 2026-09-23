import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

/**
 * Conexión a la base, compartida por las tres apps.
 *
 * Dos drivers a propósito:
 *
 * - **Neon (HTTP)** en producción. Cada request es una llamada HTTP sin
 *   conexión persistente, así que funciones serverless que arrancan y mueren
 *   no pueden agotar el pool.
 * - **node-postgres (TCP)** contra un Postgres local en desarrollo, que es lo
 *   que permite levantar un contenedor y probar sin depender de la nube.
 *
 * El driver se elige por la forma de la cadena, no por `NODE_ENV`: así apuntar
 * a Neon desde local para reproducir algo sigue funcionando.
 */

type Database = NeonHttpDatabase<typeof schema>;

let instance: Database | null = null;

/**
 * Construye la conexión la PRIMERA vez que se usa, no al importar el módulo.
 *
 * Next.js recolecta metadatos de cada ruta durante el build —incluso las
 * dinámicas—, lo que ejecuta este módulo sin que exista `DATABASE_URL` en el
 * entorno de build. Validar al importar (como hacía la primera versión) hace
 * imposible compilar sin el secreto a mano, incluso en CI. Validar en el
 * primer uso real solo falla cuando de verdad hay un request que necesita la
 * base — el mismo criterio que `apps/bot/src/env.ts`.
 */
function getDb(): Database {
  if (instance) return instance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. Copia .env.example a .env.local y llénala.",
    );
  }

  const isNeon = url.includes("neon.tech");
  instance = (
    isNeon
      ? drizzleNeon(neon(url), { schema })
      : drizzlePg(new Pool({ connectionString: url }), { schema })
  ) as Database;

  return instance;
}

/**
 * Proxy: cada acceso a una propiedad (`db.select`, `db.insert`, …) dispara
 * `getDb()` primero. El resto del código sigue escribiendo `db.select()` tal
 * cual — no se entera de que la conexión se construyó tarde.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
