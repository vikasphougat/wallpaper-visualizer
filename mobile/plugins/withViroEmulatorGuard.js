const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const EMULATOR_HELPER = `private fun isAndroidEmulator(): Boolean {
  return Build.FINGERPRINT.startsWith("generic")
    || Build.FINGERPRINT.startsWith("unknown")
    || Build.MODEL.contains("google_sdk")
    || Build.MODEL.contains("Emulator")
    || Build.MODEL.contains("Android SDK built for x86")
    || Build.MANUFACTURER.contains("Genymotion")
    || (Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic"))
    || Build.PRODUCT.contains("google_sdk")
    || Build.HARDWARE.contains("goldfish")
    || Build.HARDWARE.contains("ranchu")
}
`;

/**
 * Viro's libviro native library is ARM-only — loading ReactViroPackage on an
 * x86 emulator crashes at startup. Skip Viro packages on emulators.
 */
function withViroEmulatorGuard(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const pkg = config.android?.package;
      if (!pkg) return config;

      const mainPath = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        ...pkg.split("."),
        "MainApplication.kt",
      );

      if (!fs.existsSync(mainPath)) return config;

      let data = fs.readFileSync(mainPath, "utf-8");
      if (data.includes("isAndroidEmulator()")) return config;

      if (!data.includes("import android.os.Build")) {
        data = data.replace("import android.app.Application", "import android.app.Application\nimport android.os.Build");
      }

      data = data.replace(
        /(\s*)add\(ReactViroPackage\(ReactViroPackage\.ViroPlatform\.AR\)\)\s*\n\s*add\(ReactViroPackage\(ReactViroPackage\.ViroPlatform\.GVR\)\)/,
        `$1if (!isAndroidEmulator()) {
$1  add(ReactViroPackage(ReactViroPackage.ViroPlatform.AR))
$1  add(ReactViroPackage(ReactViroPackage.ViroPlatform.GVR))
$1}`,
      );

      data = data.replace("class MainApplication", `${EMULATOR_HELPER}\nclass MainApplication`);

      fs.writeFileSync(mainPath, data, "utf-8");
      return config;
    },
  ]);
}

module.exports = withViroEmulatorGuard;
