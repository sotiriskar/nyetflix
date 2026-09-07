import sharp from 'sharp';
import { join } from 'path';

const art = 'C:/Users/sotir/Desktop/nyetflix/docs/assets/art';
const framePath = join(art, 'nyetflix-frame-tv-front.png');
const uiPath = join(art, 'nyetflix-detail-ui.png');
const outPath = join(art, 'nyetflix-product-detail.png');

// Manually tuned to the front OLED panel (1536x1024)
const screenLeft = 255;
const screenTop = 88;
const screenW = 1025;
const screenH = 760;

const radius = 10;
const mask = Buffer.from(
  `<svg width="${screenW}" height="${screenH}"><rect width="${screenW}" height="${screenH}" rx="${radius}" ry="${radius}" fill="white"/></svg>`
);

const ui = await sharp(uiPath)
  .resize(screenW, screenH, { fit: 'cover', position: 'centre' })
  .modulate({ brightness: 0.96, saturation: 1.02 })
  .composite([{ input: mask, blend: 'dest-in' }])
  .png()
  .toBuffer();

await sharp(framePath)
  .composite([{ input: ui, left: screenLeft, top: screenTop }])
  .png()
  .toFile(outPath);

console.log('wrote', outPath, { screenLeft, screenTop, screenW, screenH });
