/**
 * Punto de entrada de `npm run db:seed`.
 *
 * Vive aparte de `seed.ts` para que la lógica de siembra pueda importarse sin
 * disparar nada por accidente (un guardián basado en `argv[1]` se dispara
 * también con scripts de verificación que casualmente terminen igual).
 */
import { seedCatalog, seedCouriers, seedPromotions } from "./seed";

// Las promociones van después del catálogo y en la misma corrida: apuntan a
// categorías y productos por id, y sembrar el catálogo los cambia.
seedCatalog()
  .then(seedPromotions)
  // La libreta de repartidores va aparte: siembra solo si está vacía, porque
  // la edita el restaurante y no se puede sobreescribir en cada corrida.
  .then(seedCouriers)
  .then((couriers) => {
    console.log(`Catálogo y promociones cargados. Repartidores sembrados: ${couriers.seeded}.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
