import { existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const files = ['mock-security-config.json', 'mock-security-config-partial.json'];

for (const file of files) {
  const filePath = resolve(root, file);
  if (!existsSync(filePath)) {
    writeFileSync(filePath, '');
    console.log(`[dev-demo] Created empty ${file}`);
  }
}
