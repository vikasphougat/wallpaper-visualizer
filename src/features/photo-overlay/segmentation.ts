/**
 * OPTIONAL wall auto-detection via TensorFlow.js DeepLab (ADE20K).
 *
 * In ADE20K the "wall" class is index 0. We run the model, find all wall
 * pixels and return their bounding quad (normalised) as a quick auto-placement
 * for the corner handles. The user can then fine-tune.
 *
 * The TF.js packages are OPTIONAL dependencies (heavy ~MBs). If they are not
 * installed, this function rejects with a friendly message and the manual
 * corner workflow keeps working.
 */
export async function detectWallQuad(bitmap: ImageBitmap): Promise<[number, number][]> {
  // The specifiers are kept in variables and marked @vite-ignore so Vite does
  // NOT try to resolve these optional packages at transform time. Resolution
  // happens at runtime, so an uninstalled package is caught here instead of
  // crashing the dev server.
  const tfSpecifier = "@tensorflow/tfjs";
  const deeplabSpecifier = "@tensorflow-models/deeplab";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tf: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deeplab: any;
  try {
    tf = await import(/* @vite-ignore */ tfSpecifier);
    deeplab = await import(/* @vite-ignore */ deeplabSpecifier);
  } catch {
    throw new Error(
      "Auto-detect needs the optional ML packages. Install them, then restart the dev server:\n" +
        "npm i @tensorflow/tfjs @tensorflow-models/deeplab --legacy-peer-deps",
    );
  }

  await tf.ready();
  const model = await deeplab.load({ base: "ade20k", quantizationBytes: 2 });

  // Downscale for speed; DeepLab works well around ~513px on the long edge.
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
  const labels = (await pred.data()) as ArrayLike<number>; // class indices per pixel
  input.dispose();
  pred.dispose();
  model.dispose?.();

  // Bounding box of wall pixels (class 0).
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
    throw new Error("No clear wall detected — place the corners manually.");
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
