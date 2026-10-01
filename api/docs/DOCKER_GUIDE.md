# 🐳 HƯỚNG DẪN SỬ DỤNG DOCKER - TREKGO API

Tài liệu này hướng dẫn chi tiết cách vận hành TrekGo Backend API bằng Docker, bao gồm: khởi chạy lần đầu, quy trình làm việc hằng ngày, và cập nhật container khi có code mới.

---

## 📌 Mục lục
1. [Chuẩn bị](#1-chuẩn-bị)
2. [Lần đầu khởi chạy](#2-lần-đầu-khởi-chạy)
3. [Sử dụng hằng ngày](#3-sử-dụng-hằng-ngày)
4. [Khi có code mới (Git Pull hoặc sửa code)](#4-khi-có-code-mới-git-pull-hoặc-sửa-code)
5. [Các lệnh quản trị và gỡ lỗi (Troubleshooting)](#5-các-lệnh-quản-trị-và-gỡ-lỗi-troubleshooting)

---

## 1. Chuẩn bị

1. Đã cài đặt và đang bật **Docker Desktop** (hoặc Docker Engine).
2. Mở terminal và chuyển vào thư mục `api`:
   ```powershell
   cd api
   ```
3. Đảm bảo file `.env` đã có đầy đủ các biến môi trường cấu hình (Database URL, Supabase keys, ...).

---

## 2. Lần đầu khởi chạy

Thực hiện 2 bước sau:

### Bước 2.1: Build Docker Image
Chạy lệnh đóng gói mã nguồn thành Docker image (tên tag: `trekgo-api`):
```powershell
docker build -t trekgo-api .
```

### Bước 2.2: Tạo và khởi chạy Container
Tạo container chạy ngầm (`-d`), mở cổng `3000` và mount trực tiếp file `.env` bằng cờ `--mount` (chuẩn nhất trên Windows, không bị lỗi dấu hai chấm ổ đĩa hay Git Bash):
```powershell
# Trên PowerShell (Windows):
docker run -d --name trekgo-api -p 3000:3000 --mount type=bind,source="$PWD\.env",target=/app/.env trekgo-api

# Trên Git Bash (Windows):
docker run -d --name trekgo-api -p 3000:3000 --mount type=bind,source="$(pwd)/.env",target=/app/.env trekgo-api

# Hoặc dùng đường dẫn tuyệt đối trực tiếp:
docker run -d --name trekgo-api -p 3000:3000 --mount type=bind,source="C:\Users\Admin\Documents\tuHocNestJs\Vina_TrekGO\api\.env",target=/app/.env trekgo-api
```

> **💡 Tại sao dùng `--mount` thay vì `-v`?**  
> Trên hệ điều hành Windows, cờ `-v` dùng dấu hai chấm `:` để ngăn cách `source:dest`. Do đường dẫn Windows có sẵn ký tự ổ đĩa (ví dụ `C:\...`), Docker CLI dễ bị nhầm lẫn dấu `:` và tự động biến mount thành một Docker anonymous volume rỗng. Dùng `--mount type=bind` tách biệt rõ `source` và `target`, đảm bảo file `.env` được đọc chính xác 100% trên mọi terminal (PowerShell, CMD, Git Bash).

### Bước 2.3: Kiểm tra kết quả
- **Xem log khởi động:**
  ```powershell
  docker logs -f trekgo-api
  ```
  *(Thấy dòng `Application is running on: http://localhost:3000` là thành công. Nhấn `Ctrl + C` để thoát log).*
- **Truy cập Swagger Docs:** [http://localhost:3000/docs](http://localhost:3000/docs)
- **API Base URL:** [http://localhost:3000/api/v1](http://localhost:3000/api/v1)

---

## 3. Sử dụng hằng ngày

Khi container đã được tạo từ bước trên, các cấu hình mount và cổng đã được Docker lưu lại. **Bạn không cần nạp lại `.env` hay gõ lại lệnh dài.**

### Khi bắt đầu làm việc:
```powershell
docker start trekgo-api
```

### Khi nghỉ làm việc (tắt container):
```powershell
docker stop trekgo-api
```

### Khi bạn chỉnh sửa cấu hình trong file `.env`:
Vì đã mount volume, bạn chỉ cần restart container để nhận giá trị mới:
```powershell
docker restart trekgo-api
```

---

## 4. Khi có code mới (Git Pull hoặc sửa code)

Khi bạn kéo code mới từ Git (`git pull`) hoặc chỉnh sửa mã nguồn backend, bạn cần build lại image và tạo lại container mới để nhận code mới:

### 3 bước tiêu chuẩn:
```powershell
# 1. Xóa container cũ đang chạy
docker rm -f trekgo-api

# 2. Build lại image mới chứa code mới nhất
docker build -t trekgo-api .

# 3. Chạy lại container mới (PowerShell hoặc Git Bash)
docker run -d --name trekgo-api -p 3000:3000 --mount type=bind,source="$PWD\.env",target=/app/.env trekgo-api
```

### ⚡ Mẹo chạy nhanh trong 1 dòng lệnh (PowerShell):
```powershell
docker rm -f trekgo-api; docker build -t trekgo-api .; docker run -d --name trekgo-api -p 3000:3000 --mount type=bind,source="$PWD\.env",target=/app/.env trekgo-api
```

---

## 5. Các lệnh quản trị và gỡ lỗi (Troubleshooting)

| Mục đích | Lệnh thực hiện |
| :--- | :--- |
| **Xem trạng thái container** | `docker ps -a` |
| **Xem log trực tiếp (real-time)** | `docker logs -f trekgo-api` |
| **Xem 50 dòng log gần nhất** | `docker logs --tail 50 trekgo-api` |
| **Truy cập terminal bên trong container** | `docker exec -it trekgo-api sh` |
| **Theo dõi CPU / RAM của container** | `docker stats trekgo-api` |
| **Dọn dẹp các image/build cache cũ giải phóng ổ đĩa** | `docker image prune -f` |
