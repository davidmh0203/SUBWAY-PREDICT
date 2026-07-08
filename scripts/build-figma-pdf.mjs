/**
 * Combines screen PNGs into a multi-page PDF for one-drag Figma import.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const screensDir = path.join(root, "figma-export/screens");
const outPath = path.join(root, "figma-export/yeoyuro-prototype.pdf");

const FRAME_W = 390;
const FRAME_H = 844;

const pages = [
  { file: "01-home.png", title: "01 홈" },
  { file: "02-results.png", title: "02 경로" },
  { file: "03-detail.png", title: "03 상세" },
  { file: "04-macro.png", title: "04 노선도" },
];

async function main() {
  const pdf = await PDFDocument.create();
  pdf.setTitle("여유로 Prototype");
  pdf.setAuthor("yeoyuro");

  for (const { file, title } of pages) {
    const pngPath = path.join(screensDir, file);
    if (!fs.existsSync(pngPath)) {
      throw new Error(`Missing ${pngPath} — run npm run export-figma:screens first`);
    }

    const pngBytes = fs.readFileSync(pngPath);
    const image = await pdf.embedPng(pngBytes);
    const page = pdf.addPage([FRAME_W, FRAME_H]);
    page.drawImage(image, { x: 0, y: 0, width: FRAME_W, height: FRAME_H });
    void title;
  }

  const pdfBytes = await pdf.save();
  fs.writeFileSync(outPath, pdfBytes);
  console.log("PDF written:", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
