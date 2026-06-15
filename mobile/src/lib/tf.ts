import * as tf from "@tensorflow/tfjs";

let ready: Promise<void> | null = null;

/** Initialise TensorFlow.js CPU backend (works in Expo Go). */
export function ensureTfReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await tf.ready();
      try {
        await tf.setBackend("cpu");
        await tf.ready();
      } catch {
        /* keep default */
      }
    })();
  }
  return ready;
}
