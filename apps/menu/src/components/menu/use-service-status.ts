"use client";

import { useEffect, useState } from "react";

import { serviceStatus, type ServiceStatus } from "@/lib/service-status";

/**
 * `null` en el servidor y en el primer render del cliente: la hora del
 * servidor y la del visitante no tienen por qué coincidir, y pintar una y
 * luego otra rompe la hidratación. Se resuelve tras montar.
 */
export function useServiceStatus(): ServiceStatus | null {
  const [status, setStatus] = useState<ServiceStatus | null>(null);

  useEffect(() => {
    // La hora real no se puede leer durante el render del servidor; que el
    // valor llegue recién tras montar es intencional (ver el comentario de
    // arriba), no un efecto que convenga evitar.
    const tick = () => setStatus(serviceStatus(new Date()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return status;
}
