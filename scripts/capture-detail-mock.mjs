import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = join(__dirname, '../docs/_mock/detail-card.html');
const outDir = join(__dirname, '../docs/assets/art');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'nyetflix-product-detail.png');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
});
await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: out, type: 'png', clip: { x: 0, y: 0, width: 1600, height: 1000 } });
await browser.close();
console.log('wrote', out);
