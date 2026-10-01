# 🌲 HƯỚNG DẪN CÀI ĐẶT & CHẠY DỰ ÁN TREKGO BACKEND (NESTJS)

> **TrekGo** là nền tảng quản trị Tour Trekking, Thuê đồ dã ngoại (Logistics/Warehouse), Theo dõi GPS thời gian thực & Bản đồ địa hình 3D (MapLibre 3D Terrain DEM).  
> Dự án xây dựng trên **NestJS 11**, **Prisma ORM**, **PostgreSQL**, **Supabase Auth** (Pure Supabase Flow), và **Zod Validation**.

---

## 📋 1. YÊU CẦU MÔI TRƯỜNG (PREREQUISITES)

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt:
* **Node.js**: Phiên bản `v20.x` hoặc `v22.x` trở lên (Khuyên dùng `v22+`).
* **Package Manager**: `npm` (đi kèm Node.js).
* **Database**: **PostgreSQL** (chạy cục bộ trên máy tại cổng `5432` hoặc dùng Postgres trên Cloud/Docker).
* **Công cụ quản lý DB (tùy chọn)**: DBeaver, pgAdmin, hoặc Prisma Studio.

---

## 🚀 2. CÁC BƯỚC KHỞI CHẠY DỰ ÁN (CHO THÀNH VIÊN MỚI)

### Bước 1: Clone mã nguồn về máy
```bash
git clone <URL_REPO_CUA_NHOM>
cd TREKKING
```

### Bước 2: Cài đặt các thư viện (Dependencies)
```bash
npm install
```

---

### Bước 3: Cấu hình biến môi trường (`.env`)

1. Tạo file `.env` ở thư mục gốc (ngang hàng với `package.json`):
   * Trên Windows (PowerShell):
     ```powershell
     Copy-Item .env.example .env
     ```
   * Trên Linux / macOS:
     ```bash
     cp .env.example .env
     ```

2. Mở file `.env` và điền các thông tin cấu hình:
   ```env
   # 1. Cấu hình Server
   PORT=3000
   NODE_ENV=development

   # 2. Chuỗi kết nối Database PostgreSQL (Thay đổi username, password và tên database của máy bạn)
   DATABASE_URL="postgresql://postgres:mat_khau_cua_ban@localhost:5432/trekking?schema=public"

   # 3. Khóa bảo mật nội bộ
   SECRET_API_KEY="default_secret_api_key_123456"

   # 4. Supabase Auth Configuration (Hỏi nhóm trưởng để lấy key dùng chung môi trường Dev)
   Sẽ cung cấp sau nhen qua zalo nhennnnnnnnn
   ```

> ⚠️ **Lưu ý bảo mật**: `SUPABASE_SERVICE_ROLE_KEY` là khóa quyền Admin, tuyệt đối không commit file `.env` lên GitHub!

---

### Bước 4: Đồng bộ Cơ sở dữ liệu (Prisma Database Push)

1. Đảm bảo PostgreSQL đang chạy và bạn đã tạo một database trống tên là `trekking` (hoặc tên theo `DATABASE_URL` của bạn).
2. Chạy lệnh sau để Prisma tự động tạo toàn bộ **50+ bảng nghiệp vụ** vào PostgreSQL:
   ```bash
   npx prisma db push
   ```
3. Sinh lại Prisma Client mới nhất:
   ```bash
   npx prisma generate
   ```

*(Mẹo: Bạn có thể chạy lệnh `npx prisma studio` để mở giao diện web xem toàn bộ bảng và dữ liệu tại địa chỉ `http://localhost:5555`).*

---

### Bước 5: Chạy dự án ở chế độ Phát triển (Dev Mode)

```bash
npm run start:dev
```

Khi terminal hiện thông báo:
```text
[Nest] LOG [NestApplication] Nest application successfully started
Application is running on: http://localhost:3000
Swagger UI is available at: http://localhost:3000/docs
```
👉 Bạn đã khởi động thành công!

---

## 📖 3. TÀI LIỆU API & CÁCH KIỂM THỬ TRÊN SWAGGER

Hệ thống đã tích hợp sẵn **Swagger UI Documentation** tại:
👉 **[http://localhost:3000/docs](http://localhost:3000/docs)**

### Luồng kiểm thử chuẩn (Pure Supabase Flow):

1. **Đăng ký tài khoản (`POST /auth/register`)**:
   * Gửi JSON gồm `email`, `password` (tối thiểu 6 ký tự), `fullName`, `phone` (10 chữ số).
   * Hệ thống tự động xác thực bằng **Zod**, tạo User trên Supabase Auth và lưu Profile vào bảng `users` ở PostgreSQL.
2. **Đăng nhập (`POST /auth/login`)**:
   * Nhập email và mật khẩu vừa tạo.
   * Hệ thống trả về `accessToken` chính thức của Supabase.
3. **Xác thực API có bảo vệ (`GET /auth/me`)**:
   * Copy chuỗi `accessToken`.
   * Bấm nút **Authorize 🔓** ở góc trên cùng bên phải giao diện Swagger.
   * Dán vào ô Value: `Bearer <chuỗi_token_cua_ban>` ➔ Bấm **Authorize**.
   * Bấm chạy thử endpoint **`GET /auth/me`** ➔ Nhận toàn bộ hồ sơ, Role, và thông tin Leader/Rank.
4. **Làm mới phiên (`POST /auth/refresh-token`)**:
   * Truyền `refreshToken` để Supabase tự động cấp mới `accessToken`.

---

## 📁 4. CẤU TRÚC THƯ MỤC CHÍNH

```text
TREKKING/
├── docs/                      # Tài liệu đặc tả yêu cầu & kiến trúc (master, bao, luat, quan)
├── dbml/                      # Thiết kế Cơ sở dữ liệu (dbml_v1, dbml_v2)
├── prisma/
│   └── schema.prisma          # Prisma Schema 50+ bảng tương ứng DBML v2.0
├── src/
│   ├── routes/
│   │   └── auth/              # Module Xác thực (Controller, Service, DTO, Zod Schema)
│   ├── shared/
│   │   ├── constants/         # Enums & Constants của 7 miền nghiệp vụ
│   │   ├── decorators/        # Decorators (@Auth, @ActiveUser)
│   │   ├── guards/            # Guards (AccessTokenGuard, ApiKeyGuard, AuthenticationGuard)
│   │   ├── interceptors/      # Response Transformers
│   │   ├── pipes/             # ZodValidationPipe
│   │   ├── services/          # PrismaService, SupabaseService
│   │   ├── types/             # Kiểu dữ liệu chung (ActiveUserData)
│   │   └── config.ts          # Quản lý cấu hình biến môi trường
│   ├── app.module.ts
│   └── main.ts
├── .env.example               # Mẫu file biến môi trường
└── package.json
```

---

## 🛠️ 5. CÁC LỆNH HỮU ÍCH THƯỜNG DÙNG

| Lệnh | Ý nghĩa |
| :--- | :--- |
| `npm run start:dev` | Chạy dev server chế độ hot-reload |
| `cmd.exe /c "npm run build"` | Build kiểm tra lỗi TypeScript |
| `npx prisma db push` | Đẩy cấu trúc schema.prisma vào PostgreSQL |
| `npx prisma studio` | Mở giao diện xem DB trực quan tại `http://localhost:5555` |
| `npx prisma format` | Định dạng lại file schema.prisma |

---

## ❓ 6. CÁC VẤN ĐỀ THƯỜNG GẶP (TROUBLESHOOTING)

### Lỗi 1: `EADDRINUSE: address already in use :::3000`
* **Nguyên nhân**: Đang có một tiến trình khác chạy ngầm chiếm cổng 3000.
* **Cách khắc phục trên Windows**:
  Mở PowerShell chạy lệnh tìm và tắt tiến trình:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
  ```

### Lỗi 2: `P1000: Authentication failed against database server`
* **Nguyên nhân**: Mật khẩu hoặc username trong `DATABASE_URL` của `.env` không khớp với PostgreSQL máy bạn.
* **Cách khắc phục**: Kiểm tra lại mật khẩu đăng nhập pgAdmin / DBeaver và sửa đúng trong `.env`.

### Lỗi 3: `400 Bad Request - Dữ liệu đầu vào không hợp lệ`
* **Nguyên nhân**: Dữ liệu gửi lên không vượt qua bộ lọc **Zod Validation**.
* **Cách khắc phục**: Xem chi tiết mảng `errors` trả về (ví dụ: mật khẩu dưới 6 ký tự, số điện thoại sai định dạng, email không hợp lệ) để điều chỉnh payload.
