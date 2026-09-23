export { db, schema } from "./client";
export * from "./schema";
export * from "./queries/catalog";
export { seedCatalog } from "./seed";
export { CATALOG } from "./seed-data";
export type {
  SeedCategory,
  SeedProduct,
  SeedOptionGroup,
  SeedOption,
} from "./seed-data";
