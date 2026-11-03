const OpenAPI = require('openapi-typescript-codegen');

const DOCS_URL = process.env.DOCS_JSON_URL || 'http://localhost:3000/docs-json';
const OUTPUT_DIR = './src/api/generated';

async function generate() {
  console.log(`Đang tải OpenAPI schema từ: ${DOCS_URL}...`);
  try {
    const response = await fetch(DOCS_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }
    const spec = await response.json();

    // Deduplicate parameters in spec (e.g. duplicate idempotency-key header from nestjs swagger)
    if (spec.paths) {
      for (const path of Object.keys(spec.paths)) {
        for (const method of Object.keys(spec.paths[path])) {
          const operation = spec.paths[path][method];
          if (Array.isArray(operation?.parameters)) {
            const seen = new Set();
            operation.parameters = operation.parameters.filter((p) => {
              const key = `${p.in}:${p.name?.toLowerCase()}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          }
        }
      }
    }

    console.log(`Đang sinh TypeScript API client vào ${OUTPUT_DIR}...`);
    await OpenAPI.generate({
      input: spec,
      output: OUTPUT_DIR,
      httpClient: OpenAPI.HttpClient.FETCH,
      exportSchemas: false,
    });

    console.log('✅ Sinh API client thành công!');
  } catch (error) {
    console.error('❌ Lỗi khi sinh API client:');
    if (error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
      console.error(`Không thể kết nối tới backend tại ${DOCS_URL}.`);
      console.error('Vui lòng đảm bảo backend server đang chạy trước khi chạy lệnh này.');
    } else {
      console.error(error.message || error);
    }
    process.exit(1);
  }
}

generate();
