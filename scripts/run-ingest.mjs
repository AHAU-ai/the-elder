import { config } from 'dotenv';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });
execSync('npx ts-node --esm scripts/ingest.ts', {
  stdio: 'inherit', cwd: join(__dirname, '..'), env: process.env,
});
