/**
 * Production Content-Security-Policy.
 *
 * Injected only into the build output by `vite.config.ts` so the development
 * server can keep its hot-module-reload channel. `connect-src 'none'` is the
 * runtime backstop against any network access in production.
 */
export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; connect-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'";
