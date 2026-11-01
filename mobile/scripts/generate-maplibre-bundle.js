// Sinh module chứa sẵn MapLibre để WebView không phải tải từ unpkg. Chạy: npm run map:bundle
const fs = require('node:fs');
const path = require('node:path');

const dist = path.join(__dirname, '..', 'node_modules', 'maplibre-gl', 'dist');
const output = path.join(__dirname, '..', 'src', 'components', 'map', 'maplibre-bundle.generated.ts');

const js = fs
  .readFileSync(path.join(dist, 'maplibre-gl.js'), 'utf8')
  .replace(/\/\/# sourceMappingURL=.*$/m, '')
  .replace(/<\/script/gi, '<\\/script');
const css = fs
  .readFileSync(path.join(dist, 'maplibre-gl.css'), 'utf8')
  .replace(/\/\*# sourceMappingURL=.*?\*\//g, '');

fs.writeFileSync(
  output,
  `// File sinh tự động bởi scripts/generate-maplibre-bundle.js. Không sửa tay.\n` +
    `export const MAPLIBRE_JS = ${JSON.stringify(js)};\n` +
    `export const MAPLIBRE_CSS = ${JSON.stringify(css)};\n`,
);
console.log(`Đã ghi ${path.relative(process.cwd(), output)} (${Math.round(fs.statSync(output).size / 1024)} KB)`);
