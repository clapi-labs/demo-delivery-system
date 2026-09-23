/**
 * Punto de entrada de `npm run db:seed`.
 *
 * Vive aparte de `seed.ts` para que la lógica de siembra pueda importarse sin
 * disparar nada por accidente (un guardián basado en `argv[1]` se dispara
 * también con scripts de verificación que casualmente terminen igual).
 */
import { seedCatalog } from "./seed";

seedCatalog()
  .then(() => {
    console.log("Catálogo cargado.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
