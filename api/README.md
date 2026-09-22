# 🌲 TREKGO BACKEND - TOUR TREKKING & E-COMMERCE LOGISTICS PLATFORM

Hệ thống Backend cho nền tảng **TrekGo** phục vụ:
* **Mảng A (Bảo)**: Quản lý Cung đường (System Trail, Personal Trail), Checkpoint, Tour thương mại (Public Trip), Nhóm phượt tự túc (Private Trip), Đặt chỗ (Booking).
* **Mảng B (Quân)**: Thuê đồ dã ngoại (Rental Products, Units), Quản trị kho (Warehouse Tasks) & Giao nhận thiết bị (Logistics Tasks).
* **Mảng C (Luật)**: Xác thực danh tính (Supabase Auth), Theo dõi định vị GPS thời gian thực, Cảnh báo lệch route & Bản đồ địa hình 3D (MapLibre 3D Terrain DEM).

---

## ⚡ HƯỚNG DẪN KHỞI CHẠY NHANH CHO THÀNH VIÊN NHÓM

Chi tiết tài liệu hướng dẫn đầy đủ vui lòng xem tại:  
👉 **[HUONG_DAN_CHAY_DU_AN.md](HUONG_DAN_CHAY_DU_AN.md)**

### Tóm tắt 4 bước chạy nhanh:

1. **Cài đặt thư viện**:
   ```bash
   npm install
   ```

2. **Cấu hình môi trường**:
   Tạo file `.env` từ `.env.example` và điền `DATABASE_URL` (Postgres local) cùng bộ key Supabase của nhóm:
   ```bash
   cp .env.example .env
   ```

3. **Đồng bộ Cơ sở dữ liệu với Prisma**:
   ```bash
   npx prisma db push
   ```

4. **Chạy máy chủ**:
   ```bash
   npm run start:dev
   ```

* 🚀 **Swagger UI API Documentation**: [http://localhost:3000/docs](http://localhost:3000/docs)
* 🗄️ **Prisma Studio (Xem DB trực quan)**: `npx prisma studio` ➔ [http://localhost:5555](http://localhost:5555)

---

## 🧱 CÔNG NGHỆ CHÍNH

* **Core Framework**: [NestJS 11](https://nestjs.com/) (TypeScript)
* **Database & ORM**: PostgreSQL, [Prisma ORM 6](https://www.prisma.io/)
* **Identity Provider**: [Supabase Auth](https://supabase.com/) (Pure Supabase Flow)
* **Validation**: [Zod](https://zod.dev/) + Custom `ZodValidationPipe`
* **API Documentation**: OpenAPI / Swagger UI
