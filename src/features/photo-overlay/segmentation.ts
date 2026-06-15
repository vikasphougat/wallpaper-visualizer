/**
 * Wall auto-detection via TensorFlow.js DeepLab (ADE20K).
 * Class index 0 = wall. Returns a normalised bounding quad for corner handles.
 */

let mlReady: Promise<boolean> | null = null;

/** Probe whether TF.js + DeepLab can be loaded (cached after first check). */
export function isMlAvailable(): Promise<boolean> {
  if (!mlReady) {
    mlReady = (async () => {
      try {
        await import("@tensorflow/tfjs");
        await import("@tensorflow-models/deeplab");
        return true;
      } catch {
        return false;
      }
    })();
  }
  return mlReady;
}

export async function detectWallQuad(bitmap: ImageBitmap): Promise<[number, number][]> {
  let tf: typeof import("@tensorflow/tfjs");
  let deeplab: typeof import("@tensorflow-models/deeplab");

  try {
    [tf, deeplab] = await Promise.all([
      import("@tensorflow/tfjs"),
      import("@tensorflow-models/deeplab"),
    ]);
  } catch (err) {
    console.error("[auto-detect] ML import failed:", err);
    throw new Error(
      "Could not load ML libraries. On the dev PC run:\n" +
        "npm install --legacy-peer-deps\n" +
        "Then restart: npm run dev",
    );
  }

  await tf.ready();
  // Prefer WebGL; fall back to WASM (more reliable on mobile Chrome).
  try {
    await tf.setBackend("webgl");
    await tf.ready();
  } catch {
    await import("@tensorflow/tfjs-backend-wasm");
    await tf.setBackend("wasm");
    await tf.ready();
  }

  const model = await deeplab.load({ base: "ade20k", quantizationBytes: 2 });

  const maxEdge = 513;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);

  const input = tf.browser.fromPixels(canvas);
  const pred = model.predict(input);
  const [ph, pw] = pred.shape as [number, number];
  const labels = (await pred.data()) as ArrayLike<number>;
  input.dispose();
  pred.dispose();
  model.dispose?.();

  let minX = pw,
    minY = ph,
    maxX = 0,
    maxY = 0,
    count = 0;
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      if (labels[y * pw + x] === 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        count++;
      }
    }
  }
  if (count < pw * ph * 0.02) {
    throw new Error("No clear wall detected — drag the blue corners manually.");
  }

  const nx0 = minX / pw,
    nx1 = maxX / pw,
    ny0 = minY / ph,
    ny1 = maxY / ph;
  return [
    [nx0, ny0],
    [nx1, ny0],
    [nx1, ny1],
    [nx0, ny1],
  ];
}
