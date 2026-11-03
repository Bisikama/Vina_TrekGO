# Hướng dẫn chạy TrekGo API bằng Docker

Dùng **docker compose** để chạy cả 4 dịch vụ: `api`, `postgres`, `mongo`, `redis`. Cùng một cách chạy cho máy local và VPS.
Tất cả lệnh chạy trong thư mục `api/`.

> Khi code hằng ngày thì không cần Docker, cứ dùng `npm run start:dev` với `.env`. Docker dùng để deploy hoặc thử môi trường giống production.

## Các file liên quan

| File | Vai trò | Commit lên git? |
| --- | --- | --- |
| `Dockerfile` | Build image API. Khi khởi động sẽ tự chạy `prisma migrate deploy` rồi mới chạy app. | Có |
| `docker-compose.yml` | Khai báo 4 service và các volume lưu dữ liệu. | Có |
| `.env.docker.example` | File mẫu biến môi trường cho Docker. | Có |
| `.env` | **VPS:** env thật cho Docker (copy từ `.env.docker.example`). **Local:** env cho `npm run start:dev`. | **Không** |
| `.env.docker` | **Chỉ dùng ở local:** ghi đè lên `.env` khi chạy Docker (host `postgres`/`mongo`/`redis` thay cho `localhost`). Trên VPS không cần. | **Không** |

Compose đọc `.env` trước, rồi `.env.docker` (nếu có) ghi đè lên. File nào không có thì bỏ qua.

## 1. Chuẩn bị

- Cài Docker: [Docker Desktop](https://www.docker.com/products/docker-desktop/) trên Windows; trên VPS (Ubuntu) cài Docker Engine + plugin compose.
- Kiểm tra: `docker version` và `docker compose version` không báo lỗi.

## 2. Tạo file env

```bash
# Trên VPS
cp .env.docker.example .env

# Trên máy local (giữ nguyên .env cho npm run start:dev)
cp .env.docker.example .env.docker
```

Rồi điền các giá trị `<...>`. Ba quy tắc quan trọng:

1. **Không** bọc giá trị trong dấu ngoặc kép. Docker giữ nguyên dấu `"`, sẽ gây lỗi `Invalid supabaseUrl` hoặc `ENOTFOUND`.
2. **Không** dùng `localhost` cho DB/Mongo/Redis. Phải dùng tên service: `postgres`, `mongo`, `redis`.
3. `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` phải khớp với user / mật khẩu / tên DB trong `DATABASE_URL` và `DIRECT_URL`.

Các dòng có đánh dấu `[VPS]` trong file mẫu là những dòng cần đổi khi deploy lên VPS (xem bước 7).

## 3. Chạy

```bash
docker compose up -d --build
```

Lệnh này build image API, khởi động Postgres, Mongo, Redis, đợi chúng sẵn sàng, rồi khởi động API. API tự chạy migration trước khi lên.

Xem log API:

```bash
docker compose logs -f api
```

Khi chạy thành công:

- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/docs

> Lần đầu chạy, Postgres trong compose là **DB mới, trống** (chỉ có bảng từ migration). Dữ liệu ở Postgres cài trên Windows không tự chuyển sang. Xem bước 5 để seed dữ liệu.

## 4. Các lệnh thường dùng

| Việc cần làm | Lệnh |
| --- | --- |
| Xem trạng thái các service | `docker compose ps` |
| Xem log API (liên tục) | `docker compose logs -f api` |
| Xem log tất cả | `docker compose logs -f` |
| Cập nhật sau khi sửa code | `docker compose up -d --build` |
| Áp dụng env mới (sửa `.env` / `.env.docker`) | `docker compose up -d` |
| Khởi động lại API | `docker compose restart api` |
| Dừng tất cả (giữ dữ liệu) | `docker compose down` |
| Vào shell trong API | `docker compose exec api sh` |
| Vào Postgres (psql) | `docker compose exec postgres psql -U <POSTGRES_USER> -d <POSTGRES_DB>` |
| Vào Mongo | `docker compose exec mongo mongosh vina_trekgo_notifications` |

> ⚠️ `docker compose down -v` **xoá luôn volume, tức là mất toàn bộ dữ liệu** Postgres/Mongo/Redis. Chỉ dùng khi chắc chắn muốn làm lại từ đầu.

## 5. Migration và seed dữ liệu

**Migration:** tự động. Mỗi lần container `api` khởi động sẽ chạy `prisma migrate deploy`. Lệnh này chỉ áp migration mới, **không xoá dữ liệu**, nên chạy lại nhiều lần vẫn an toàn.

**Seed:** image không chứa `ts-node` nên seed được chạy **từ máy có source code**, kết nối vào Postgres của compose qua cổng `5433` (chỉ mở cho `127.0.0.1`):

```powershell
# PowerShell (Windows)
$env:DATABASE_URL = "postgresql://<user>:<pass>@localhost:5433/<db>?schema=public"
$env:DIRECT_URL = $env:DATABASE_URL
npx prisma db seed
npm run seed:booking-policies   # và các seed:* khác nếu cần, xem HUONG_DAN_SEED_DU_LIEU.md
```

```bash
# Bash (VPS)
export DATABASE_URL="postgresql://<user>:<pass>@localhost:5433/<db>?schema=public"
export DIRECT_URL="$DATABASE_URL"
npx prisma db seed
```

Mở terminal mới (hoặc xoá biến) sau khi seed xong, để `npm run start:dev` quay lại dùng `.env`.

**Chuyển dữ liệu cũ sang** (nếu cần): dump từ Postgres cũ rồi import vào container:

```bash
pg_dump -U postgres -h localhost -p 5432 -Fc trekGo > trekgo.dump
docker compose cp trekgo.dump postgres:/tmp/trekgo.dump
docker compose exec postgres pg_restore -U <POSTGRES_USER> -d <POSTGRES_DB> --clean --if-exists /tmp/trekgo.dump
docker compose restart api
```

## 6. Quy trình khi có code mới (build → chạy thử → Docker Hub)

Hai bước Prisma chạy ở hai thời điểm khác nhau:

| Lệnh | Chạy khi nào | Làm gì |
| --- | --- | --- |
| `prisma generate` | Lúc **build image** | Sinh Prisma Client, đóng gói vào image. Không đụng DB. |
| `prisma migrate deploy` | Lúc **container khởi động** | Kết nối DB và áp migration mới. |

**Bước 1: Build image** (trong thư mục `api/`)

```bash
docker compose build api
```

Image được tạo ra tên là `trekgo-api`. Kiểm tra: `docker images trekgo-api`.

**Bước 2: Chạy thử trên máy**

```bash
docker compose up -d
docker compose logs -f api
```

Mở http://localhost:3000/docs để kiểm tra. Bước 1 + 2 có thể gộp thành `docker compose up -d --build`.

**Bước 3: Đẩy lên Docker Hub** (khi đã chạy thử ổn)

```bash
docker login                                              # chỉ cần lần đầu
docker tag trekgo-api <dockerhub-user>/trekgo-api:latest
docker push <dockerhub-user>/trekgo-api:latest

# Nên gắn thêm tag phiên bản để quay lại bản cũ khi bản mới lỗi
docker tag trekgo-api <dockerhub-user>/trekgo-api:v1.0.1
docker push <dockerhub-user>/trekgo-api:v1.0.1
```

Hoặc build + đẩy một lần, hỗ trợ cả máy Intel/AMD và Mac chip M:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t <dockerhub-user>/trekgo-api:latest --push .
```

> Không cần tạo repo trước trên Docker Hub: `docker push` tự tạo, mặc định là **public**. Muốn private thì vào repo trên hub.docker.com → **Settings → Make private** (tài khoản free được 1 repo private) và thêm người dùng ở **Collaborators**.

**Bước 4: Người khác lấy bản mới**

Người nhận cần `docker-compose.yml`, trong đó service `api` dùng `image: <dockerhub-user>/trekgo-api:latest` và **bỏ** dòng `build: .`, cùng file `.env` (gửi qua kênh riêng vì chứa secret). Rồi chạy:

```bash
docker login                 # nếu repo private
docker compose pull
docker compose up -d
```

Migration mới (nếu có) tự chạy khi container khởi động.

## 7. Deploy lên VPS

1. Đưa source lên VPS: `git clone` repo, rồi `cd api`.
2. Tạo `.env` trên VPS: `cp .env.docker.example .env` (hoặc `scp` từ máy lên), rồi đổi các dòng `[VPS]`:
   - `POSTGRES_PASSWORD`: mật khẩu mạnh (nhớ sửa luôn trong `DATABASE_URL`, `DIRECT_URL`).
   - `VNPAY_SANDBOX_API_IP`: IP public của VPS.
   - `MOMO_SANDBOX_IPN_URL`: `https://<domain-be>/api/v1/payments/webhooks/momo`.
   - Trên **VNPAY Merchant Portal**, đặt IPN: `https://<domain-be>/api/v1/payments/webhooks/vnpay`.
   - `VNPAY_SANDBOX_RETURN_URL`, `MOMO_SANDBOX_REDIRECT_URL`, `WEB_APP_ORIGIN`: FE vẫn chạy local thì **giữ `localhost:5000`**. Khi nào deploy FE thì đổi sang domain FE.
3. Chạy: `docker compose up -d --build`.
4. Seed dữ liệu (bước 5) nếu là lần đầu.
5. Cấu hình domain + HTTPS (ví dụ Nginx / Caddy reverse proxy về `localhost:3000`). IPN của MoMo/VNPAY **bắt buộc https**.
6. Mở firewall cổng 80/443. **Không** mở 5433, 27018 ra internet; compose đã chỉ mở chúng cho `127.0.0.1`.

**Cập nhật bản mới trên VPS:**

```bash
git pull
docker compose up -d --build
```

## 8. Xử lý lỗi thường gặp

| Lỗi trong log | Nguyên nhân / cách xử lý |
| --- | --- |
| `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL` | Giá trị env còn dấu ngoặc kép. Bỏ `"` trong file env. |
| `getaddrinfo ENOTFOUND ...` | Host DB sai (còn ngoặc kép, gõ sai tên service), hoặc mật khẩu có ký tự đặc biệt chưa mã hoá (`@` → `%40`, `#` → `%23`). |
| `connect ECONNREFUSED 127.0.0.1:5432` | Đang dùng `localhost` trong env. Đổi thành `postgres` (Mongo: `mongo`, Redis: `redis`). |
| `password authentication failed` | Mật khẩu trong `DATABASE_URL` khác `POSTGRES_PASSWORD`. Lưu ý: `POSTGRES_PASSWORD` chỉ có tác dụng **lần đầu** tạo volume; đổi sau đó phải đổi trong psql (`ALTER USER ... PASSWORD '...'`). |
| Log lặp lại `... unavailable; retrying on next tick` | Các worker chạy định kỳ không kết nối được DB. Sửa kết nối DB là hết. |
| API tắt ngay, log có lỗi Prisma migrate | Migration lỗi; đọc `docker compose logs api`. Không dùng `migrate reset` / `db push` để "sửa". |
| API tắt ngay, log báo lỗi env | Thiếu hoặc sai biến (Zod kiểm tra lúc khởi động). So lại với `.env.docker.example`. |
| `port is already allocated` | Cổng 3000 đang bị dùng (có thể do `npm run start:dev`). Tắt app đó, hoặc đổi `"3000:3000"` thành `"3001:3000"` trong `docker-compose.yml`. |
| `no configuration file provided: not found` | Đang đứng sai thư mục. `cd api` (nơi có `docker-compose.yml`) rồi chạy lại. |
| `No images found matching "ls"` | Gõ nhầm `docker images ls`. Dùng `docker images` hoặc `docker image ls`. |
| Code mới không có tác dụng | Thiếu `--build`: chạy `docker compose up -d --build`. |
| Hết dung lượng ổ đĩa | `docker system prune` (xoá container đã dừng, image không dùng; **không** xoá volume). |
