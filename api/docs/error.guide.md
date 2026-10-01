# Hướng Dẫn Kiến Trúc Xử Lý Lỗi Tập Trung (Centralized Error Architecture)

Tài liệu này giải thích về hệ thống quản lý lỗi (Error Handling) được áp dụng trong project TrekGo (theo chuẩn Hexagonal Architecture). 

Mục tiêu chính: **Tách biệt logic nghiệp vụ khỏi framework (NestJS)**. Thay vì ném các lỗi HTTP như `BadRequestException`, `NotFoundException` trực tiếp trong Use Cases, chúng ta sẽ dùng một class lỗi độc lập (`AppError`) và cấu hình mapping lỗi tập trung.

---

## 1. Cấu trúc thư mục (`src/shared/errors/`)

Toàn bộ logic xử lý lỗi được đặt trong `src/shared/errors/`. Dưới đây là giải thích chi tiết cho từng file:

### `app-error.ts`
- **Chức năng**: Khai báo class `AppError` - một class lỗi tùy chỉnh kế thừa từ `Error` mặc định của NodeJS.
- **Đặc điểm**: **KHÔNG** import bất kỳ thứ gì từ NestJS. Class này mang theo các thông tin:
  - `code`: Mã lỗi duy nhất (ví dụ: `RENTAL_PRODUCT_NOT_FOUND`).
  - `message`: Thông báo lỗi (không bắt buộc, sẽ lấy từ default definition nếu không truyền).
  - `details`: Object chứa các thông tin debug (ví dụ: `id` của sản phẩm bị lỗi).
  - `retryable`: Cờ đánh dấu client có thể thử lại request hay không.
- **Cách dùng**: Trong UseCase hoặc Adapter, bạn chỉ ném lỗi bằng class này (hoặc hàm factory `AppError.fromCode()`).

### `codes/common.error-codes.ts`
- **Chức năng**: Chứa các hằng số mã lỗi (error codes) dùng chung cho toàn bộ hệ thống.
- **Ví dụ**: `VALIDATION_ERROR`, `INTERNAL_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`.

### `codes/rental.error-codes.ts` (và các file domain-codes khác)
- **Chức năng**: Chứa các hằng số mã lỗi đặc thù cho từng domain cụ thể (ví dụ domain Rental).
- **Ví dụ**: `RENTAL_PRODUCT_NOT_FOUND`, `VERSION_CONFLICT`, `INVALID_DAILY_PRICE`. Việc gom nhóm này giúp tránh trùng lặp code lỗi.

### `error-definitions.ts`
- **Chức năng**: "Từ điển" map mã lỗi (từ các file codes) sang cấu hình HTTP tương ứng.
- **Tại sao cần**: UseCase không biết nó đang chạy trong môi trường HTTP, nên nó chỉ ném ra `code`. File này đóng vai trò mapping `code` đó thành:
  - `status`: Mã HTTP Status Code (vd: 404, 409, 422).
  - `message`: Default message nếu UseCase không truyền message.
  - `retryable`: Default flag xem có cho phép retry không.

### `global-error.filter.ts`
- **Chức năng**: Nằm ở tầng ngoài cùng (Presentation/HTTP Boundary) của NestJS. Đóng vai trò là cái lưới bắt tất cả các lỗi ném ra trong quá trình request.
- **Cơ chế**:
  - Nếu lỗi bắt được là `AppError`: Nó tra cứu mã lỗi trong `error-definitions.ts` để gán HTTP Status code và xuất ra format chuẩn `{ error: {...}, meta: {...} }`.
  - Nếu lỗi bắt được là `HttpException` (ví dụ từ class validation của ZodPipe): Nó sẽ tự động translate thành `VALIDATION_ERROR` và bọc lại theo đúng format trên.

---

## 2. Luồng hoạt động (Data Flow)

1. **(Application/Infrastructure) Ném lỗi**:
   Tại Adapter hoặc Use Case, khi có lỗi nghiệp vụ:
   ```typescript
   import { AppError, RENTAL_ERROR_CODES } from 'src/shared/errors';

   // ... logic
   if (!product) {
     throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, { details: { id } });
   }
   ```
2. **(Framework) Đón lỗi**:
   Lỗi sủi bọt (bubble up) qua NestJS và bị chặn lại tại `GlobalErrorFilter`.
3. **(Mapping) Phiên dịch lỗi**:
   Filter tra cứu từ điển `error-definitions.ts`, thấy `RENTAL_PRODUCT_NOT_FOUND` tương đương HTTP `404`.
4. **(HTTP Response) Trả về API Client**:
   API sẽ trả về cấu trúc thống nhất:
   ```json
   {
     "error": {
       "code": "RENTAL_PRODUCT_NOT_FOUND",
       "message": "Rental product not found",
       "details": { "id": "uuid-cua-san-pham" },
       "retryable": false
     },
     "meta": {
       "requestId": "1234-abcd-...",
       "serverTime": "2026-09-28T10:00:00.000Z",
       "contractVersion": "1.0"
     }
   }
   ```

---

## 3. Quy tắc Dành Cho Developer

1. **KHÔNG DÙNG NestJS Exceptions trong Application/Domain Layer**: 
   - Không được `throw new NotFoundException()` hay `throw new BadRequestException()` trong các thư mục `application/use-cases` hay các file Domain.
2. **KHÔNG LEAK Prisma Exceptions**:
   - Nếu Prisma báo lỗi ở tầng Adapter (ví dụ lỗi P2002 duplicate data), Adapter phải bắt lỗi đó `catch(e)` và translate nó thành một `AppError` rồi ném lên trên, thay vì đẩy nguyên cục lỗi Prisma ra ngoài.
3. **KHÔNG ĐỊNH NGHĨA HTTP Status Code TẠI UseCase**:
   - Mọi quy định về HTTP 4xx, 5xx phải được cấu hình ở file `error-definitions.ts`.
4. **TÁI SỬ DỤNG Error Code**:
   - Nếu mã lỗi thuộc tính chất "Common" (như quên truyền token, không có quyền...), hãy dùng `COMMON_ERROR_CODES`. Đừng tạo mã mới trong domain của bạn.
