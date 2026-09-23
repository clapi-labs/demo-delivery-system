import nextConfig from "eslint-config-next";

/**
 * `eslint-config-next` ya exporta flat config nativo en Next 16 — se importa
 * directo, sin `FlatCompat`. Pasar por `FlatCompat` (el patrón que genera
 * `create-next-app` en algunas plantillas) carga una segunda copia de
 * `eslint-plugin-react` vía resolución de módulos "legacy" y esa duplicada
 * termina con una referencia circular al validar el esquema.
 */
const config = [...nextConfig];

export default config;
