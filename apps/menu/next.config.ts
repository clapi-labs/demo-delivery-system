import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El paquete compartido se compila desde su fuente TypeScript, sin paso de
  // build propio: es lo que permite tocar el esquema y verlo en las tres apps
  // sin recompilar nada a mano.
  transpilePackages: ["@sistema/shared"],
};

export default nextConfig;
