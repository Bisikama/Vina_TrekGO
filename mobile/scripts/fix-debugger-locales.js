const fs = require("fs");
const path = require("path");

const localesDir = path.join(
  __dirname,
  "..",
  "node_modules",
  "@react-native",
  "debugger-frontend",
  "dist",
  "third-party",
  "front_end",
  "core",
  "i18n",
  "locales"
);

try {
  if (fs.existsSync(localesDir)) {
    const enUsPath = path.join(localesDir, "en-US.json");
    if (fs.existsSync(enUsPath)) {
      const locales = ["vi.json", "vi-VN.json"];
      for (const loc of locales) {
        const targetPath = path.join(localesDir, loc);
        if (!fs.existsSync(targetPath)) {
          fs.copyFileSync(enUsPath, targetPath);
          console.log(`[fix-debugger-locales] Copied en-US.json to ${loc}`);
        }
      }
    }
  }
} catch (err) {
  // Silent fail during installs where debugger-frontend is not present
}
