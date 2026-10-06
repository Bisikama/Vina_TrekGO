import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const moduleName: string | undefined = process.argv[2];

if (!moduleName) {
  console.error('❌ Vui lòng nhập tên module! Ví dụ: npm run g:hex system-trail');
  process.exit(1);
}

const targetDir: string = path.join(__dirname, '..', 'src', 'modules', moduleName);

console.log(`Đang khởi tạo module Hexagonal: ${moduleName}...`);

// 1. Chạy Nest CLI tạo module phẳng
const moduleBasename = path.basename(moduleName);
try {
  execSync(`npx nest g mo modules/${moduleName}/${moduleBasename} --flat --no-spec`, {
    stdio: 'inherit',
  });
} catch (error) {
  console.error('Lỗi khi chạy nest generate module:', error);
  process.exit(1);
}

// 2. Danh sách các folder chuẩn Hexagonal
const subFolders: string[] = [
  'application/ports',
  'application/use-cases',
  'infrastructure/adapters',
  'presentation/controllers',
  'presentation/dtos',
];

// 3. Tạo thư mục
subFolders.forEach((sub: string) => {
  const dirPath: string = path.join(targetDir, sub);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

console.log(`Đã tạo xong cấu trúc Hexagonal cho module: ${moduleName}!`);
