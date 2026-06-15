import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ── Dev-only plugin: serve local mock security config files ────────────────
// Files live at demos/dev-demo/mock-security-config*.json and are accessible
// in the browser at /mock-security-config.json and /mock-security-config-partial.json.
// Use these URLs in the SecurityDemo's securityOptions.configUrls to test the
// risk-detection flow without a remote server.
//
// Query parameters (combinable):
//   ?delay=<ms>    Artificial latency before the response is sent.
//                  Useful for testing timeout / retries behaviour.
//                  Example: /mock-security-config.json?delay=3000
//   ?status=<code> HTTP status code to return instead of 200.
//                  Useful for testing error-fallback behaviour.
//                  Example: /mock-security-config.json?status=500
function mockSecurityConfigPlugin() {
  const routes: Record<string, string> = {
    '/mock-security-config.json': resolve(__dirname, 'mock-security-config.json'),
    '/mock-security-config-partial.json': resolve(__dirname, 'mock-security-config-partial.json'),
  };

  return {
    name: 'mock-security-config',
    configureServer(server: { middlewares: { use: (path: string, fn: (req: any, res: any, next: () => void) => void) => void } }) {
      for (const [urlPath, filePath] of Object.entries(routes)) {
        server.middlewares.use(urlPath, (req, res) => {
          const qs = new URL(req.url ?? '', 'http://localhost').searchParams;
          const delay = Math.max(0, Number(qs.get('delay') ?? 0));
          const status = Math.max(100, Math.min(599, Number(qs.get('status') ?? 200)));

          const respond = () => {
            res.statusCode = status;
            if (status >= 200 && status < 300) {
              try {
                const body = readFileSync(filePath, 'utf-8');
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Cache-Control', 'no-store');
                res.end(body);
              } catch {
                res.statusCode = 404;
                res.end('Not found');
              }
            } else {
              res.end(`Mock error ${status}`);
            }
          };

          if (delay > 0) setTimeout(respond, delay);
          else respond();
        });
      }
    },
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir ?? 'dist';
      for (const [urlPath, filePath] of Object.entries(routes)) {
        writeFileSync(resolve(outDir, urlPath.slice(1)), readFileSync(filePath, 'utf-8'));
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), mockSecurityConfigPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3003,
  },
  build: {
    minify: false,
    rollupOptions: {},
  },
});
