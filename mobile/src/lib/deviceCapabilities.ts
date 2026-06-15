import Constants from "expo-constants";
import { isNativeMlAvailable } from "./nativeMl";

/** True on a physical phone/tablet — false on simulators and emulators. */
export function isPhysicalDevice(): boolean {
  return Constants.isDevice === true;
}

/**
 * ViroReact needs ARM native libs (libviro) and ARCore — unavailable on most emulators.
 * Use the camera-overlay AR fallback instead.
 */
export function canUseViroAr(): boolean {
  return isNativeMlAvailable() && isPhysicalDevice();
}
