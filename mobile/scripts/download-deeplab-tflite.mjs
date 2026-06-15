/**
 * Downloads DeepLab ADE20K TFLite (513×513) for on-device inference.
 * Run: node scripts/download-deeplab-tflite.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "assets", "models");
const OUT_FILE = path.join(OUT_DIR, "deeplab_ade20k.tflite");

const SOURCES = [
  "https://raw.githubusercontent.com/freedomtan/deeplabv3_tflite_for_nnapi_delegate/master/ade20k/deeplabv3_mnv2_ade20k_513_os8_dummy_quant.tflite",
  "https://raw.githubusercontent.com/freedomtan/deeplabv3_tflite_for_nnapi_delegate/master/ade20k/deeplabv3_mnv2_ade20k_513_os16_dummy_quant.tflite",
];

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(OUT_FILE));
  const size = fs.statSync(OUT_FILE).size;
  if (size < 500_000) throw new Error(`File too small (${size} bytes)`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (fs.existsSync(OUT_FILE) && fs.statSync(OUT_FILE).size > 500_000) {
    console.log("deeplab_ade20k.tflite already present — skip");
    return;
  }

  for (const url of SOURCES) {
    try {
      console.log("Downloading", url);
      await download(url);
      console.log(`Saved ${OUT_FILE} (${fs.statSync(OUT_FILE).size} bytes)`);
      return;
    } catch (e) {
      console.warn("  failed:", e.message);
    }
  }
  throw new Error("All download sources failed");
}

main().catch((e) => {
  console.warn("[download-deeplab-tflite]", e.message);
  console.warn("Photo/AR ML will fall back to tfjs until the model is present.");
  process.exit(0);
});
