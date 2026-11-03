# 🌲 HƯỚNG DẪN SEED DỮ LIỆU CHUẨN CHO TREKGO

Tài liệu này hướng dẫn chi tiết thứ tự nạp dữ liệu mẫu (Seed Data) cho dự án TrekGo từ lúc khởi tạo cơ sở dữ liệu trống hoàn toàn (database mới) cho đến các lần chạy định kỳ chỉ làm mới dữ liệu Đặt chỗ (Booking & Chuyến đi).

---

## 🏗️ 1. Cấu trúc phụ thuộc dữ liệu (Dependency Graph)

Dữ liệu hệ thống có quan hệ khóa ngoại (foreign key) chặt chẽ. Dưới đây là thứ tự các tầng dữ liệu cần nạp:

```mermaid
graph TD
    subgraph Layer 1: Master Data
        A1[Danh mục Rental Categories]
        A2[Kho bãi Inventory Locations]
        A3[Chính sách Booking/Rental/GPS Policies]
        A4[Quy định hư hại & Thiết bị Units]
    end

    subgraph Layer 2: Users & Auth
        B1[Bảng auth.users - Supabase Auth]
        B2[Bảng public.users - Admin, Leader, User, Staff]
    end

    subgraph Layer 3: Địa điểm & Cung đường
        C1[Destination: Núi Dinh]
        C2[Pickup Points & Checkpoints]
        C3[SystemTrail: Tuyến Núi Dinh]
    end

    subgraph Layer 4: Điều kiện tiên quyết Demo
        D1[Quyền TrailAccess cho Host]
        D2[MediaAsset Chứng chỉ cho Leader]
    end

    subgraph Layer 5: Chuyến đi & Đặt chỗ Booking
        E1[Trips: 4 Public + 2 Private]
        E2[Bookings, Tickets, Invoices, Payments]
        E3[Thành viên & Lời mời tham gia]
    end

    Layer 1 --> Layer 5
    Layer 2 --> Layer 4
    Layer 3 --> Layer 4
    Layer 4 --> Layer 5
```

---

## 🚀 2. Kịch bản 1: Chạy lần đầu trên Database mới (Full Setup)

Áp dụng khi bạn vừa tạo một database PostgreSQL mới (trống 0 bảng) trong pgAdmin hoặc Docker.

### Bước 1: Mở terminal tại thư mục `api`
```powershell
cd d:\SESSION_8\TREK_GO\api
```

### Bước 2: Đồng bộ cấu trúc bảng (Schema)
```powershell
npx prisma db push
```

### Bước 3: Nạp Master Data (Kho hàng, chính sách, thiết bị)
Lệnh này nạp toàn bộ danh mục sản phẩm dã ngoại, 140 thiết bị (units), quy định bồi thường, chính sách GPS và booking rules:
```powershell
npx prisma db seed
```

### Bước 4: Nạp trọn gói Users, Tuyến đường & Chuyến đi Booking
Chỉ cần chạy **1 lệnh duy nhất**:
```powershell
npm run seed:booking-all -- --config=prisma/seeds/data/booking-demo.local.json
```

> **Cơ chế tự động**: Lệnh trên đã được tích hợp chạy tuần tự và an toàn:
> 1. `seed-users.ts`: Khởi tạo bảng `auth.users` và nạp 16 tài khoản mẫu (`ADMIN`, `LEADER`, `USER`, `STAFF`).
> 2. `seed-nui-dinh.ts`: Nạp điểm đến Núi Dinh, điểm đón, 3 trạm kiểm soát và tuyến `HSB - Cô Kiêu - La Bàn`.
> 3. `seed-demo-prereqs.ts`: Cấp quyền đi tuyến cho Host và tạo media chứng chỉ cho Leader.
> 4. `booking-policy.seed.ts`: Kích hoạt chính sách đặt chỗ mặc định.
> 5. `coreflows-happy.seed.ts`: Sinh 6 chuyến đi mẫu, tạo đơn booking, vé, hóa đơn và lời mời thành viên.
> 6. Tự động kiểm tra tính toàn vẹn (`--verify-only`).

---

## 🔄 3. Kịch bản 2: Các lần chạy sau (Chỉ làm mới / Thay đổi Booking)

Khi bạn đã test đặt chỗ, thanh toán thử nghiệm, hủy tour,... và muốn **reset dữ liệu Booking & Chuyến đi về trạng thái ban đầu để demo lại**, bạn **KHÔNG** cần nạp lại Master data hay Users.

### Lệnh thực hiện:
```powershell
npm run seed:coreflows -- --config=prisma/seeds/data/booking-demo.local.json
```

### ✨ Ưu điểm của cơ chế này:
* **Quản lý theo batch (`booking_demo`)**: Script chỉ xóa và tái tạo các chuyến đi và đơn booking thuộc batch demo.
* **Bảo toàn dữ liệu nguồn**: Tài khoản Users, mật khẩu, kho đồ thuê, sản phẩm, trạm checkpoints và tuyến đường Núi Dinh được **giữ nguyên 100%**.
* **Tốc độ cực nhanh**: Chỉ mất khoảng 2-3 giây để reset toàn bộ luồng booking.

---

## 🛠️ 4. Bảng tổng hợp các lệnh Seed độc lập khi cần

Nếu trong quá trình phát triển, bạn chỉ muốn nạp lại một phần cụ thể:

| Module / Dữ liệu | Lệnh thực thi | Mô tả |
|---|---|---|
| **Master Data** | `npx prisma db seed` | Nạp 28 sản phẩm thuê, 140 units, bảng hư hại, policies |
| **Tài khoản** | `npx ts-node prisma/seed-users.ts` | Nạp 16 users vào cả `public.users` và `auth.users` |
| **Núi Dinh** | `npx ts-node prisma/seed-nui-dinh.ts` | Nạp địa điểm Núi Dinh, điểm đón, trạm checkpoint, tuyến đường |
| **Núi Bà Đen** | `npx ts-node prisma/seed-trail.ts` | Nạp thêm cung đường Núi Bà Đen - Tây Ninh (độ cao 3D) |
| **Hồ sơ & Quyền Demo** | `npm run seed:demo-prereqs` | Cấp `trail_access` cho host và chứng chỉ media cho leader |
| **Chính sách Booking** | `npm run seed:booking-policies` | Cập nhật chính sách hoàn hủy booking |
| **Trọn gói Booking All** | `npm run seed:booking-all -- --config=prisma/seeds/data/booking-demo.local.json` | Chạy toàn bộ luồng từ Users -> Tuyến -> Chuyến đi -> Verify |
| **Xem dữ liệu trực quan** | `npx prisma studio` | Mở giao diện Web quản lý Database tại `localhost:5555` |

---

## ⚠️ 5. Các lưu ý & Xử lý lỗi thường gặp

1. **Lỗi `relation "auth.users" does not exist`**:
   * *Nguyên nhân*: Do chạy trên PostgreSQL local không có sẵn schema Auth của Supabase.
   * *Cách giải quyết*: Script `seed-users.ts` đã được cập nhật để tự động tạo schema `auth` và bảng `auth.users` giả lập. Bạn chỉ cần chạy lại `npx ts-node prisma/seed-users.ts`.

2. **Lỗi `Foreign key constraint violated`**:
   * *Nguyên nhân*: Chạy script tầng trên khi tầng dưới chưa có dữ liệu (ví dụ chạy tạo chuyến đi khi chưa có tuyến Núi Dinh).
   * *Cách giải quyết*: Chạy đúng thứ tự từ Layer 1 đến Layer 5 theo hướng dẫn ở Mục 2.

3. **Kiểm tra trước khi seed (Dry-run)**:
   * Nếu muốn xem trước những chuyến đi nào sẽ được tạo hoặc dữ liệu cũ nào sẽ bị thay thế mà không ghi vào DB:
     ```powershell
     npm run seed:coreflows -- --config=prisma/seeds/data/booking-demo.local.json --dry-run
     ```

4. **Xóa sạch và tạo lại toàn bộ Database local từ đầu (Tùy chọn)**:
   * Nếu bạn muốn xóa trắng database test local để bắt đầu lại từ con số 0 (chỉ dùng cho database test cá nhân):
     ```powershell
     npx prisma migrate reset --skip-seed
     ```
   * *Lưu ý: Lệnh này sẽ xóa toàn bộ dữ liệu trong database local trước khi chạy lại migrations. Sau khi reset, bạn chạy lại từ **Bước 3 ở Mục 2** để nạp dữ liệu.*