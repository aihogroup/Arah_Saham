// Membuat ikon aplikasi dari logo SVG sumber (latar putih dibuang, dipotong rapat, lalu diberi ruang).
// Pakai: node scripts/make-icons.mjs "C:/path/arahsaham.svg"
import fs from "node:fs";
import sharp from "sharp";

const src = process.argv[2];
if (!src) throw new Error("Berikan path SVG sumber.");
let svg = fs.readFileSync(src, "utf8");
svg = svg.replace(/<path d="[^"]*" fill="#FEFEFE" transform="translate\(0,0\)"\/>/, ""); // buang kotak latar putih

const full = await sharp(Buffer.from(svg), { density: 72 }).resize(2048, 2048).png().toBuffer();
const mark = await sharp(full).trim().png().toBuffer(); // trim dipisah: di sharp, trim berjalan sebelum resize
const { width: w, height: h } = await sharp(mark).metadata();

/** Tempatkan logo di kanvas persegi; `fill` = porsi sisi terpanjang logo terhadap kanvas. */
async function square(size, fill, bg) {
  const k = (size * fill) / Math.max(w, h);
  const logo = await sharp(mark).resize(Math.round(w * k), Math.round(h * k)).toBuffer();
  const m = await sharp(logo).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, left: Math.round((size - m.width) / 2), top: Math.round((size - m.height) / 2) }]).png({ compressionLevel: 9 }).toBuffer();
}
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const out = (p, b) => { fs.writeFileSync(p, b); console.log(p, b.length); };

out("src/app/icon.png", await square(512, 0.84));                 // ikon tab/peramban (transparan)
out("src/app/apple-icon.png", await square(180, 0.78, WHITE));    // layar utama iOS (tanpa transparansi)
out("public/icons/icon-192.png", await square(192, 0.84));
out("public/icons/icon-512.png", await square(512, 0.84));
out("public/icons/maskable-512.png", await square(512, 0.6, WHITE)); // zona aman untuk ikon bulat/squircle Android
out("public/logo-mark.png", await sharp(mark).resize({ height: 160 }).png({ compressionLevel: 9 }).toBuffer()); // logo di header

// favicon.ico berisi PNG 32 dan 48 piksel.
const png = [await square(32, 0.92), await square(48, 0.92)];
const head = Buffer.alloc(6 + 16 * png.length); head.writeUInt16LE(1, 2); head.writeUInt16LE(png.length, 4);
let off = head.length;
png.forEach((p, i) => { const s = i ? 48 : 32, o = 6 + i * 16; head[o] = s; head[o + 1] = s; head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(p.length, o + 8); head.writeUInt32LE(off, o + 12); off += p.length; });
out("src/app/favicon.ico", Buffer.concat([head, ...png]));
