import Constants from "expo-constants";

/** TFLite requires a dev build — not available in Expo Go. */
export function isNativeMlAvailable(): boolean {
  return Constants.executionEnvironment !== "storeClient";
}
