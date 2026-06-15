import Constants from "expo-constants";
import ARCameraFallback from "./ARCameraFallback";
import { canUseViroAr } from "@/lib/deviceCapabilities";

/**
 * Expo Go / emulator → camera overlay fallback.
 * Physical device dev build → ViroReact ARKit + ARCore plane detection.
 */
export default function ARScreen() {
  if (!canUseViroAr()) {
    return <ARCameraFallback emulatorMode={Constants.executionEnvironment !== "storeClient" && !Constants.isDevice} />;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ARViroScreen = require("./ARViroScreen").default;
  return <ARViroScreen />;
}
