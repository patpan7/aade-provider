import { mkdirSync, copyFileSync, existsSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const srcPublic = join(rootDir, 'src', 'public');
const distPublicDir = join(rootDir, 'dist', 'public');

if (existsSync(srcPublic)) {
  mkdirSync(distPublicDir, { recursive: true });
  cpSync(srcPublic, distPublicDir, { recursive: true });
  console.log('[Build] Copied src/public/ to dist/public/');
}