/** Precio en pesos colombianos: 18000 -> "$18.000". */
export function formatCOP(value: number) {
  return `$${value.toLocaleString("es-CO")}`;
}

/**
 * Deja un texto comparable: minúsculas y sin tildes.
 *
 * No es cosmético. En el sistema real, buscar con `nombre.includes(q)` dejaba
 * en CERO resultados las búsquedas más naturales del negocio — "limón" con
 * tilde no encontraba `LIMON`. Normalizar los dos lados es lo que hace que la
 * búsqueda sirva.
 */
export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // marcas diacríticas
}

/** "573001234567" -> "+57 300 123 4567", para mostrar en el portal. */
export function formatPhone(waId: string) {
  const digits = waId.replace(/\D/g, "");
  if (digits.startsWith("57") && digits.length === 12) {
    const n = digits.slice(2);
    return `+57 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  return `+${digits}`;
}
