# Hướng dẫn xem Redis trên VPS

Redis chạy trong container `redis` (`redis:7-alpine`) cạnh `api`, `postgres` và `mongo` trong `~/trekgo` trên VPS. Thông tin SSH, thư mục và quy trình deploy xem ở [`api/HUONG_DAN_DOCKER.md`](api/HUONG_DAN_DOCKER.md).

> Mọi lệnh `docker compose ...` dưới đây chạy **trên VPS, trong `~/trekgo`**.
> Đăng nhập: `ssh -p 8686 luatng304@160.30.161.237`, rồi `cd ~/trekgo`.

## 1. Redis đang được dùng cho việc gì

API chỉ gọi Redis qua `RedisService` (`api/src/shared/redis/redis.service.ts`). Hiện chỉ **một chỗ** dùng nó: module **elevation** cache ảnh tile độ cao (DEM) tải từ AWS Terrarium.

| | Giá trị |
| --- | --- |
| Định dạng key | `dem:terrarium:<zoom>:<x>:<y>`, zoom luôn là `13`. Ví dụ: `dem:terrarium:13:6512:3835` |
| Kiểu | `string`, chứa byte PNG gốc của tile, kích thước tối đa 2.5MB |
| TTL | 7 ngày (`604800` giây) |
| Ghi khi | Gọi `POST /api/v1/elevation/lookup` mà tile chưa có trong cache |

Booking, rental, payment, gear và weather **không** dùng Redis. Gear và weather lưu cache trong PostgreSQL.

### Khi `REDIS_ENABLED=false`

API **không kết nối** Redis mà dùng một `Map` trong RAM của process `api`. Map giữ tối đa 1000 key và xoá key cũ nhất trước (FIFO). Dữ liệu mất mỗi lần container `api` khởi động lại hoặc deploy. Lúc đó container `redis` vẫn chạy nhưng trống.

Nếu Redis lỗi kết nối, API cũng tự quay về Map này mà không báo lỗi. Vì vậy **phải xem log ở bước 2** để biết API có thực sự dùng Redis không.

## 2. Bật Redis và kiểm tra API đã kết nối

**Bật:** trong secret `TREKGO_ENV` **và** `~/trekgo/.env`:

```env
REDIS_ENABLED=true
REDIS_URL=redis://redis:6379
```

`REDIS_URL` dùng tên service `redis`, không dùng `localhost`.

**Áp dụng env mới:** dùng `up -d`. Lệnh `restart` **không** đọc lại `.env`.

```bash
docker compose up -d
docker compose exec api printenv REDIS_ENABLED     # phải ra: true
```

**Kiểm tra log:**

```bash
docker compose logs api | grep -i redis
```

| Dòng log | Ý nghĩa |
| --- | --- |
| `Connected to Redis server successfully.` | Đang dùng Redis |
| `Redis is disabled by configuration (REDIS_ENABLED=false)...` | Env vẫn là `false`, đang dùng Map trong RAM |
| `Could not connect to Redis...` / `Redis connection error...` | Bật nhưng không kết nối được, đang dùng Map. Kiểm tra `REDIS_URL` và `docker compose ps redis` |

## 3. Vào redis-cli

Redis **không mở cổng** ra ngoài VPS, nên dùng `redis-cli` bên trong container:

```bash
docker compose exec redis redis-cli          # chế độ tương tác, gõ "exit" để thoát
docker compose exec redis redis-cli DBSIZE   # chạy một lệnh rồi thoát
```

## 4. Các lệnh xem dữ liệu

Gõ trong `redis-cli`:

| Việc | Lệnh |
| --- | --- |
| Kiểm tra sống | `PING` → `PONG` |
| Tổng số key | `DBSIZE` |
| Liệt kê key tile | `SCAN 0 MATCH dem:terrarium:* COUNT 100` (lặp lại với số cursor trả về cho đến khi về `0`) |
| Thời gian còn sống | `TTL dem:terrarium:13:6512:3835` (giây; `-2` = không có key) |
| Kích thước value | `STRLEN dem:terrarium:13:6512:3835` |
| RAM key chiếm | `MEMORY USAGE dem:terrarium:13:6512:3835` |
| RAM toàn Redis | `INFO memory` (xem `used_memory_human`) |
| Tỉ lệ cache trúng | `INFO stats` (xem `keyspace_hits` / `keyspace_misses`) |
| Xem lệnh chạy trực tiếp | `MONITOR` (Ctrl + C để thoát) |

Liệt kê và đếm toàn bộ key tile ngay từ shell VPS:

```bash
docker compose exec redis redis-cli --scan --pattern 'dem:terrarium:*'
docker compose exec redis redis-cli --scan --pattern 'dem:terrarium:*' | wc -l
```

> - Dùng `SCAN` / `--scan`, **không** dùng `KEYS *`: `KEYS` chặn Redis khi có nhiều key.
> - **Không** `GET` key tile: value là PNG nhị phân, terminal sẽ in ra ký tự rác. Dùng `STRLEN` / `MEMORY USAGE`.
> - `MONITOR` làm Redis chậm hơn. Chỉ bật trong lúc kiểm tra rồi tắt ngay.

## 5. Thử để thấy cache hoạt động

1. Mở terminal SSH thứ nhất: `docker compose exec redis redis-cli MONITOR`
2. Ở máy bạn, gọi API (route public, không cần token). Có thể gọi qua Swagger https://api.trekgo.website/docs, mục **elevation**, hoặc:

   ```bash
   curl -X POST https://api.trekgo.website/api/v1/elevation/lookup \
     -H "Content-Type: application/json" \
     -d '{"coordinates":[{"latitude":11.3652,"longitude":106.1785}]}'
   ```

3. Lần đầu, `MONITOR` hiện `"GET" "dem:terrarium:13:..."` rồi `"SET" ... "EX" "604800"`, tức là cache trượt, tải tile từ AWS rồi lưu vào Redis.
4. Kiểm tra: `docker compose exec redis redis-cli --scan --pattern 'dem:terrarium:*'` phải thấy key mới.

Gọi lại cùng toạ độ ngay sau đó thường **không** hiện gì trong `MONITOR`. Đây là bình thường: adapter còn giữ 100 tile đã decode trong RAM của `api` và trả luôn mà không hỏi Redis. Sau khi container `api` khởi động lại, lần gọi đầu sẽ chỉ có `GET` (trúng Redis) mà không có `SET`.

## 6. Dữ liệu Redis tồn tại tới khi nào

Redis chạy với `--appendonly yes` và volume `redis_data`. Tuỳ thao tác mà dữ liệu còn hay mất:

| Thao tác | Dữ liệu Redis |
| --- | --- |
| Deploy hoặc restart `api` | Còn |
| `docker compose restart redis` / VPS khởi động lại | Còn (đọc lại từ file AOF) |
| `docker compose down` | Còn |
| `docker compose down -v` | **Mất**, đồng thời mất luôn dữ liệu Postgres và Mongo |
| Key quá 7 ngày | Redis tự xoá |

Xoá cache tile khi cần, ví dụ khi muốn tải lại từ đầu. Không ảnh hưởng dữ liệu nghiệp vụ:

```bash
docker compose exec redis sh -c "redis-cli --scan --pattern 'dem:terrarium:*' | xargs -r redis-cli DEL"
```

Tránh `FLUSHALL`: lệnh này xoá mọi thứ trong Redis, kể cả những gì sau này có thể được thêm vào.

## 7. (Tuỳ chọn) Xem bằng giao diện RedisInsight

Hiện Redis **không mở cổng** nào. Muốn xem bằng [RedisInsight](https://redis.io/insight/) trên máy:

1. Trong `api/docker-compose.vps.yml`, thêm vào service `redis` (chỉ mở cho chính VPS), rồi deploy:

   ```yaml
   ports:
     - "127.0.0.1:6379:6379"
   ```

2. Mở SSH tunnel trên máy (Git Bash, giữ cửa sổ mở):

   ```bash
   ssh -p 8686 -N -L 6380:127.0.0.1:6379 luatng304@160.30.161.237
   ```

3. RedisInsight → Add database → Host `localhost`, Port `6380`, không có mật khẩu.

> ⚠️ **Không** mở `"6379:6379"` ra mọi IP. Redis hiện **không có mật khẩu**, ai vào được cổng là đọc, ghi, xoá được toàn bộ.

## 8. (Khuyến nghị) Giới hạn RAM cho Redis

Hiện Redis chưa giới hạn bộ nhớ: RAM tăng theo số tile đã cache cho tới khi key hết TTL. Muốn đặt trần, sửa `command` của service `redis` trong `api/docker-compose.vps.yml`:

```yaml
command: ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]
```

Khi chạm trần, Redis tự xoá key ít dùng nhất. Kiểm tra sau khi deploy: `docker compose exec redis redis-cli CONFIG GET maxmemory`.

## 9. Lỗi thường gặp

| Lỗi | Nguyên nhân / cách xử lý |
| --- | --- |
| `DBSIZE` luôn ra `0` | API chưa dùng Redis (xem log ở bước 2), hoặc chưa ai gọi API elevation. |
| Đã sửa `.env` nhưng log vẫn `REDIS_ENABLED=false` | Dùng `restart` thay vì `up -d`, hoặc lần deploy sau đã ghi đè `.env` từ `TREKGO_ENV` còn giá trị cũ. Sửa cả secret. |
| `Could not connect to Redis: ... ENOTFOUND redis` | Container `redis` không chạy (`docker compose ps redis`) hoặc `REDIS_URL` gõ sai tên service. |
| `ECONNREFUSED 127.0.0.1:6379` | `REDIS_URL` đang dùng `localhost`. Đổi thành `redis://redis:6379`. |
| `no configuration file provided` | Đứng sai thư mục. `cd ~/trekgo`. |
| Terminal in ra ký tự lạ | Đã `GET` một key tile (PNG nhị phân). Dùng `STRLEN` thay thế. |
