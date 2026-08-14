import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/** Backend local por defecto para `vite dev`. */
const DEFAULT_DEV_PROXY_TARGET = 'http://127.0.0.1:8000'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  /**
   * Destino del proxy del servidor de desarrollo.
   *
   * Solo afecta a `vite dev`: reenvía `/api/*` al backend que se esté usando en
   * local. No tiene nada que ver con `VITE_API_URL`, que es la base que el
   * navegador utiliza en el bundle (producción incluida).
   *
   * Antes apuntaba de forma fija a Cloud Run, así que levantar el frontend en
   * local hablaba con producción aunque hubiera un backend en Docker al lado.
   * Ahora se configura con VITE_DEV_PROXY_TARGET y cae a localhost.
   */
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || DEFAULT_DEV_PROXY_TARGET

  return {
    plugins: [react()],
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          // Permite apuntar a un backend con certificado autofirmado.
          secure: false,
        },
      },
    },
    preview: {
      host: 'localhost',
      port: 4173,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
      css: true,
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: ['e2e/**', 'node_modules/**'],
    },
  }
})
