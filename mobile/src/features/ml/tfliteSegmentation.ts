import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import jpeg from "jpeg-js";
import { labelsToWallMask, type SegmentationMaskResult } from "./maskPostProcess";
import { TFJS_INPUT_SIZE } from "./tfjsSegmentation";
import { isNativeMlAvailable } from "@/lib/nativeMl";

const INPUT_SIZE = TFJS_INPUT_SIZE;

type TfliteModel = {
  run: (inputs: ArrayBuffer[]) => Promise<ArrayBuffer[]>;
  inputs: { shape: number[]; dataType: string }[];
  outputs: { shape: number[]; dataType: string }[];
};

let modelPromise: Promise<TfliteModel | null> | null = null;
let tfliteAvailable = true;

async function tryLoadTflite(): Promise<TfliteModel | null> {
  if (!tfliteAvailable || !isNativeMlAvailable()) return null;
  try {
    const { loadTensorflowModel } = await import("react-native-fast-tflite");

    const candidates: { url: string }[] = [];

    const localUri = `${FileSystem.bundleDirectory ?? ""}assets/models/deeplab_ade20k.tflite`;
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists) candidates.push({ url: localUri });

    const docModel = `${FileSystem.documentDirectory ?? ""}deeplab_ade20k.tflite`;
    const docInfo = await FileSystem.getInfoAsync(docModel);
    if (docInfo.exists) candidates.push({ url: docModel });

    candidates.push({
      url: "https://raw.githubusercontent.com/freedomtan/deeplabv3_tflite_for_nnapi_delegate/master/ade20k/deeplabv3_mnv2_ade20k_513_os8_dummy_quant.tflite",
    });

    for (const source of candidates) {
      try {
        return (await loadTensorflowModel(source, [])) as TfliteModel;
      } catch {
        /* try next */
      }
    }

    return null;
  } catch {
    tfliteAvailable = false;
    return null;
  }
}

async function getTfliteModel(): Promise<TfliteModel | null> {
  if (!modelPromise) modelPromise = tryLoadTflite();
  return modelPromise;
}

async function uriToUint8Input(uri: string): Promise<Uint8Array> {
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: INPUT_SIZE, height: INPUT_SIZE } }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
  );
  const base64 = await FileSystem.readAsStringAsync(resized.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const { data, width, height } = jpeg.decode(raw, { useTArray: true });

  const input = new Uint8Array(INPUT_SIZE * INPUT_SIZE * 3);
  for (let y = 0; y < INPUT_SIZE; y++) {
    for (let x = 0; x < INPUT_SIZE; x++) {
      const sy = Math.min(height - 1, Math.round((y / INPUT_SIZE) * height));
      const sx = Math.min(width - 1, Math.round((x / INPUT_SIZE) * width));
      const si = (sy * width + sx) * 4;
      const di = (y * INPUT_SIZE + x) * 3;
      input[di] = data[si];
      input[di + 1] = data[si + 1];
      input[di + 2] = data[si + 2];
    }
  }
  return input;
}

function decodeOutput(buf: ArrayBuffer, shape: number[]): Int32Array | Uint8Array | Float32Array {
  const n = shape.reduce((a, b) => a * b, 1);
  if (shape.length >= 3 && shape[shape.length - 1] > 32) {
    return new Float32Array(buf, 0, n);
  }
  try {
    return new Int32Array(buf, 0, n);
  } catch {
    return new Uint8Array(buf, 0, n);
  }
}

function argmaxPerPixel(logits: Float32Array, mw: number, mh: number, numClasses: number): Int32Array {
  const labels = new Int32Array(mw * mh);
  for (let i = 0; i < mw * mh; i++) {
    let best = 0;
    let bestScore = -Infinity;
    const base = i * numClasses;
    for (let c = 0; c < numClasses; c++) {
      const v = logits[base + c];
      if (v > bestScore) {
        bestScore = v;
        best = c;
      }
    }
    labels[i] = best;
  }
  return labels;
}

export async function isTfliteReady(): Promise<boolean> {
  if (!isNativeMlAvailable()) return false;
  return (await getTfliteModel()) != null;
}

export async function segmentWithTflite(uri: string): Promise<SegmentationMaskResult> {
  const model = await getTfliteModel();
  if (!model) throw new Error("TFLite model not available");

  const rgb = await uriToUint8Input(uri);
  const inputBuf = new Uint8Array(rgb).buffer;
  const outputs = await model.run([inputBuf]);
  const outShape = model.outputs[0]?.shape ?? [1, INPUT_SIZE, INPUT_SIZE, 1];
  const raw = decodeOutput(outputs[0], outShape);

  let mw = INPUT_SIZE;
  let mh = INPUT_SIZE;
  let labels: ArrayLike<number>;

  if (outShape.length === 4) {
    mh = outShape[1];
    mw = outShape[2];
    const channels = outShape[3];
    if (channels > 1 && raw instanceof Float32Array) {
      labels = argmaxPerPixel(raw, mw, mh, channels);
    } else {
      labels = raw;
    }
  } else if (outShape.length === 3) {
    [mh, mw] = outShape as [number, number];
    labels = raw;
  } else {
    labels = raw;
  }

  return labelsToWallMask(labels, mw, mh);
}

export function resetTflite(): void {
  modelPromise = null;
  tfliteAvailable = true;
}
