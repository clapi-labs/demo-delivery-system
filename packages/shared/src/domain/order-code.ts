/**
 * Alfabeto sin caracteres que se confunden al leerlos en voz alta o al
 * teclearlos: fuera I, L, O, 0, 1, B, 8. El código es el respaldo cuando el
 * envío automático falla, y entonces alguien lo va a escribir a mano.
 */
const ALPHABET = "ACDEFGHJKMNPQRSTUVWXYZ234679";
const LENGTH = 6;

export function generateOrderCode() {
  let code = "";
  for (let i = 0; i < LENGTH; i += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/** Reconoce "#PEDIDO A7K3M9" en lo que escriba el cliente. */
export function parseOrderCode(text: string): string | null {
  const match = text.match(
    new RegExp(`#?\\s*PEDIDO\\s*[:\\-]?\\s*([${ALPHABET}]{${LENGTH}})`, "i"),
  );
  return match ? match[1].toUpperCase() : null;
}

/** El texto que el cliente envía por `wa.me` cuando el respaldo se activa. */
export function orderCodeMessage(code: string) {
  return `#PEDIDO ${code}`;
}
