import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import jpeg from "jpeg-js";
import * as tf from "@tensorflow/tfjs";
import * as deeplab from "@tensorflow-models/deeplab";
import { ensureTfReady } from "@/lib/tf";
import { labelsToWallMask, type SegmentationMaskResult } from "./maskPostProcess";

const INPUT_SIZE = 513;

let modelPromise: ReturnType<typeof loadDeepLab> | null = null;

async function loadDeepLab() {
  await ensureTfReady();
  return deeplab.load({ base: "ade20k", quantizationBytes: 2 });
}

export async function uriToRgbTensor(uri: string): Promise<{ tensor: tf.Tensor3D; width: number; height: number }> {
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: INPUT_SIZE } }],
    { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG },
  );
  const base64 = await FileSystem.readAsStringAsync(resized.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const { data, width, height } = jpeg.decode(raw, { useTArray: true });
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }
  return { tensor: tf.tensor3d(rgb, [height, width, 3]), width, height };
}

export async function segmentWithTfjs(uri: string): Promise<SegmentationMaskResult> {
  if (!modelPromise) modelPromise = loadDeepLab();
  const model = await modelPromise;

  const { tensor } = await uriToRgbTensor(uri);
  const pred = model.predict(tensor);
  const [mh, mw] = pred.shape as [number, number];
  const labels = (await pred.data()) as ArrayLike<number>;
  tensor.dispose();
  pred.dispose();

  return labelsToWallMask(labels, mw, mh);
}

export { INPUT_SIZE as TFJS_INPUT_SIZE };
