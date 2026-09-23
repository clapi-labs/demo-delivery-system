/**
 * Descarga de adjuntos de Meta (Fase 3).
 *
 * Son DOS llamadas, no una: primero `GET /{media-id}` devuelve una URL
 * temporal, y solo después se descarga esa URL —con el mismo token de
 * autorización, que es lo que suele olvidarse y produce un 401 confuso.
 *
 * Lo descargado se guarda SIEMPRE en disco antes de intentar interpretarlo: un
 * comprobante que no se pudo leer sigue siendo la prueba de que el cliente
 * pagó.
 */
export {};
