# Hướng dẫn sử dụng lệnh tạo Module Hexagonal (`npm run g:hex`)

Tài liệu này hướng dẫn cách sử dụng công cụ sinh tự động cấu trúc thư mục module theo chuẩn **Hexagonal Architecture (Ports and Adapters)** trong dự án TrekGo API.

---

## 1. Lệnh thực thi

Tại thư mục `api`:

```bash
npm run g:hex <tên-module>
```

### Ví dụ:
```bash
npm run g:hex system-trail
```

---

## 2. Script làm những gì?

Khi bạn chạy lệnh trên, script TypeScript tại [scripts/gen-hex.ts](file:///c:/Users/Admin/Documents/tuHocNestJs/Vina_TrekGO/api/scripts/gen-hex.ts) sẽ tự động:

1. **Khởi tạo Module bằng Nest CLI**:
   - Chạy lệnh: `nest g mo modules/<tên-module>/<tên-module> --flat --no-spec`
   - Tự động khai báo và import module mới vào `AppModule`.
   - File module được tạo trực tiếp: `src/modules/<tên-module>/<tên-module>.module.ts`.

2. **Tự động sinh các thư mục chuẩn Hexagonal**:
   ```text
   src/modules/<tên-module>/
   ├── application/
   │   ├── ports/                 <-- Nơi chứa các Interface / Contract (USB ports)
   │   └── use-cases/             <-- Nơi chứa Business Logic nghiệp vụ chính (CPU)
   ├── infrastructure/
   │   └── adapters/              <-- Triển khai cụ thể (Prisma, Third-party service, v.v.)
   ├── presentation/
   │   ├── controllers/           <-- Tiếp nhận HTTP Request (REST API)
   │   └── dtos/                  <-- Data Transfer Objects & Zod Validation Schemas
   └── <tên-module>.module.ts     <-- Đăng ký Providers, Controllers, Exports
   ```

---

## 3. Quy trình phát triển (Workflow) sau khi tạo Module

Sau khi chạy xong lệnh `npm run g:hex`, bạn triển khai tính năng theo thứ tự chuẩn như sau:

### Bước 1: Presentation - Tạo DTO / Request Schema
Tạo file trong `presentation/dtos/` (ví dụ `get-trails.dto.ts`):
- Định nghĩa kiểu dữ liệu request query/body/params.
- Tận dụng `zod` để validate nếu có.

### Bước 2: Application - Định nghĩa Port (Contract/Interface)
Tạo file trong `application/ports/` (ví dụ `<module>.port.ts`):
- Định nghĩa interface trừu tượng cho việc tương tác dữ liệu (Database, External APIs).
- **Lưu ý**: Tầng này độc lập hoàn toàn, không import Prisma hay thư viện ngoài.

```typescript
// application/ports/system-trail.port.ts
export interface ISystemTrailRepository {
  findMany(): Promise<any[]>;
  findById(id: string): Promise<any | null>;
}

export const SYSTEM_TRAIL_REPOSITORY = Symbol('ISystemTrailRepository');
```

### Bước 3: Application - Tạo Use Case (Nghiệp vụ cốt lõi)
Tạo file trong `application/use-cases/` (ví dụ `get-system-trails.use-case.ts`):
- Inject `ISystemTrailRepository` thông qua token `SYSTEM_TRAIL_REPOSITORY`.
- Thực hiện logic nghiệp vụ, tính toán, kiểm tra điều kiện.

### Bước 4: Infrastructure - Triển khai Adapter
Tạo file trong `infrastructure/adapters/` (ví dụ `prisma-system-trail.adapter.ts`):
- Kế thừa (implements) `ISystemTrailRepository`.
- Inject `PrismaService` để truy vấn trực tiếp PostgreSQL.

### Bước 5: Presentation - Tạo Controller
Tạo file trong `presentation/controllers/` (ví dụ `<module>.controller.ts`):
- Gọi use-case tương ứng.
- Khai báo route HTTP (GET, POST, ...), Swagger annotations, Guard/Pipes nếu cần.

### Bước 6: Đăng ký trong `<module>.module.ts`
Khai báo controller và bind Interface Token với Adapter thực tế:

```typescript
@Module({
  controllers: [SystemTrailController],
  providers: [
    GetSystemTrailsUseCase,
    {
      provide: SYSTEM_TRAIL_REPOSITORY,
      useClass: PrismaSystemTrailAdapter,
    },
  ],
})
export class SystemTrailModule {}
```

---

## 4. Các cấu hình liên quan trong dự án

- **[package.json](file:///c:/Users/Admin/Documents/tuHocNestJs/Vina_TrekGO/api/package.json)**: Chứa lệnh `"g:hex": "ts-node scripts/gen-hex.ts"`.
- **[tsconfig.build.json](file:///c:/Users/Admin/Documents/tuHocNestJs/Vina_TrekGO/api/tsconfig.build.json)**: Loại trừ thư mục `scripts` khi build production.
- **[eslint.config.mjs](file:///c:/Users/Admin/Documents/tuHocNestJs/Vina_TrekGO/api/eslint.config.mjs)**: Bỏ qua `scripts/**` khỏi ESLint type-checking để tránh xung đột với project service.
