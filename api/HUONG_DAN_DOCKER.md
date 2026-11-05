# Hướng dẫn chạy và deploy TrekGo API bằng Docker

Dùng **docker compose** để chạy 4 dịch vụ: `api`, `postgres`, `mongo`, `redis`.
Các lệnh ở máy local chạy trong thư mục `api/`. Các lệnh trên VPS chạy trong `~/trekgo`.

> Khi code hằng ngày thì không cần Docker, cứ dùng `npm run start:dev` với `.env`. Docker dùng để deploy hoặc thử môi trường giống production.

## Tổng quan quy trình deploy

```
Dev push code (api/**) lên nhánh deploy/docker
        │
        ▼
GitHub Actions - Job 1 "Build & Push api image"
  build image từ thư mục api/  →  đẩy lên Docker Hub: luatng304/trekgo-api:latest + :sha-xxxxxxx
        │ (chỉ chạy tiếp khi build thành công)
        ▼
GitHub Actions - Job 2 "Deploy to VPS"  (SSH vào VPS)
  1. ghi ~/trekgo/docker-compose.yml   ← từ api/docker-compose.vps.yml trong repo
  2. ghi ~/trekgo/.env                 ← từ secret TREKGO_ENV (bản cũ lưu .env.bak)
  3. docker compose pull api && docker compose up -d
        │
        ▼
Container api mới khởi động: prisma migrate deploy → chạy NestJS
(postgres / mongo / redis và dữ liệu giữ nguyên)
```

Sửa `web/` hay `mobile/` **không** kích hoạt workflow. Image chỉ chứa code `api/` và **không chứa env**.

## Các file liên quan

| File | Vai trò | Commit lên git? |
| --- | --- | --- |
| `Dockerfile` | Build image API. Khi khởi động sẽ tự chạy `prisma migrate deploy` rồi mới chạy app. | Có |
| `docker-compose.yml` | Compose cho **máy local**: build image từ code (`build: .`). | Có |
| `docker-compose.vps.yml` | Compose cho **VPS**: dùng image `luatng304/trekgo-api:latest` từ Docker Hub, `mongo:4.4`. Workflow copy file này lên VPS thành `~/trekgo/docker-compose.yml`. | Có |
| `.env.docker.example` | File mẫu biến môi trường cho Docker. | Có |
| `.env` | **Local:** env cho `npm run start:dev`. **VPS:** env thật cho Docker (do workflow ghi từ `TREKGO_ENV`). | **Không** |
| `.env.docker` | **Chỉ dùng ở local:** ghi đè lên `.env` khi chạy Docker (host `postgres`/`mongo`/`redis` thay cho `localhost`). | **Không** |
| `../.github/workflows/api-docker-image.yml` | Workflow build, push image và deploy lên VPS. | Có |

Ở local, compose đọc `.env` trước, rồi `.env.docker` (nếu có) ghi đè lên. File nào không có thì bỏ qua.

---

# Phần A. Chạy ở máy local

## A1. Chuẩn bị

- Cài [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows cần bật WSL2).
- Kiểm tra: `docker version` và `docker compose version` không báo lỗi.

## A2. Tạo file env

```bash
cp .env.docker.example .env.docker
```

Rồi điền các giá trị `<...>`. Ba quy tắc quan trọng:

1. **Không** bọc giá trị trong dấu ngoặc kép. Docker giữ nguyên dấu `"`, sẽ gây lỗi `Invalid supabaseUrl` hoặc `ENOTFOUND`.
2. **Không** dùng `localhost` cho DB/Mongo/Redis. Phải dùng tên service: `postgres`, `mongo`, `redis`.
3. `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` phải khớp với user / mật khẩu / tên DB trong `DATABASE_URL` và `DIRECT_URL`.

## A3. Chạy

```bash
docker compose up -d --build
docker compose logs -f api        # Ctrl + C để thoát xem log
```

- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/docs

Mỗi lần sửa code, chạy lại `docker compose up -d --build`. Postgres, Mongo, Redis và dữ liệu được giữ nguyên.

> Lần đầu chạy, Postgres trong compose là **DB mới, trống** (chỉ có bảng từ migration). Xem mục C1 để seed.

## A4. Chạy bằng image từ Docker Hub (không build từ code)

```bash
docker pull luatng304/trekgo-api:latest
docker tag luatng304/trekgo-api:latest trekgo-api     # đổi tên thành tên mà docker-compose.yml dùng
docker compose up -d                                  # KHÔNG thêm --build
```

Nếu compose không thay container cũ: `docker compose up -d --force-recreate api`.

---

# Phần B. Deploy lên VPS

Thông tin VPS hiện tại:

| | Giá trị |
| --- | --- |
| IP | `160.30.161.237` |
| Cổng SSH | `8686` (không phải 22) |
| User | `luatng304` |
| Thư mục chạy | `~/trekgo` (chứa `docker-compose.yml` và `.env`) |
| Hệ điều hành | Ubuntu |

Đăng nhập: `ssh -p 8686 luatng304@160.30.161.237`. Thoát: `exit`.

## B1. Cài đặt lần đầu (chỉ làm một lần)

**1. Cài Docker và cho user dùng Docker không cần `sudo`** (trên VPS):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit        # rồi SSH vào lại để quyền có tác dụng
docker compose version
```

**2. Kiểm tra CPU** (trên VPS). `sharp` (xử lý ảnh) cần bộ lệnh x86-64-v2, MongoDB 5+ cần AVX:

```bash
for f in cx16 lahf_lm popcnt sse4_1 sse4_2 ssse3 avx; do grep -qw $f /proc/cpuinfo && echo "OK    $f" || echo "THIEU $f"; done
```

- Thiếu bất kỳ dòng nào trừ `avx` thì API sẽ crash vì `sharp`. Nhờ nhà cung cấp đổi **CPU type sang `host`**.
- Thiếu `avx` thì phải dùng `mongo:4.4`. VPS hiện tại đang ở trường hợp này nên `docker-compose.vps.yml` đã đặt sẵn `mongo:4.4`.

**3. Tạo thư mục** (trên VPS): `mkdir -p ~/trekgo`

**4. Thêm secrets trên GitHub** (repo → Settings → Secrets and variables → Actions):

| Secret | Giá trị |
| --- | --- |
| `DOCKERHUB_USERNAME` | `luatng304` |
| `DOCKERHUB_TOKEN` (hoặc `DOCKERHUB_PASSWORD`) | Access Token của Docker Hub (quyền Read & Write) |
| `VPS_HOST` | `160.30.161.237` |
| `VPS_PORT` | `8686` |
| `VPS_USER` | `luatng304` |
| `VPS_PASSWORD` | Mật khẩu SSH của `luatng304` |
| `TREKGO_ENV` | **Toàn bộ** nội dung file `.env` dành cho VPS (xem B2) |

## B2. Nội dung `TREKGO_ENV` (env trên VPS)

Tạo từ `.env.docker` (hoặc `.env.docker.example`), rồi sửa các dòng có đánh dấu `[VPS]`:

- `POSTGRES_PASSWORD`: mật khẩu mạnh. Sửa luôn mật khẩu trong `DATABASE_URL` và `DIRECT_URL` cho khớp.
- Host: `postgres`, `mongo`, `redis` (không dùng `localhost`).
- `VNPAY_SANDBOX_API_IP=160.30.161.237`
- `MOMO_SANDBOX_IPN_URL`: cần https, xem mục B6.
- `VNPAY_SANDBOX_RETURN_URL`, `MOMO_SANDBOX_REDIRECT_URL`, `WEB_APP_ORIGIN`: FE vẫn chạy local thì **giữ `http://localhost:5000...`**. Không đặt `http://<ip>` vì code chỉ chấp nhận `https://` hoặc `http://localhost`.

Lấy `.env` đang có trên VPS về máy để copy vào secret (Git Bash, trong `api/`):

```bash
scp -P 8686 luatng304@160.30.161.237:~/trekgo/.env ./.env.vps
```

Mở `.env.vps`, copy toàn bộ, dán vào secret `TREKGO_ENV`, rồi xoá file `.env.vps`.

> ⚠️ Từ khi có `TREKGO_ENV`, **sửa env thì sửa secret**, không sửa trực tiếp `~/trekgo/.env` trên VPS vì lần deploy sau sẽ ghi đè. Để `TREKGO_ENV` trống thì workflow giữ nguyên `.env` trên VPS.

## B3. Deploy hằng ngày (tự động)

```bash
git add .
git commit -m "..."
git push origin deploy/docker
```

Workflow chỉ chạy khi commit có thay đổi trong `api/**` hoặc file workflow. Có thể chạy tay: tab **Actions** → **Docker Image - TrekGO API** → **Run workflow**.

Theo dõi ở tab **Actions**:

- **Build & Push api image**: build cả amd64 và arm64. Lần đầu mất 15–30 phút, các lần sau nhanh hơn nhờ cache.
- **Deploy to VPS**: Step 3 in ra `docker compose ps` và 30 dòng log API sau khi deploy.

**Không cần** xoá container trên VPS trước khi deploy. `docker compose up -d` tự thay container `api` bằng bản mới. Postgres, Mongo, Redis và dữ liệu không bị đụng tới. API sẽ ngắt vài giây trong lúc đổi container.

Tag image trên Docker Hub (https://hub.docker.com/r/luatng304/trekgo-api):

| Tag | Ý nghĩa |
| --- | --- |
| `latest` | Bị **thay thế** mỗi lần: luôn là bản mới nhất. |
| `sha-xxxxxxx` | **Tạo mới** mỗi commit (7 ký tự đầu commit hash), dùng để quay lại bản cũ. |

## B4. Deploy thủ công / quay lại bản cũ (trên VPS)

```bash
cd ~/trekgo
docker compose pull api
docker compose up -d
```

Quay lại bản cũ khi bản mới lỗi:

```bash
cd ~/trekgo
sed -i 's#luatng304/trekgo-api:latest#luatng304/trekgo-api:sha-9f8e7d6#' docker-compose.yml
docker compose up -d
```

Lần deploy tự động sau sẽ ghi đè lại `docker-compose.yml` về `latest`.

Quay lại env cũ: `cp .env.bak .env && docker compose up -d`.

## B5. Kiểm tra và xem log (trên VPS)

```bash
cd ~/trekgo
docker compose ps                         # trạng thái các container
docker compose logs -f --tail 50 api      # log API (Ctrl + C để thoát)
docker compose logs --since 30m api       # log 30 phút gần nhất
curl -I http://localhost:3000/docs        # HTTP/1.1 200 OK là API đang chạy
```

Từ máy bạn: http://160.30.161.237/docs (qua Nginx; cổng 3000 chỉ mở cho chính VPS)

> Mọi lệnh `docker compose ...` phải chạy **trong `~/trekgo`**, nếu không sẽ báo `no configuration file provided`. Muốn SSH vào là đứng sẵn ở đó: `echo 'cd ~/trekgo' >> ~/.bashrc`.

## B6. Thanh toán sandbox trên VPS

| | Chiều | Cấu hình ở đâu |
| --- | --- | --- |
| `VNPAY_SANDBOX_API_IP` | VPS → VNPAY (hỏi trạng thái, hoàn tiền) | `TREKGO_ENV`: `160.30.161.237` |
| IPN VNPAY | VNPAY → VPS (báo kết quả thanh toán) | **VNPAY Sandbox Merchant Portal** (không nằm trong env) |
| `MOMO_SANDBOX_IPN_URL` | MoMo → VPS | `TREKGO_ENV`, **bắt buộc https** |

- Trên VPS **không cần ngrok**, vì VPS đã có IP public.
- IPN VNPAY đặt trên Merchant Portal: `http://160.30.161.237/api/v1/payments/webhooks/vnpay`, hoặc `https://<domain>/api/v1/payments/webhooks/vnpay` nếu VNPAY không nhận http.
- Kể cả khi IPN chưa về, `PaymentRecoveryService` vẫn tự hỏi lại VNPAY và có thể xác nhận thanh toán, chỉ chậm hơn.
- MoMo chỉ chạy được khi có **domain + HTTPS** (Nginx đã cài sẵn, chỉ cần thêm certbot - xem mục B8).
- Kiểm tra IPN có về không: `docker compose logs -f api | grep -i webhook`.

## B7. Web / mobile local gọi API trên VPS

- Web: `web/.env.local` → `NEXT_PUBLIC_API_URL=http://160.30.161.237` (không thêm `/api/v1`), rồi chạy lại `npm run dev`.
- Mobile: `mobile/.env` → `EXPO_PUBLIC_API_URL=http://160.30.161.237`, rồi `npx expo start -c`.
- CORS ở API đã mở cho mọi origin nên không cần sửa gì thêm.

## B8. Nginx (reverse proxy) và HTTPS

Nginx chạy trực tiếp trên VPS (không phải trong Docker). Nó nhận request ở cổng 80/443 rồi chuyển về API `127.0.0.1:3000`. Trong `docker-compose.vps.yml`, API chỉ mở `127.0.0.1:3000:3000`, nên từ ngoài **không** gọi thẳng `:3000` được, mọi request đều phải qua Nginx.

```
Trình duyệt / mobile / VNPAY ──► :80 / :443 Nginx ──► 127.0.0.1:3000 container api
```

**Cài và cấu hình (đã làm trên VPS hiện tại):**

```bash
sudo apt-get update && sudo apt-get install -y nginx

sudo tee /etc/nginx/sites-available/trekgo > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;                 # có domain thì thay bằng api.<domain>
    client_max_body_size 110m;     # upload tối đa (video 100 MB)

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;          # Socket.IO / WebSocket
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/trekgo /etc/nginx/sites-enabled/trekgo
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

**Kiểm tra:** `curl -I http://localhost/docs` phải trả về `200 OK` **và có dòng `X-Powered-By: Express`**. Không có dòng đó nghĩa là vẫn đang là trang mặc định của Nginx.

**Lệnh thường dùng:**

| Việc | Lệnh |
| --- | --- |
| Kiểm tra cấu hình sau khi sửa | `sudo nginx -t` |
| Áp dụng cấu hình mới | `sudo systemctl reload nginx` |
| Trạng thái | `systemctl status nginx --no-pager` |
| Log lỗi | `sudo tail -50 /var/log/nginx/error.log` |
| Log truy cập | `sudo tail -f /var/log/nginx/access.log` |

**HTTPS (cần domain).** Let's Encrypt không cấp chứng chỉ cho IP trần:

1. Tạo bản ghi DNS **A**: `api.<domain>` → `160.30.161.237`.
2. Đổi `server_name _;` thành `server_name api.<domain>;` trong `/etc/nginx/sites-available/trekgo`, rồi `sudo nginx -t && sudo systemctl reload nginx`.
3. Cấp chứng chỉ (tự gia hạn):
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d api.<domain>
   ```
4. Đổi `MOMO_SANDBOX_IPN_URL` (trong `TREKGO_ENV`), IPN VNPAY, và URL API của web/mobile sang `https://api.<domain>`.

**Firewall:** `ufw` hiện đang tắt. Nếu bật, **phải mở cổng SSH trước** để khỏi tự khoá mình ngoài VPS: `sudo ufw allow 8686/tcp && sudo ufw allow 'Nginx Full' && sudo ufw enable`. Cổng Docker publish đi vòng qua `ufw`, nên việc chặn `:3000` là do `127.0.0.1:3000:3000` trong compose, không phải do `ufw`.

---

# Phần C. Dữ liệu

## C1. Migration và seed

**Migration:** tự động. Mỗi lần container `api` khởi động sẽ chạy `prisma migrate deploy`. Lệnh này chỉ áp migration mới, **không xoá dữ liệu**.

**Seed:** **không tự động**. Image không có `ts-node` nên seed được chạy **từ máy có source code**, và chỉ cần chạy một lần khi DB mới.

Seed vào Postgres **local** (compose ở máy, cổng `5433`):

```powershell
$env:DATABASE_URL = "postgresql://<user>:<pass>@localhost:5433/trekGo?schema=public"
$env:DIRECT_URL = $env:DATABASE_URL
npx prisma db seed
npm run seed:booking-policies   # và các seed:* khác, xem HUONG_DAN_SEED_DU_LIEU.md
```

Seed vào Postgres **trên VPS** qua SSH tunnel:

```bash
# Cửa sổ Git Bash 1 - giữ mở trong lúc seed
ssh -p 8686 -N -L 5434:127.0.0.1:5433 luatng304@160.30.161.237
```

```powershell
# Cửa sổ PowerShell 2 - trong api/, dùng user/pass trong .env TRÊN VPS
$env:DATABASE_URL = "postgresql://<user>:<pass>@localhost:5434/trekGo?schema=public"
$env:DIRECT_URL = $env:DATABASE_URL
npx prisma db seed
```

Seed xong thì đóng terminal, để `npm run start:dev` quay lại dùng `.env`.

## C2. Truy cập database trên VPS

Postgres chỉ mở cho `127.0.0.1` của VPS. **Không** mở thẳng ra internet.

- **DBeaver:** kết nối PostgreSQL tới `localhost:5433`, DB `trekGo`. Ở tab **SSH**, bật tunnel: host `160.30.161.237`, port `8686`, user `luatng304`.
- **Prisma Studio:** mở tunnel như mục C1, rồi chạy `$env:DATABASE_URL = "...@localhost:5434/trekGo?schema=public"; npx prisma studio`.
- **psql trên VPS:** `cd ~/trekgo && docker compose exec postgres psql -U <POSTGRES_USER> -d trekGo`. Gõ `\dt` để xem bảng, `\q` để thoát.
- **Mongo trên VPS:** `docker compose exec mongo mongo vina_trekgo_notifications` (VPS dùng `mongo:4.4` nên lệnh là `mongo`; ở local `mongo:7` dùng `mongosh`).

## C3. Chuyển dữ liệu cũ sang

```bash
pg_dump -U postgres -h localhost -p 5432 -Fc trekGo > trekgo.dump
docker compose cp trekgo.dump postgres:/tmp/trekgo.dump
docker compose exec postgres pg_restore -U <POSTGRES_USER> -d <POSTGRES_DB> --clean --if-exists /tmp/trekgo.dump
docker compose restart api
```

> ⚠️ `docker compose down -v` **xoá luôn volume, tức là mất toàn bộ dữ liệu**. Muốn dừng thì dùng `docker compose down` (không có `-v`).

## C4. Mở Postgres ra internet cho team

`docker-compose.vps.yml` mở Postgres ở cổng **`54329`** (ngoài cổng `127.0.0.1:5433` cho SSH tunnel). Docker **đi vòng qua `ufw`**, nên bắt buộc phải chặn bằng iptables `DOCKER-USER`, chỉ cho IP của team. **Làm bước 1 trước khi deploy** bản compose mở cổng.

**1. Chỉ cho IP của team** (trên VPS; xem IP của mỗi người tại https://ifconfig.me):

```bash
IFACE=$(ip route get 1.1.1.1 | awk '{print $5; exit}')    # card mạng ra internet, vd eth0

# Mỗi IP được phép một dòng ACCEPT
sudo iptables -I DOCKER-USER -i $IFACE -p tcp --dport 5432 -s <IP-nguoi-1> -j ACCEPT
sudo iptables -I DOCKER-USER -i $IFACE -p tcp --dport 5432 -s <IP-nguoi-2> -j ACCEPT

# Chặn mọi IP khác từ internet vào Postgres (luôn ở CUỐI)
sudo iptables -A DOCKER-USER -i $IFACE -p tcp --dport 5432 -j DROP

# Lưu để giữ sau khi VPS khởi động lại
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

- `--dport 5432` là cổng **bên trong container**, không phải `54329`: Docker đã đổi cổng trước khi gói tin tới `DOCKER-USER`.
- `-i $IFACE` để rule chỉ áp với kết nối **từ internet**, không chặn API trong Docker kết nối tới Postgres.
- Xem rule hiện có: `sudo iptables -L DOCKER-USER -n -v --line-numbers`.
- IP của ai đó thay đổi: thêm dòng `ACCEPT` mới bằng `-I` (chèn lên đầu), rồi `sudo netfilter-persistent save`. Xoá rule cũ: `sudo iptables -D DOCKER-USER <số-dòng>`.

**2. Deploy** `docker-compose.vps.yml` (push lên `deploy/docker`, hoặc chạy tay trên VPS `docker compose up -d postgres`).

**3. Kiểm tra:**

```bash
# Trên VPS: phải thấy 0.0.0.0:54329->5432
docker compose ps postgres
```

Từ máy được phép (PowerShell): `Test-NetConnection 160.30.161.237 -Port 54329` phải ra `TcpTestSucceeded : True`. Từ IP không được phép (ví dụ 4G điện thoại) thì phải **không** kết nối được.

**4. Chuỗi kết nối** cho `.env` của từng người:

```
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@160.30.161.237:54329/trekGo?schema=public
DIRECT_URL=postgresql://postgres:<POSTGRES_PASSWORD>@160.30.161.237:54329/trekGo?schema=public
```

Mật khẩu có ký tự đặc biệt phải mã hoá URL (`@` → `%40`, `#` → `%23`, `/` → `%2F`). Gửi chuỗi này qua kênh riêng.

**Quy tắc khi dùng chung DB này:**

- **Không** chạy `prisma migrate dev`, `migrate reset`, `db push` vào DB này. Migration chỉ được áp qua deploy (container `api` tự chạy `migrate deploy`).
- API chạy local trỏ vào DB này nên tắt worker: `PAYMENT_EVENTS_WORKER_ENABLED=false`, `PAYMENT_RECOVERY_WORKER_ENABLED=false`, `BOOKING_EXPIRY_WORKER_ENABLED=false`, `NOTIFICATION_CONSUMER_ENABLED=false`, `RENTAL_DOCUMENT_WORKER_ENABLED=false`.
- Mật khẩu `postgres` phải mạnh (24+ ký tự ngẫu nhiên). Đổi mật khẩu thì phải sửa cả `POSTGRES_PASSWORD`, `DATABASE_URL`, `DIRECT_URL` trong `TREKGO_ENV`.
- Postgres trong image không bật SSL: dữ liệu truyền qua internet **không được mã hoá**.

**Đóng lại:** xoá dòng `"54329:5432"` trong `docker-compose.vps.yml` rồi deploy.

---

# Phần D. Các lệnh thường dùng

| Việc cần làm | Lệnh |
| --- | --- |
| Xem trạng thái | `docker compose ps` |
| Xem log API | `docker compose logs -f --tail 50 api` |
| Build lại và chạy (local) | `docker compose up -d --build` |
| Áp dụng env mới | `docker compose up -d` |
| Khởi động lại API | `docker compose restart api` |
| Tạm dừng API | `docker compose stop api` |
| Dừng tất cả (giữ dữ liệu) | `docker compose down` |
| Vào shell trong API | `docker compose exec api sh` |
| Xem image | `docker images` (không phải `docker images ls`) |
| Dọn image cũ | `docker image prune -f` |

# Phần E. Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân / cách xử lý |
| --- | --- |
| `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL` | Giá trị env còn dấu ngoặc kép. Bỏ `"` trong file env. |
| `getaddrinfo ENOTFOUND ...` | Host DB sai (còn ngoặc kép, gõ sai tên service), hoặc mật khẩu có ký tự đặc biệt chưa mã hoá (`@` → `%40`, `#` → `%23`). |
| `connect ECONNREFUSED 127.0.0.1:5432` | Đang dùng `localhost` trong env. Đổi thành `postgres` (Mongo: `mongo`, Redis: `redis`). |
| `Could not load the "sharp" module ... require v2 microarchitecture` | CPU ảo của VPS thiếu bộ lệnh x86-64-v2. Nhờ nhà cung cấp đổi **CPU type sang `host`** (xem B1). |
| Container `mongo` khởi động lỗi liên tục | CPU không có AVX. Dùng `mongo:4.4` (healthcheck dùng `mongo` thay cho `mongosh`). |
| `password authentication failed` | Mật khẩu trong `DATABASE_URL` khác `POSTGRES_PASSWORD`. `POSTGRES_PASSWORD` chỉ có tác dụng **lần đầu** tạo volume; đổi sau đó phải đổi trong psql (`ALTER USER ... PASSWORD '...'`). |
| Log lặp lại `... unavailable; retrying on next tick` | Các worker không kết nối được DB. Sửa kết nối DB là hết. |
| `Invalid VNPAY_SANDBOX_RETURN_URL` / `Invalid MOMO_SANDBOX_...` | URL phải là `https://...` hoặc `http://localhost...`. |
| API tắt ngay, log có lỗi Prisma migrate | Migration lỗi; đọc log. Không dùng `migrate reset` / `db push` để "sửa". |
| API tắt ngay, log báo lỗi env | Thiếu hoặc sai biến (Zod kiểm tra lúc khởi động). So lại với `.env.docker.example`. |
| `no configuration file provided: not found` | Đứng sai thư mục. Local: `cd api`. VPS: `cd ~/trekgo`. |
| `ssh: connect to host ... port 22: Connection refused` | VPS dùng cổng SSH `8686`: `ssh -p 8686 ...` (scp dùng `-P 8686`). |
| `port is already allocated` | Cổng 3000 đang bị dùng (có thể do `npm run start:dev`). Tắt app đó, hoặc đổi `"3000:3000"` thành `"3001:3000"`. |
| Job **Deploy to VPS** lỗi đăng nhập SSH | Kiểm tra `VPS_HOST`, `VPS_PORT=8686`, `VPS_USER`, `VPS_PASSWORD`. |
| Job deploy lỗi `pull access denied` | Sai `DOCKERHUB_USERNAME` / token, hoặc repo private mà token không có quyền. |
| Code mới không có tác dụng | Local: thiếu `--build`. VPS: xem tab Actions đã chạy xong chưa, hoặc chạy tay `docker compose pull api && docker compose up -d`. |
| Gọi `http://160.30.161.237:3000` không được nữa | Đúng như thiết kế: cổng 3000 chỉ mở cho chính VPS. Dùng `http://160.30.161.237` (qua Nginx). |
| `502 Bad Gateway` từ Nginx | Container `api` chưa chạy hoặc đang khởi động lại. Xem `docker compose ps` và log `api`. |
| `413 Request Entity Too Large` | File upload vượt `client_max_body_size` trong cấu hình Nginx. |
| Màn hình kẹt ở `lines 1-22/22 (END)` | Đang ở chế độ xem trang. Nhấn `q` để thoát. |
| Hết dung lượng ổ đĩa | `docker system prune` (không xoá volume). |
