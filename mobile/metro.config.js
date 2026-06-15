const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push("cjs");
config.resolver.assetExts.push("tflite");
config.resolver.unstable_enablePackageExports = true;

// drei CJS + three "type":"module" — explicit resolve for Metro
const threeCjs = path.resolve(__dirname, "node_modules/three/build/three.cjs");
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three") {
    return { type: "sourceFile", filePath: threeCjs };
  }
  if (defaultResolve) {
    return defaultResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
