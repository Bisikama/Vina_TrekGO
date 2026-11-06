# Deploy NestJS API lên VPS bằng Docker, GitHub Actions, Nginx và HTTPS: ghi chép từ A đến Z

> Ghi lại toàn bộ quá trình deploy **TrekGo API** (NestJS 11 + Prisma 6 + PostgreSQL + MongoDB + Redis) lên một VPS Ubuntu, để lần sau làm lại cho dự án khác.
> Mỗi bước gồm: **mình đã yêu cầu AI (Claude Code) thế nào**, **file / lệnh cụ thể**, và **lỗi gặp phải + cách sửa**.
> Tài liệu vận hành hằng ngày nằm ở [HUONG_DAN_DOCKER.md](HUONG_DAN_DOCKER.md); file này là câu chuyện và checklist để tái sử dụng.

---

## 0. Kết quả cuối cùng

```
Dev push code (api/**) lên nhánh deploy/docker
        │
        ▼
GitHub Actions ─ Job 1: build image từ api/ → push Docker Hub (luatng304/trekgo-api:latest + :sha-xxxxxxx)
        │
        ▼
GitHub Actions ─ Job 2: SSH vào VPS → ghi docker-compose.yml + .env → docker compose pull && up -d
        │
        ▼
VPS Ubuntu
  Nginx (80/443, HTTPS Let's Encrypt, HTTP/2)  ──►  127.0.0.1:3000  container api (tự chạy prisma migrate deploy)
                                                                     ├── postgres:16   (volume, cổng 54329 cho team)
                                                                     ├── mongo:4.4     (volume)
                                                                     └── redis:7       (volume)
```

- API: `https://api.trekgo.website` (Swagger: `/docs`)
- Web và mobile vẫn chạy local, gọi API trên VPS.
- Thanh toán MoMo/VNPAY sandbox gọi IPN về `https://api.trekgo.website/...` (không cần ngrok).

**Danh sách file tạo ra trong repo:**

| File | Vai trò |
| --- | --- |
| `api/Dockerfile` | Build image 2 stage, tự migrate khi khởi động |
| `api/.dockerignore` | Không đưa `node_modules`, `.env`, secret vào image |
| `api/docker-compose.yml` | Chạy ở máy local (build từ code) |
| `api/docker-compose.vps.yml` | Chạy trên VPS (image từ Docker Hub) |
| `api/.env.docker.example` | Mẫu env cho Docker |
| `.github/workflows/api-docker-image.yml` | CI/CD: build, push, deploy |
| `api/HUONG_DAN_DOCKER.md` | Hướng dẫn vận hành |

---

## 1. Viết Dockerfile

### Mình đã yêu cầu như thế nào

> **Prompt:** "bạn hãy hoàn thành file Dockerfile này giúp mình nha" (đang mở file `api/Dockerfile` trống)

AI tự đọc `package.json`, `nest-cli.json`, `prisma/schema.prisma`, `src/main.ts` để biết: Node version, lệnh build, đường dẫn output, Prisma cần `openssl`, cổng `3000`.

**Mẹo khi tái sử dụng:** để AI tự khảo sát dự án thay vì mô tả tay. Nếu dùng tay thì cần biết: lệnh build, file `main.js` nằm ở đâu sau build, có Prisma không, app lắng nghe cổng nào và có bind `0.0.0.0` không.

### File `api/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1

# ---------- Stage 1: install deps + build ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# openssl is required by the Prisma engines
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN NODE_ENV=production npm run build

# Drop devDependencies but keep the generated Prisma client (node_modules/.prisma)
RUN npm prune --omit=dev

# ---------- Stage 2: runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma

USER node
EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
# Apply pending migrations (additive only, never resets data), then start the API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
```

**Giải thích các quyết định:**

| Điểm | Lý do |
| --- | --- |
| 2 stage (`build` → `runtime`) | Image cuối không chứa source TS, devDependencies |
| `COPY package*.json` rồi `npm ci` trước `COPY . .` | Cache layer: sửa code không phải cài lại package |
| `bookworm-slim` (Debian), không dùng `alpine` | Prisma và `sharp` chạy ổn định hơn trên glibc |
| `openssl` | Prisma engine cần |
| `tini` | Nhận tín hiệu tắt (SIGTERM) đúng cách, không để lại tiến trình zombie |
| `USER node` | Không chạy app bằng root |
| `dist/src/main.js` | Vì `prisma/` cũng được compile nên output nằm ở `dist/src/`, **không phải** `dist/main.js`. Kiểm tra bằng `Test-Path dist/src/main.js` sau `npm run build`. |
| `prisma migrate deploy` trong `CMD` | Migrate chạy **lúc khởi động container** (khi đã có DB), không phải lúc build |
| `prisma` nằm trong `dependencies` | Nếu để ở `devDependencies`, `npm prune --omit=dev` sẽ xoá Prisma CLI, khi đó `npx prisma migrate deploy` phải tải Prisma từ mạng mỗi lần khởi động |

### File `api/.dockerignore`

```
node_modules
dist
.env
.env.*
!.env.example
*.tsbuildinfo
test-results.json
.git
.claude
.agents
.windsurf
coverage
*.log
```

**Quan trọng:** `.env` không bao giờ được vào image. Image đẩy lên Docker Hub mà chứa `.env` thì ai pull về cũng đọc được secret.

### Lệnh build và chạy thử

```bash
cd api
docker build -t trekgo-api .
docker images trekgo-api
```

---

## 2. Chạy thử bằng `docker run` và các lỗi env đầu tiên

> **Prompt:** "tức là cần phải build mới chạy được hả" / "thêm cho tôi 1 file .md hướng dẫn chạy các lệnh docker"

```bash
docker run -d --name trekgo-api --env-file .env -p 3000:3000 trekgo-api
docker logs -f trekgo-api
```

### Lỗi 1: `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL`

> **Prompt:** dán nguyên log lỗi, rồi hỏi "đây là lỗi gì vậy"

**Nguyên nhân:** `.env` viết `SUPABASE_URL="https://..."`. `dotenv` (khi chạy local) tự bỏ dấu `"`, nhưng **`docker run --env-file` giữ nguyên dấu `"`**.

**Sửa:** tạo file env riêng cho Docker, không có ngoặc kép.

### Lỗi 2: `getaddrinfo ENOTFOUND base` và `connect ECONNREFUSED 127.0.0.1:5432`

**Nguyên nhân:**

1. Còn ngoặc kép trong `DATABASE_URL`, nên chuỗi bị đọc sai.
2. Trong container, **`localhost` là chính container**, không phải máy Windows.

**Sửa:** dùng `host.docker.internal` (khi DB chạy trên máy host), hoặc tốt hơn là chạy DB trong compose và dùng **tên service** (`postgres`, `mongo`, `redis`).

> **Bài học:** env cho Docker phải (1) **không có ngoặc kép**, (2) **không dùng `localhost`** cho các dịch vụ khác.

---

## 3. Docker Compose: API + Postgres + Mongo + Redis

> **Prompt:** "do khi tôi deploy thì tôi sử dụng vps thì sẽ cài luôn postgre trong vps thì nó có tự chạy npx migrate deploy không" → "nhưng mà dự án này có sử dụng thêm mongo nữa" → "okk bạn làm đi"

### Kiểm tra trước khi viết compose

```bash
# Biến env nào cần cho DB/Mongo/Redis?
grep -nE "MONGO|REDIS|DATABASE_URL" src/shared/config.ts
# Migration có cần extension nào không? (postgres:16 có sẵn btree_gist)
grep -rh "CREATE EXTENSION" prisma/migrations
```

### File `api/docker-compose.yml` (local, build từ code)

```yaml
x-env-files: &env-files
  - path: .env
    required: false
  - path: .env.docker
    required: false

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    env_file: *env-files
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

  mongo:
    image: mongo:7
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
    ports:
      - "127.0.0.1:27018:27017"
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  api:
    build: .
    image: trekgo-api
    restart: unless-stopped
    env_file: *env-files
    depends_on:
      postgres: { condition: service_healthy }
      mongo: { condition: service_healthy }
      redis: { condition: service_healthy }
    ports:
      - "3000:3000"

volumes:
  postgres_data:
  mongo_data:
  redis_data:
```

**Ý tưởng `env_file` 2 tầng:** ở local, `.env` dùng cho `npm run start:dev` (có `localhost`), còn `.env.docker` **ghi đè** các dòng host sang `postgres`/`mongo`/`redis`. Trên VPS chỉ có `.env`. Cú pháp `required: false` cần Docker Compose v2.24+.

### File env mẫu `api/.env.docker.example` (trích)

```env
# KHÔNG bọc giá trị trong "..."; KHÔNG dùng localhost cho DB/Mongo/Redis
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<mat-khau-manh>
POSTGRES_DB=trekGo
DATABASE_URL=postgresql://postgres:<mat-khau-manh>@postgres:5432/trekGo?schema=public
DIRECT_URL=postgresql://postgres:<mat-khau-manh>@postgres:5432/trekGo?schema=public
MONGODB_URI=mongodb://mongo:27017/vina_trekgo_notifications
REDIS_URL=redis://redis:6379
REDIS_ENABLED=true
# ... Supabase, Cloudinary, MoMo/VNPAY sandbox, rental, AI...
```

So sánh key giữa `.env` và file mẫu để không thiếu biến:

```powershell
function Keys($f) { Get-Content $f -Encoding UTF8 | Where-Object { $_ -match '^\s*[A-Za-z_]\w*\s*=' } | ForEach-Object { ($_ -split '=')[0].Trim() } | Sort-Object -Unique }
$e = Keys .env; $x = Keys .env.docker.example
$e | Where-Object { $x -notcontains $_ }     # có trong .env nhưng thiếu trong mẫu
```

### Lệnh chạy

```bash
cd api
cp .env.docker.example .env.docker      # rồi điền giá trị
docker compose up -d --build            # build + chạy 4 service
docker compose ps
docker compose logs -f --tail 50 api    # Ctrl + C để thoát
```

| Muốn | Lệnh |
| --- | --- |
| Sửa code xong chạy lại | `docker compose up -d --build` |
| Sửa env xong áp dụng | `docker compose up -d` |
| Dừng (giữ dữ liệu) | `docker compose down` |
| ⚠️ Xoá cả dữ liệu | `docker compose down -v` |

> **Lưu ý:** `prisma generate` chạy lúc **build**, còn `prisma migrate deploy` chạy lúc **container khởi động**. **Seed không tự chạy**, phải chạy tay.

---

## 4. Docker Hub

> **Prompt:** "vậy khi tôi đẩy image này lên docker hub bạn tôi lấy về chạy thì làm sao để họ có thể thêm env vào" / "tôi có cần tạo 1 repo trước trên docker hub không"

- **Không cần tạo repo trước:** `docker push` tự tạo repo (mặc định **public**). Tài khoản free được 1 repo private.
- **Env không nằm trong image**, nên người chạy phải tự cung cấp `.env`.

```bash
docker login
docker tag trekgo-api luatng304/trekgo-api:latest
docker push luatng304/trekgo-api:latest

# Build multi-platform (Intel/AMD + Mac chip M) và push một lệnh
docker buildx build --platform linux/amd64,linux/arm64 -t luatng304/trekgo-api:latest --push .
```

**Lấy image về và chạy bằng compose local** (không build lại):

```bash
docker pull luatng304/trekgo-api:latest
docker tag luatng304/trekgo-api:latest trekgo-api
docker compose up -d          # KHÔNG thêm --build
```

> **Lỗi gõ nhầm:** `docker images ls` báo `No images found matching "ls"`. Đúng là `docker images` **hoặc** `docker image ls`.
> **Lỗi đứng sai thư mục:** `no configuration file provided: not found`. Phải `cd api` (nơi có `docker-compose.yml`).

---

## 5. GitHub Actions: tự build và push image

> **Prompt:** "hiện tại bạn hãy tạo workflow của github action về việc tự tạo image khi tôi đẩy code mới vào nhánh deploy/docker và vì repo này có chứa luôn cả web và api và code chính đẩy lên image là chỉ có api thôi"

Sau đó gửi ảnh chụp danh sách secrets để AI sửa tên secret cho khớp.

### Secrets cần tạo (repo → Settings → Secrets and variables → Actions)

| Secret | Giá trị |
| --- | --- |
| `DOCKERHUB_USERNAME` | `luatng304` |
| `DOCKERHUB_TOKEN` (hoặc `DOCKERHUB_PASSWORD`) | **Access Token** tạo ở hub.docker.com → Account settings → Personal access tokens (Read & Write) |

### Trigger: chỉ nhánh `deploy/docker` + chỉ khi `api/` thay đổi

```yaml
on:
  push:
    branches: [deploy/docker]
    paths:
      - "api/**"
      - ".github/workflows/api-docker-image.yml"
  workflow_dispatch:          # nút "Run workflow" chạy tay

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true    # push liên tiếp → huỷ lần cũ
```

### Job build (trích)

```yaml
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-qemu-action@v3          # build được arm64
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN || secrets.DOCKERHUB_PASSWORD }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ secrets.DOCKERHUB_USERNAME }}/trekgo-api
          tags: |
            type=raw,value=latest
            type=sha,format=short
      - uses: docker/build-push-action@v6
        with:
          context: ./api                  # CHỈ build thư mục api/
          file: ./api/Dockerfile
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Tag:** `latest` bị thay mỗi lần; `sha-xxxxxxx` tạo mới mỗi commit, dùng để rollback.

**Vì sao lâu?** Phần `arm64` build qua giả lập QEMU, lần đầu mất 15–30 phút. Không cần Mac chip M thì để `platforms: linux/amd64`.

```bash
git add .github/workflows/api-docker-image.yml
git commit -m "ci: build and push api docker image"
git push origin deploy/docker
```

---

## 6. Mua và chuẩn bị VPS

> **Prompt:** gửi ảnh danh sách hệ điều hành rồi hỏi "về việc chọn mua vps thì tôi nên chọn cái nào"

- **Chọn Ubuntu 22.04 hoặc 24.04 LTS.** Tránh CentOS 7/8 (hết hỗ trợ), các bản cài sẵn Nginx/PHP/DirectAdmin, và Windows.
- **Cấu hình đã dùng:** 2 vCPU AMD EPYC, 4 GB RAM, 40 GB NVMe.

### SSH

Nhà cung cấp dùng cổng SSH **8686** (không phải 22), xem trong email bàn giao.

```bash
ssh -p 8686 luatng304@160.30.161.237        # đăng nhập (mật khẩu trong email)
exit                                         # thoát (hoặc Ctrl + D)
```

> **Lỗi:** `ssh: connect to host ... port 22: Connection refused` là do sai cổng. Dùng `-p 8686`. Với `scp` thì dùng **`-P 8686`** (viết hoa).

Thêm SSH key (tuỳ chọn, để khỏi nhập mật khẩu):

```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub            # xem public key (key dùng cho GitHub dùng lại được)
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh -p 8686 luatng304@160.30.161.237 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

### Cài Docker trên VPS

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit                                  # SSH vào lại để quyền có tác dụng
docker compose version
sudo systemctl status docker --no-pager
```

> Màn hình kẹt ở `lines 1-22/22 (END)` thì nhấn **`q`**.

### ⚠️ Kiểm tra CPU (bài học lớn nhất)

```bash
lscpu | grep -E "Model name|Hypervisor"
for f in cx16 lahf_lm popcnt sse4_1 sse4_2 ssse3 avx; do grep -qw $f /proc/cpuinfo && echo "OK    $f" || echo "THIEU $f"; done
```

**Chuyện đã xảy ra:** VPS quảng cáo "AMD EPYC" nhưng `lscpu` hiện `Common KVM processor`. Nhà cung cấp dùng **CPU ảo `kvm64`**, ẩn hết các tập lệnh của CPU thật:

| Thiếu | Hậu quả |
| --- | --- |
| `avx` | MongoDB 5+ không chạy, phải dùng `mongo:4.4` (healthcheck dùng `mongo` thay vì `mongosh`) |
| `sse4_2`, `popcnt`... (x86-64-v2) | `sharp` (xử lý ảnh) crash: `Could not load the "sharp" module ... require v2 microarchitecture`, nên API khởi động lại liên tục |

**Cách sửa:** nhắn nhà cung cấp:

> "VPS `<IP>` đang hiện CPU là *Common KVM processor*, không có các flag `sse4_2`, `popcnt`, `avx`, `avx2` (CPU EPYC đều hỗ trợ). Nhờ anh/chị đổi **CPU type sang `host`** giúp em. Em đồng ý restart VPS."

Sau khi họ sửa, VPS có x86-64-v2 (nên `sharp` chạy được) nhưng vẫn chưa có AVX, nên giữ `mongo:4.4`. Driver `mongodb` 7.x hỗ trợ tối thiểu MongoDB 4.4:

```bash
node -p "require('mongodb/package.json').version"
grep MIN_SUPPORTED_SERVER_VERSION node_modules/mongodb/lib/cmap/wire_protocol/constants.js
```

> **Checklist mua VPS lần sau:** hỏi trước "CPU có hỗ trợ AVX/AVX2 không, CPU type có phải `host` không".

---

## 7. Chạy lần đầu trên VPS

```bash
# Trên VPS
mkdir -p ~/trekgo
```

```bash
# Trên máy (Git Bash, trong api/): copy compose cho VPS và env
scp -P 8686 docker-compose.vps.yml luatng304@160.30.161.237:~/trekgo/docker-compose.yml
scp -P 8686 .env.docker luatng304@160.30.161.237:~/trekgo/.env
```

```bash
# Trên VPS
cd ~/trekgo
nano .env                        # sửa POSTGRES_PASSWORD, VNPAY_SANDBOX_API_IP...  (Ctrl+O, Enter, Ctrl+X)
docker compose up -d
docker compose ps
docker compose logs -f --tail 80 api
curl -I http://localhost:3000/docs       # HTTP/1.1 200 OK
```

> Mọi lệnh `docker compose` phải chạy **trong `~/trekgo`**. Mẹo: `echo 'cd ~/trekgo' >> ~/.bashrc`.

### File `api/docker-compose.vps.yml` (khác bản local)

- `api` dùng `image: luatng304/trekgo-api:latest`, **không** có `build: .`
- `mongo:4.4` (VPS không có AVX)
- API chỉ mở `127.0.0.1:3000:3000` (từ ngoài phải đi qua Nginx)
- Postgres: `127.0.0.1:5433:5432` (SSH tunnel) và `54329:5432` (team truy cập qua internet)

---

## 8. GitHub Actions: tự deploy lên VPS

> **Prompt:** "kiểm tra giúp tôi hiện tại khi tôi code mới lên nhánh deploy/docker thì nó có tự động deploy lại trên vps chưa" → "VPS_SSH_KEY với cái này dùng password được không" → "có (ghi đè .env bằng TREKGO_ENV) nhưng trước tiên tôi muốn lấy lại env trên vps để tôi có thể copy vào"

### Lấy `.env` trên VPS về để dán vào secret

```bash
scp -P 8686 luatng304@160.30.161.237:~/trekgo/.env ./.env.vps     # dán toàn bộ vào secret TREKGO_ENV rồi xoá file
```

### Secrets thêm

| Secret | Giá trị |
| --- | --- |
| `VPS_HOST` | `160.30.161.237` |
| `VPS_PORT` | `8686` |
| `VPS_USER` | `luatng304` |
| `VPS_PASSWORD` | mật khẩu SSH |
| `TREKGO_ENV` | toàn bộ nội dung `.env` **dành cho VPS** |

### Job deploy (trích)

```yaml
  deploy:
    needs: build-and-push           # build lỗi thì không deploy
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Prepare files
        env:
          TREKGO_ENV: ${{ secrets.TREKGO_ENV }}
        run: |
          ENV_B64=$(printf '%s\n' "$TREKGO_ENV" | tr -d '\r' | base64 -w0)
          if [ -z "$TREKGO_ENV" ]; then ENV_B64=""; fi
          echo "::add-mask::$ENV_B64"
          echo "ENV_B64=$ENV_B64" >> "$GITHUB_ENV"
          echo "COMPOSE_B64=$(base64 -w0 api/docker-compose.vps.yml)" >> "$GITHUB_ENV"
      - uses: appleboy/ssh-action@v1
        env:
          DH_USER: ${{ secrets.DOCKERHUB_USERNAME }}
          DH_TOKEN: ${{ secrets.DOCKERHUB_TOKEN || secrets.DOCKERHUB_PASSWORD }}
        with:
          host: ${{ secrets.VPS_HOST }}
          port: ${{ secrets.VPS_PORT }}
          username: ${{ secrets.VPS_USER }}
          password: ${{ secrets.VPS_PASSWORD }}
          envs: ENV_B64,COMPOSE_B64,DH_USER,DH_TOKEN
          script_stop: true
          script: |
            set -e
            mkdir -p ~/trekgo && cd ~/trekgo
            echo "$COMPOSE_B64" | base64 -d > docker-compose.yml
            if [ -n "$ENV_B64" ]; then
              [ -f .env ] && cp .env .env.bak
              echo "$ENV_B64" | base64 -d > .env
              chmod 600 .env
            fi
            echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin
            docker compose pull api
            docker compose up -d
            docker image prune -f
            sleep 15
            docker compose ps
            docker compose logs --tail 30 api
```

**Vì sao base64?** `.env` và compose có nhiều dòng, dấu nháy, ký tự đặc biệt. Mã hoá base64 rồi giải mã trên VPS tránh mọi lỗi quoting khi truyền qua SSH.

**Ghi nhớ:**

- **Không cần xoá container trước khi deploy.** `up -d` tự thay container `api`. Postgres, Mongo, Redis và dữ liệu không bị đụng tới.
- **Sửa secret `TREKGO_ENV` không có tác dụng ngay.** Phải chạy lại workflow (**Run workflow**), hoặc sửa `~/trekgo/.env` rồi `docker compose up -d`.
- Rollback: đổi `latest` thành `sha-xxxxxxx` trong `docker-compose.yml` trên VPS rồi `docker compose up -d`.

---

## 9. Seed dữ liệu và truy cập DB trên VPS

> **Prompt:** "dữ liệu và seed có tự động nạp qua không hay cần chạy seed thủ công" / "hiện tại có cách nào để tôi có thể truy cập vào db trên vps không"

### Seed qua SSH tunnel

```bash
# Cửa sổ 1 (giữ mở)
ssh -p 8686 -N -L 5434:127.0.0.1:5433 luatng304@160.30.161.237
```

```powershell
# Cửa sổ 2, trong api/
$env:DATABASE_URL = "postgresql://postgres:<mat-khau>@localhost:5434/trekGo?schema=public"
$env:DIRECT_URL = $env:DATABASE_URL
npx prisma db seed
npm run seed:booking-policies
```

### DBeaver qua SSH tunnel

- **Main:** Host `localhost`, Port `5433`, Database `trekGo`, User/Password = `POSTGRES_USER`/`POSTGRES_PASSWORD` trên VPS
- **SSH** (nút "+ SSH, SSL, ..."): Host `160.30.161.237`, Port `8686`, User `luatng304`, Password
- SQL Editor: `Ctrl + ]`. Chạy câu lệnh: `Ctrl + Enter`.

> **"Sao không thấy bảng migrate?"** DBeaver mặc định mở DB `postgres` (trống), phải chọn **`trekGo`**. Prisma Studio **không** hiện `_prisma_migrations` vì đó không phải model.

### Mở Postgres ra internet cho team (cổng 54329)

> **Prompt:** "ví dụ tôi muốn họ chỉ cần chuỗi kết nối này vào là kết nối được thì làm sao"

1. Tạo mật khẩu mạnh **trên VPS**, không dán vào chat:
   ```bash
   openssl rand -hex 16
   ```
2. Cập nhật `POSTGRES_PASSWORD`, `DATABASE_URL`, `DIRECT_URL` trong **secret `TREKGO_ENV`** và **`~/trekgo/.env`**.
3. Đổi mật khẩu (không lưu vào lịch sử lệnh):
   ```bash
   cd ~/trekgo
   docker compose exec postgres psql -U postgres
   # \password postgres     (nhập 2 lần)     \q
   docker compose up -d
   ```
4. Thêm `- "54329:5432"` vào `docker-compose.vps.yml` rồi push.
5. Kiểm tra từ máy:
   ```powershell
   Test-NetConnection 160.30.161.237 -Port 54329
   ```

**Hai loại chuỗi kết nối (rất dễ nhầm):**

| Dùng ở đâu | `DATABASE_URL` |
| --- | --- |
| `.env` trên VPS / `TREKGO_ENV` (API trong Docker) | `postgresql://postgres:<pw>@postgres:5432/trekGo?schema=public` |
| `.env` máy dev / Prisma Studio / DBeaver | `postgresql://postgres:<pw>@160.30.161.237:54329/trekGo?schema=public` |

> **Lỗi:** chạy `npx prisma studio` trên máy với host `postgres:5432` sẽ lỗi, vì tên `postgres` chỉ tồn tại trong mạng Docker.

> **Muốn chỉ cho một số IP:** Docker publish cổng **đi vòng qua `ufw`**, phải dùng iptables `DOCKER-USER` (xem HUONG_DAN_DOCKER.md mục C4).

### Chạy API local trỏ vào DB trên VPS: tắt worker

API có nhiều worker nền (`@Interval`/`@Cron`). Hai API (local + VPS) cùng chạy worker trên một DB thì code local đang sửa dở có thể làm sai trạng thái thanh toán/booking, hoặc đẩy sự kiện sang `FAILED`/`NEEDS_REVIEW`. Trong `api/.env` local:

```env
PAYMENT_EVENTS_WORKER_ENABLED=false
PAYMENT_RECOVERY_WORKER_ENABLED=false
BOOKING_EXPIRY_WORKER_ENABLED=false
NOTIFICATION_CONSUMER_ENABLED=false
RENTAL_DOCUMENT_WORKER_ENABLED=false
TRIP_CANCELLATION_WORKER_ENABLED=false
```

Và **tuyệt đối không** chạy `prisma migrate dev`, `migrate reset`, `db push` lên DB dùng chung.

---

## 10. Nginx reverse proxy

> **Prompt:** "hiện tại tôi đã cài nginx" (dán log `apt install nginx`)

```bash
sudo apt-get update && sudo apt-get install -y nginx
systemctl status nginx --no-pager
curl -I http://localhost
```

Tạo cấu hình (dán nguyên khối, không cần `nano`):

```bash
sudo tee /etc/nginx/sites-available/trekgo > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;
    client_max_body_size 110m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
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
sudo nginx -t
sudo systemctl reload nginx
curl -I http://localhost/docs        # phải có dòng X-Powered-By: Express
```

Sau đó đổi cổng API trong `docker-compose.vps.yml` thành `"127.0.0.1:3000:3000"` để từ ngoài **chỉ** vào được qua Nginx.

> **Về `ufw`:** `sudo ufw status` ra `inactive` nghĩa là firewall đang tắt, mọi cổng mở. Nếu bật thì **mở cổng SSH trước**: `sudo ufw allow 8686/tcp && sudo ufw allow 'Nginx Full' && sudo ufw enable`.

---

## 11. Tên miền và HTTPS (Let's Encrypt)

> **Prompt:** "tiếp theo tôi muốn cấu hình https.ssl" → "hiện tại có cách nào khác vì tôi chưa muốn deploy web" → "đợi tôi 1 tí tôi sẽ mua domain"

- Let's Encrypt **không cấp cho IP trần**, nên cần tên miền. Chưa muốn mua thì có thể dùng `160-30-161-237.sslip.io` (miễn phí, tự trỏ về IP).
- HTTPS cho API **không** cần deploy web.
- Đã mua `trekgo.website`. Lúc mua: **bỏ qua Hosting**, **để trống Nameservers**.

### Bản ghi DNS (trang quản lý tên miền → DNS)

| Host | Loại | Giá trị | TTL |
| --- | --- | --- | --- |
| `api` | `A` | `160.30.161.237` | `3600` |

Bấm **Lưu cấu hình**. TTL là thời gian (giây) các DNS server cache bản ghi; `300` giúp đổi IP nhanh hơn.

```powershell
nslookup -type=ns trekgo.website 8.8.8.8      # tên miền đã kích hoạt chưa
nslookup api.trekgo.website 8.8.8.8           # phải ra Address: 160.30.161.237
```

> Dùng DNS `8.8.8.8` để kiểm tra; DNS của router (`fe80::1`) có thể không trả lời.

### Cấp chứng chỉ (trên VPS, đứng đâu cũng được)

```bash
sudo sed -i 's/server_name _;/server_name api.trekgo.website;/' /etc/nginx/sites-available/trekgo
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.trekgo.website      # nhập email, gõ Y

curl -I https://api.trekgo.website/docs
sudo certbot renew --dry-run                    # "all simulated renewals succeeded"
```

Certbot tự cấu hình cổng 443, chuyển `http` sang `https`, và tự gia hạn mỗi 90 ngày.

### Cập nhật mọi nơi sang `https://api.trekgo.website`

| Ở đâu | Giá trị |
| --- | --- |
| `TREKGO_ENV` + `~/trekgo/.env` | `MOMO_SANDBOX_IPN_URL=https://api.trekgo.website/api/v1/payments/webhooks/momo` |
| VNPAY Sandbox Merchant Portal | IPN `https://api.trekgo.website/api/v1/payments/webhooks/vnpay` |
| `web/.env.local` | `NEXT_PUBLIC_API_URL=https://api.trekgo.website` |
| `mobile/.env` | `EXPO_PUBLIC_API_URL=https://api.trekgo.website` |

Áp dụng env ngay trên VPS:

```bash
cd ~/trekgo
sed -i 's#^MOMO_SANDBOX_IPN_URL=.*#MOMO_SANDBOX_IPN_URL=https://api.trekgo.website/api/v1/payments/webhooks/momo#' .env
docker compose up -d
docker compose exec api printenv MOMO_SANDBOX_IPN_URL
```

**Lưu ý thanh toán sandbox:**

- `VNPAY_SANDBOX_API_IP` là chiều **VPS → VNPAY** (querydr, refund). IPN là chiều **VNPAY → VPS**, cấu hình trên Merchant Portal. Hai thứ khác nhau.
- `VNPAY_SANDBOX_RETURN_URL`, `MOMO_SANDBOX_REDIRECT_URL` chỉ chấp nhận `https://...` hoặc `http://localhost...`. FE chạy local thì giữ `http://localhost:5000/...`.
- Kiểm tra IPN có về:
  ```bash
  sudo tail -f /var/log/nginx/access.log | grep webhooks
  ```
  Các dòng `Mapped {/api/v1/payments/webhooks/...}` trong log API chỉ là route đã đăng ký, **chưa phải** IPN gọi tới.

---

## 12. HTTP/2

> **Prompt:** "tiếp theo tôi muốn kích hoạt http2"

```bash
grep -n "listen" /etc/nginx/sites-available/trekgo
sudo cp /etc/nginx/sites-available/trekgo /etc/nginx/sites-available/trekgo.bak
sudo sed -i 's/listen 443 ssl;/listen 443 ssl http2;/; s/listen \[::\]:443 ssl;/listen [::]:443 ssl http2;/' /etc/nginx/sites-available/trekgo
sudo nginx -t && sudo systemctl reload nginx
curl -sI --http2 https://api.trekgo.website/docs | head -1      # HTTP/2 200
```

Nginx 1.18 dùng cú pháp `listen 443 ssl http2;`. Nginx vẫn proxy về NestJS bằng HTTP/1.1, như vậy là đúng; WebSocket vẫn chạy. Chạy lại `certbot` có thể ghi đè dòng `listen 443`, nên kiểm tra lại sau mỗi lần.

---

## 13. Lệnh vận hành hằng ngày (trên VPS)

```bash
cd ~/trekgo
docker compose ps
docker compose logs -f --tail 50 api            # CHỈ log api (thiếu "api" sẽ lẫn log mongo)
docker compose logs --since 30m api
docker compose restart api
docker compose stop api
docker compose pull api && docker compose up -d # deploy tay
cp .env.bak .env && docker compose up -d        # quay lại env cũ
docker image prune -f
sudo tail -50 /var/log/nginx/error.log
sudo grep -c "Failed password\|Invalid user" /var/log/auth.log   # bot dò SSH
```

> Log `mongo-1 ... Connection accepted ... "MongoDB Shell"` mỗi 10 giây là **healthcheck**, còn `WiredTiger checkpoint` mỗi phút là Mongo ghi dữ liệu xuống đĩa. Cả hai đều bình thường.

---

## 14. Bảng lỗi đã gặp

| Lỗi | Nguyên nhân | Cách sửa |
| --- | --- | --- |
| `Invalid supabaseUrl` | Ngoặc kép trong env khi dùng `--env-file` | Bỏ `"` |
| `ENOTFOUND base` | Ngoặc kép / host sai trong `DATABASE_URL` | Bỏ `"`, dùng tên service |
| `ECONNREFUSED 127.0.0.1:5432` | Dùng `localhost` trong container | `postgres` / `host.docker.internal` |
| `no configuration file provided` | Đứng sai thư mục | `cd api` / `cd ~/trekgo` |
| `ssh ... port 22: Connection refused` | VPS dùng cổng 8686 | `ssh -p 8686`, `scp -P 8686` |
| `sharp ... require v2 microarchitecture` | CPU ảo `kvm64` | Nhờ nhà cung cấp đổi CPU type sang `host` |
| Mongo restart liên tục | Không có AVX | `mongo:4.4` + healthcheck `mongo` |
| Prisma Studio lỗi trên máy | `.env` dùng host `postgres:5432` | `160.30.161.237:54329` |
| Sửa `TREKGO_ENV` nhưng không đổi | Secret chỉ ghi khi deploy chạy | Run workflow hoặc sửa `.env` + `up -d` |
| `curl --http2` ra HTTP/1.1 | Thiếu `http2` ở `listen 443` | Thêm lại, reload Nginx |
| `lines 1-22/22 (END)` | Chế độ xem trang | Nhấn `q` |

---

## 15. Checklist tái sử dụng cho dự án mới

**Chuẩn bị code**

- [ ] `Dockerfile` 2 stage, `openssl` (nếu Prisma), `tini`, `USER node`, `CMD` migrate rồi start
- [ ] Xác định đúng đường dẫn `main.js` sau build
- [ ] `prisma` trong `dependencies`
- [ ] `.dockerignore` loại `.env*`, `node_modules`, `dist`, `.git`
- [ ] `docker-compose.yml` (local, `build: .`) và `docker-compose.vps.yml` (image Docker Hub)
- [ ] `.env.docker.example`: không ngoặc kép, host là tên service, đủ key so với `.env`
- [ ] Chạy thử `docker compose up -d --build` ở local

**CI/CD**

- [ ] Workflow: trigger theo nhánh + `paths`, build `context` đúng thư mục, tag `latest` + `sha`
- [ ] Secrets: Docker Hub (token), VPS (host/port/user/password), env VPS
- [ ] Job deploy `needs: build`, truyền env/compose bằng base64

**VPS**

- [ ] Ubuntu LTS; hỏi trước **CPU type `host` / có AVX**
- [ ] Ghi lại IP, **cổng SSH**, user
- [ ] Cài Docker, `usermod -aG docker`
- [ ] Kiểm tra CPU flags trước khi chạy
- [ ] `mkdir ~/<app>`, copy compose + env, `docker compose up -d`, seed qua SSH tunnel

**Mạng**

- [ ] Nginx reverse proxy + WebSocket headers + `client_max_body_size`
- [ ] API chỉ bind `127.0.0.1`
- [ ] Mua tên miền, bản ghi `A`, `certbot --nginx`, `renew --dry-run`
- [ ] Bật HTTP/2
- [ ] Cập nhật IPN thanh toán, URL web/mobile sang https

**An toàn**

- [ ] Không commit `.env`; không dán mật khẩu vào chat
- [ ] DB mở internet: mật khẩu `openssl rand -hex 16`, đổi bằng `\password`
- [ ] API local trỏ DB chung: tắt worker, không `migrate dev`
- [ ] Không bao giờ `docker compose down -v` trên VPS

---

## 16. Mẹo làm việc với AI (Claude Code) trong quá trình này

- **Dán nguyên log lỗi** kèm câu hỏi ngắn ("đây là lỗi gì vậy"). AI đọc code để tìm nguyên nhân thay vì đoán.
- **Gửi ảnh chụp màn hình** trang quản lý (secrets GitHub, trang mua domain, DNS, form DBeaver) và hỏi "ở đây thì tôi làm như thế nào".
- **Nói rõ ràng buộc:** "repo có cả web và api, chỉ build api", "tôi chỉ deploy BE thôi", "tôi chưa muốn deploy web", "dùng password được không".
- **Hỏi lại khi chưa hiểu**, như "ý là tên miền đúng không", "TTL là sao", "bot là ai". Hiểu đúng giúp tránh sai ở bước sau.
- **Nhờ cập nhật tài liệu sau mỗi chặng**, ví dụ "thêm nó vào hướng dẫn giúp tôi", để cuối cùng có `HUONG_DAN_DOCKER.md` đầy đủ.
- **Không dán mật khẩu thật vào chat.** Dùng placeholder `<mat-khau>`.
