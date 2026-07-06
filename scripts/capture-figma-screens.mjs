/**
 * Captures prototype screens for Figma import (requires dev server on :5173).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "figma-export/screens");
const baseUrl = "http://127.0.0.1:5173";

const screens = [
  { hash: "home", file: "01-home.png" },
  { hash: "results", file: "02-results.png" },
  { hash: "detail", file: "03-detail.png" },
  { hash: "macro", file: "04-macro.png" },
];

async function waitForServer(maxMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Dev server not reachable at " + baseUrl);
}

async function captureWithPlaywright() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  for (const { hash, file } of screens) {
    await page.goto(`${baseUrl}/#${hash}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, file), fullPage: false });
    console.log("Captured:", file);
  }

  await browser.close();
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  let dev = null;
  try {
    await fetch(baseUrl);
  } catch {
    console.log("Starting dev server...");
    dev = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], {
      cwd: root,
      stdio: "ignore",
      detached: true,
    });
    dev.unref();
    await waitForServer();
  }

  await captureWithPlaywright();
  console.log("Screenshots saved to:", outDir);

  if (dev) {
    process.kill(-dev.pid, "SIGTERM");
  }
}

main().catch((err) => {
  console.error(err.message);
  console.error("\nInstall Playwright browsers once: npx playwright install chromium");
  process.exit(1);
});
