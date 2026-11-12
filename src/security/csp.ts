/**
 * Production Content-Security-Policy.
 *
 * Injected only into the build output by `vite.config.ts` so the development
 * server can keep its hot-module-reload channel. `connect-src 'none'` is the
 * runtime backstop against any network access in production.
 */
export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; media-src 'none'; connect-src 'none'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; font-src 'self'";
