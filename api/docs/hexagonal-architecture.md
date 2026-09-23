# Hướng dẫn dễ hiểu về Hexagonal Architecture (Kiến trúc Lục giác)

**Hexagonal Architecture**, hay còn gọi là **Ports and Adapters** (Cổng và Bộ chuyển đổi), là một kiểu kiến trúc phần mềm giúp code của bạn "miễn nhiễm" với sự thay đổi của công nghệ bên ngoài (như Database, Framework, Third-party API).

Để dễ hiểu nhất, hãy tưởng tượng ứng dụng của bạn là một **Cái Máy Tính (PC)**.

---

## 1. Khái niệm cốt lõi (Analogy)

### Cốt lõi (Domain / Application) = CPU / Thùng máy tính
Bên trong thùng máy tính là CPU và Mainboard. Nó chứa **Logic kinh doanh cốt lõi** (Business Logic) của bạn.
- Thùng máy không cần biết bạn đang dùng chuột hãng Logitech hay Razer.
- Thùng máy chỉ cần biết: *"Miễn là có tín hiệu phím bấm gửi vào đây, tôi sẽ xử lý"*.

Trong code: Đây là **Use-Cases** (ví dụ: `auth-login.use-case.ts`). Nó chỉ chứa luồng nghiệp vụ: Nhận email/password -> Kiểm tra mật khẩu -> Tạo Token.

### Cổng kết nối (Ports) = Cổng USB
Để thùng máy tính kết nối với các thiết bị bên ngoài (Chuột, Phím, Màn hình, Ổ cứng), nhà sản xuất tạo ra **Cổng USB**.
- Cổng USB đưa ra một **chuẩn mực** (Giao thức / Hợp đồng). Bất cứ thiết bị nào muốn cắm vào máy tính đều phải tuân theo cái lỗ cắm USB này.

Trong code: Đây là các **Interfaces** (ví dụ: `IUserRepository`, `IIdentityProvider`). Nó định nghĩa rõ ràng: *"Tôi cần một hàm `createUser(email, password)` trả về thông tin User. Ai làm hàm đó tôi không quan tâm, miễn là đúng cái form này"*.

### Bộ chuyển đổi (Adapters) = Thiết bị cắm vào USB (Chuột, Phím, Ổ cứng)
Là những thứ thực sự thực hiện công việc cụ thể.
- Bạn có thể cắm Chuột Logitech (Prisma PostgreSQL) hoặc Chuột Razer (Mongoose MongoDB) vào cùng 1 cổng USB. Thùng máy vẫn chạy bình thường.

Trong code: Đây là những Class thực thi cụ thể như `PrismaUserAdapter` (Gọi database bằng Prisma) hoặc `SupabaseIdentityAdapter` (Gọi Supabase).

---

## 2. Ứng dụng thực tế vào module `Identity` vừa làm

Kiến trúc của module `identity` hiện tại được tổ chức thành 3 vòng tròn từ trong ra ngoài. Cấu trúc thư mục trông như sau:

```text
identity/
├── application/         <-- Vòng 1: Core (Bên trong cùng)
│   ├── ports/           <-- Cổng USB
│   └── use-cases/       <-- CPU
├── infrastructure/      <-- Vòng 2: Adapters (Bao bọc bên ngoài)
│   └── adapters/        <-- Chuột, Phím (Prisma, Supabase)
└── presentation/        <-- Vòng 3: Giao diện (Ngoài cùng)
    ├── controllers/
    └── dtos/
```

### Vòng 1: Application Core (Bên trong cùng - Không phụ thuộc ai)
Đây là phần trung tâm của ứng dụng. Điểm đặc biệt của Hexagonal là **tầng Application tự định nghĩa những gì nó cần từ thế giới bên ngoài** (Đảo ngược phụ thuộc - Dependency Inversion). Đó là lý do thư mục `ports` nằm bên trong `application`.

- **Application (Ports):** Nơi chứa định nghĩa "Cổng USB".
  - Chú ý đuôi file là `.port.ts` (ví dụ: `user.port.ts`, `identity.port.ts`). Việc đặt tên rõ ràng là "port" giúp mọi người hiểu ngay đây là "Cổng" giao tiếp thay vì bị nhầm lẫn với các mẫu thiết kế truyền thống (như Controller-Service-Repository).
  - Các file này chỉ chứa các Interface (hợp đồng). *Tại đây tuyệt đối không có chữ "Prisma" hay "Supabase" nào xuất hiện.*
  
- **Application (Use Cases):** Nơi chứa "CPU".
  - `auth-login.use-case.ts`: Nó gọi cái "Cổng USB" (Interface) để làm việc. Nó không biết đang lưu database vào đâu, nó chỉ gọi `this.userRepository.findByEmailOrAuthId()`.

### Vòng 2: Infrastructure (Bao bọc bên ngoài - Các công cụ cụ thể)
- **Adapters:** Nơi chứa "Chuột/Bàn phím".
  - `prisma-user.adapter.ts`: Implement interface `IUserRepository`, gọi tới Prisma.
  - `supabase-identity.adapter.ts`: Implement interface `IIdentityProvider`, gọi tới Supabase.

### Vòng 3: Presentation (Ngoài cùng - Giao tiếp với người dùng)
- Nơi nhận Request từ Internet.
  - `auth.controller.ts`: Lấy data từ Request (HTTP), validate bằng Zod, sau đó truyền vào "CPU" (Use-cases) để xử lý.

---

## 3. Tại sao nó lại cực kỳ mạnh mẽ? (Lợi ích)

1. **Dễ dàng thay đổi công nghệ (Plug & Play):** 
   Giả sử ngày mai sếp yêu cầu: *"Bỏ Supabase đi, dùng Firebase Auth"*.
   **Cách làm:** Bạn chỉ cần tạo một file `firebase-identity.adapter.ts`, cắm nó vào `IIdentityProvider`. Toàn bộ file Use Case không phải sửa **DÙ CHỈ MỘT DÒNG CODE**. Bạn chỉ đổi "Chuột Logitech" sang "Chuột Razer".

2. **Dễ test (Unit Test):**
   Khi bạn muốn test `auth-login.use-case.ts`, bạn không cần phải kết nối database thật. Bạn chỉ cần làm một cái "Cổng USB giả" (Mock Adapter) luôn trả về thành công là xong.

3. **Code không bị rối rắm (Spaghetti Code):**
   Trong các dự án cũ, file `auth.service.ts` dài hàng nghìn dòng, vừa gọi Prisma, vừa xử lý Logic, vừa gọi API ngoài. Với Hexagonal, mỗi Use-case chỉ dài vỏn vẹn 30-50 dòng, ai đọc cũng hiểu ngay luồng chạy.

---

## 4. Tóm tắt quy tắc VÀNG của Hexagonal
> **Luật phụ thuộc:** Code ở vòng TRONG không bao giờ được phép gọi / import code ở vòng NGOÀI. 
- Use-case không bao giờ được import Prisma hay Express/Controller.
- Controller (Ngoài) có thể import Use-case (Trong).
- Adapter (Ngoài) có thể import Interface (Trong).
