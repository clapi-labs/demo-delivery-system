/**
 * Barrido del outbox de avisos (Fase 5).
 *
 * Lo dispara Vercel Cron. Toma las notificaciones sin entregar y las manda por
 * WhatsApp, saltándose las conversaciones con la ventana de 24 h cerrada y
 * contando reintentos.
 *
 * Existe porque el portal NO envía directo: que Meta esté caída o la ventana
 * cerrada no puede bloquear un cambio de estado en la cocina.
 */
export {};
