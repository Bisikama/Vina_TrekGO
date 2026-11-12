# Hướng dẫn deploy TrekGO Web (Next.js) lên VPS

> Web chạy bằng Docker trên cùng VPS với API, đi qua Nginx + HTTPS.
> Phần API xem [../BLOG_DEPLOY_API.md](../BLOG_DEPLOY_API.md) và [../api/HUONG_DAN_DOCKER.md](../api/HUONG_DAN_DOCKER.md).

## 0. Kết quả

```
Push code (web/**) lên nhánh deploy/docker
        │
        ▼
GitHub Actions ─ Job 1: build image từ web/ → push Docker Hub (luatng304/trekgo-web:latest + :sha-xxxxxxx)
        │
        ▼
GitHub Actions ─ Job 2: SSH vào VPS → ~/trekgo-web → docker compose pull && up -d
        │
        ▼
VPS: Nginx (80/443, HTTPS Let's Encrypt) ──► 127.0.0.1:5000  container web (Next.js standalone)
                                                 │
                                                 └─ trình duyệt gọi API: https://api.trekgo.website
```

- Web: `https://trekgo.website` và `https://www.trekgo.website`
- API: `https://api.trekgo.website`

| File | Vai trò |
| --- | --- |
| `web/next.config.ts` | `output: 'standalone'` → build gọn cho Docker |
| `web/Dockerfile` | Build 3 stage, chạy `node server.js` ở cổng 5000 |
| `web/.dockerignore` | Không đưa `node_modules`, `.next`, `.env*` vào image |
| `web/docker-compose.vps.yml` | Compose trên VPS (thư mục `~/trekgo-web`) |
| `.github/workflows/web-docker-image.yml` | CI/CD: build, push, deploy |

---

## 1. Cấu hình build

### `next.config.ts`
Thêm `output: 'standalone'`. Khi build, Next.js tạo `.next/standalone/server.js` kèm `node_modules` tối thiểu → image nhỏ (~80MB).

### `NEXT_PUBLIC_API_URL` được nhúng lúc BUILD
- Biến `NEXT_PUBLIC_*` và `rewrites()` trong `next.config.ts` được ghi cứng vào code khi `npm run build`, **không** đọc lúc container chạy.
- Đổi URL API ⇒ phải **build lại image** (push lại hoặc bấm Run workflow).
- Phải là URL **public HTTPS** (`https://api.trekgo.website`), vì trình duyệt của người dùng gọi trực tiếp. Không dùng `localhost` hay `http://api:3000`.
- Mặc định workflow dùng `https://api.trekgo.website`. Muốn đổi: GitHub → Settings → Secrets and variables → Actions → tab **Variables** → tạo `NEXT_PUBLIC_API_URL`.

### Thử build ở máy local
```bash
cd web
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.trekgo.website -t trekgo-web:test .
docker run --rm -p 5000:5000 trekgo-web:test     # mở http://localhost:5000
```

---

## 2. Docker Hub

- Gói free chỉ có **1 repo private** (đang dùng cho `trekgo-api`) → `trekgo-web` để **Public**.
- Public an toàn vì image web không chứa bí mật: `.env` bị loại bởi `.dockerignore`, còn code frontend vốn ai cũng xem được trên trình duyệt.
- Tạo trước repo `trekgo-web` ở chế độ **Public** trên hub.docker.com để lần push đầu không bị lỗi vượt giới hạn private.

---

## 3. GitHub Actions

Workflow `.github/workflows/web-docker-image.yml` chạy khi:
- push lên nhánh `deploy/docker` **và** có file thay đổi trong `web/**` (hoặc chính file workflow), hoặc
- bấm **Run workflow** bằng tay ở tab Actions.

**Không cần secret mới**, dùng chung với workflow API:

| Secret | Ý nghĩa |
| --- | --- |
| `DOCKERHUB_USERNAME` | Tài khoản Docker Hub |
| `DOCKERHUB_TOKEN` | Access token quyền Read & Write |
| `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_PASSWORD` | SSH vào VPS |

Ghi chú:
- Chỉ build `linux/amd64` (VPS là amd64) cho nhanh.
- Cache build tách riêng (`scope=web`) để không đụng cache của API.
- Web nằm ở `~/trekgo-web` trên VPS, **tách khỏi** `~/trekgo` của API, vì workflow API ghi đè `~/trekgo/docker-compose.yml` mỗi lần deploy.

---

## 4. DNS

Trang quản lý tên miền → Cấu hình bản ghi:

| Host | Loại | Giá trị | TTL |
| --- | --- | --- | --- |
| `@` | A | `160.30.161.237` | 300 |
| `www` | A | `160.30.161.237` | 300 |
| `api` | A | `160.30.161.237` | 300 (đã có từ lúc làm API) |

- `@` = tên miền gốc `trekgo.website`; `www` = `www.trekgo.website` (tên khác, phải khai báo riêng).

Kiểm tra (đợi 5–15 phút):
```bash
nslookup trekgo.website 8.8.8.8
nslookup www.trekgo.website 8.8.8.8      # cả hai phải ra 160.30.161.237
```

---

## 5. Nginx + HTTPS (làm 1 lần trên VPS)

```bash
ssh -p 8686 luatng304@160.30.161.237

# Kiểm tra container web
cd ~/trekgo-web && docker compose ps
curl -I http://127.0.0.1:5000             # HTTP/1.1 200 OK
```

Tạo cấu hình Nginx:
```bash
sudo tee /etc/nginx/sites-available/trekgo-web > /dev/null << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name trekgo.website www.trekgo.website;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/trekgo-web /etc/nginx/sites-enabled/trekgo-web
sudo nginx -t                             # syntax is ok / test is successful
sudo systemctl reload nginx
curl -I http://trekgo.website             # HTTP/1.1 200 OK
```

- `client_max_body_size 20M`: cho phép upload tối đa 20MB/request (mặc định Nginx chỉ 1MB → lỗi `413`). File Nginx của API cũng phải có dòng này.
- File cấu hình API (`trekgo`) và web (`trekgo-web`) chạy song song, Nginx phân biệt bằng `server_name`.

Cài HTTPS (chỉ chạy khi DNS đã trỏ đúng):
```bash
sudo certbot --nginx -d trekgo.website -d www.trekgo.website   # hỏi redirect thì chọn 2
sudo certbot renew --dry-run                                     # all simulated renewals succeeded
```
Chứng chỉ tự gia hạn mỗi 90 ngày.

---

## 6. Cấu hình phía API

- **CORS:** không cần sửa, API đang cho phép mọi origin (`origin: true` trong `api/src/main.ts`, socket `origin: '*'`).
- **URL chuyển về web sau thanh toán:** sửa trong secret `TREKGO_ENV` (dán lại **toàn bộ** nội dung `.env`):
  ```env
  WEB_APP_ORIGIN=https://trekgo.website
  VNPAY_SANDBOX_RETURN_URL=https://trekgo.website/bookings
  MOMO_SANDBOX_REDIRECT_URL=https://trekgo.website/bookings
  PAYOS_RETURN_URL=https://trekgo.website/bookings
  PAYOS_CANCEL_URL=https://trekgo.website/bookings
  ```
  Rồi Actions → **Docker Image - TrekGO API** → Run workflow.

---

## 7. Vận hành hằng ngày

| Việc | Lệnh / thao tác |
| --- | --- |
| Deploy bản mới | Push code `web/**` lên `deploy/docker` (tự động) |
| Deploy lại không đổi code | Actions → Docker Image - TrekGO Web → Run workflow |
| Xem trạng thái | `cd ~/trekgo-web && docker compose ps` |
| Xem log | `docker compose logs -f --tail 100 web` |
| Khởi động lại | `docker compose restart web` |
| Quay về bản cũ | Sửa `image:` thành `luatng304/trekgo-web:sha-xxxxxxx` trong `~/trekgo-web/docker-compose.yml` → `docker compose up -d` |
| Log Nginx | `sudo tail -50 /var/log/nginx/error.log` |

> Quay về bản cũ chỉ là tạm thời: lần deploy kế tiếp workflow sẽ ghi đè lại `docker-compose.yml` với tag `latest`.

### Kiểm tra container và log (API + Web)

SSH vào VPS trước: `ssh -p 8686 luatng304@160.30.161.237`

**Tổng quan container**
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"   # đang chạy (nên có 5: web, api, postgres, mongo, redis)
docker ps -a                                                     # cả container đã dừng / lỗi (Exited)
docker stats --no-stream                                         # CPU, RAM từng container
free -h && df -h /                                               # RAM và ổ đĩa của cả VPS
```

**Log Web** (thư mục `~/trekgo-web`)
```bash
cd ~/trekgo-web
docker compose logs --tail 100 web            # 100 dòng cuối
docker compose logs -f --tail 50 web          # theo dõi trực tiếp, Ctrl + C để thoát
docker compose logs --since 30m web           # log 30 phút gần nhất
docker compose logs web 2>&1 | grep -i error  # chỉ dòng lỗi
```

**Log API** (thư mục `~/trekgo`)
```bash
cd ~/trekgo
docker compose logs --tail 100 api
docker compose logs -f --tail 50 api
docker compose logs --since 1h api
docker compose logs api 2>&1 | grep -iE "error|exception" | tail -30
```

**Log database / cache** (khi API báo lỗi kết nối)
```bash
cd ~/trekgo
docker compose logs --tail 50 postgres
docker compose logs --tail 50 mongo
docker compose logs --tail 50 redis
docker compose logs postgres 2>&1 | grep -i "authentication failed" | tail -5   # có bot dò mật khẩu không
```

**Không cần `cd`** (dùng tên container)
```bash
docker logs --tail 100 trekgo-web-web-1
docker logs -f --tail 50 trekgo-api-1
```

**Log Nginx** (request vào web / API)
```bash
sudo tail -f /var/log/nginx/access.log        # mọi request, Ctrl + C để thoát
sudo tail -50 /var/log/nginx/error.log        # lỗi 502, 413, ...
sudo grep " 50[0-9] " /var/log/nginx/access.log | tail -20   # request trả lỗi 5xx
```

> Mẹo: mở 2 cửa sổ SSH, một bên `docker compose logs -f api`, một bên `docker compose logs -f web`, rồi thao tác trên trình duyệt để thấy lỗi ngay khi xảy ra.

---

## 8. Lỗi thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
| --- | --- | --- |
| `502 Bad Gateway` | Container web không chạy | `docker compose ps`, `docker compose logs --tail 50 web` |
| `413 Request Entity Too Large` | Upload vượt `client_max_body_size` | Tăng giá trị trong file Nginx (web và API), reload |
| certbot báo `NXDOMAIN` / `unauthorized` | DNS chưa trỏ đúng | Kiểm tra `nslookup`, đợi thêm |
| Web gọi nhầm `localhost:3000` | Build thiếu `NEXT_PUBLIC_API_URL` | Kiểm tra Variable / build-arg, build lại |
| Thanh toán xong về `localhost` | URL redirect trong `TREKGO_ENV` chưa sửa | Làm lại mục 6 |
| Push image lỗi `denied` / vượt giới hạn | Repo `trekgo-web` đang private | Chuyển repo sang Public trên Docker Hub |
| Workflow web không chạy | Không có thay đổi trong `web/**` | Bấm Run workflow bằng tay |

---

## Checklist

- [ ] `output: 'standalone'`, `Dockerfile`, `.dockerignore`
- [ ] Repo Docker Hub `trekgo-web` (Public)
- [ ] Workflow `web-docker-image.yml` chạy xanh cả 2 job
- [ ] `curl -I http://127.0.0.1:5000` ra 200 trên VPS
- [ ] Bản ghi DNS `@` và `www`
- [ ] Nginx `trekgo-web` + `client_max_body_size`
- [ ] `certbot --nginx` + `renew --dry-run`
- [ ] Sửa URL redirect thanh toán trong `TREKGO_ENV`, chạy lại workflow API
