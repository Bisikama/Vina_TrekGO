# Trip GPS v2 — API đã triển khai và hướng dẫn mobile

Ngày 26/10/2026. Đây là hướng dẫn phần API; mobile chính chưa được sửa trong công việc này.
Thiết kế tổng thể: [TRIP_GPS_OFFLINE_SYNC_V2.md](./TRIP_GPS_OFFLINE_SYNC_V2.md).
Schema request có thể chạy được nằm trong `src/modules/geo/presentation/dtos/trip-gps-sync.dto.ts`.
OpenAPI: `contracts/openapi/trip-gps.json` (v1 + v2).

## Khởi tạo và tương thích

- Tạo phiên bằng POST `/api/v1/geo/trips/:tripId/gps/sessions` với clientSessionId, deviceId, protocolVersion=2.
- protocolVersion bỏ trống nghĩa là v1. Không đổi protocol của phiên đã tạo.
- Giữ nguyên clientSessionId khi mất response start; không tạo UUID mới để thử lại.
- Session v2 không dùng `/samples`, `/pause`, `/resume`, `/finish` cũ: API trả GPS_PROTOCOL_CONFLICT.
- GET context/state thêm `X-GPS-Protocol: trip-gps-sync/2` để nhận capabilities và trường mở rộng.
- Mọi API sync cần bearer token và `X-GPS-Device-Id` của phiên. Quyền được xác minh trên server.
- Trip COMPLETED không đóng phiên v2 đang chạy. canStartNewSession và canContinueExistingSession là hai quyền riêng.
- Hạn sync vẫn theo policy đóng băng trong session, hiện dự án cấu hình 24 giờ từ thời điểm người dùng tự finish.
- Đợt này chưa hỗ trợ tạo phiên mới hoàn toàn offline. Phiên đã có vẫn đồng bộ timeline offline được.

## Chuỗi đồng bộ

**Điều kiện kích hoạt trên mobile: chỉ tự đồng bộ lịch sử khi phiên đã STOPPED.**

| Tình huống | Hành vi |
| --- | --- |
| Đang ghi, có mạng hoặc mạng vừa trở lại | Chỉ gửi vị trí mới nhất qua socket; lịch sử giữ SQLite |
| Đang pause/resume, có mạng hoặc mạng trở lại | Chỉ lưu trạng thái/lệnh local, không gửi metadata hay lịch sử |
| Người dùng finish khi có mạng | Commit STOPPED vào SQLite, sau đó đồng bộ ngay |
| Người dùng finish khi offline | Commit STOPPED vào SQLite, hiển thị chờ đồng bộ |
| Có mạng lại/mở app, có phiên STOPPED chưa đồng bộ | Tự đồng bộ phần còn thiếu |
| Bấm Đồng bộ ngay cho phiên đã kết thúc | Thử tiếp từ checkpoint đã ACK |

API không tự đọc SQLite hoặc quyết định lúc mobile upload. Không dùng sự kiện socket reconnect
để gọi chuỗi upload lịch sử của phiên đang ghi. Metadata điều khiển và vị trí realtime vẫn là hai nhiệm vụ riêng.

Base sync: `/api/v1/geo/trips/:tripId/gps/sessions/:sessionId/sync`.

1. Sau finish, POST `/metadata`: gửi toàn bộ lệnh pause/resume/finish chưa ACK theo sequence liên tục, commandId bất biến và thời điểm gốc.
2. POST `/batches`: gửi các điểm chờ theo snapshotRevision; batchId và payload không đổi khi retry.
3. POST `/manifests/pages`: đăng ký danh sách batchId/payloadHash/sampleCount theo từng trang.
4. POST `/complete`: đối soát đủ snapshot và yêu cầu worker xử lý; HTTP 202 kể cả replay ACK cũ.
5. GET `/status`: kiểm tra processedSnapshotRevision và syncStatus trước khi dọn local.

Không có endpoint manual riêng. Nút Đồng bộ ngay chạy lại chuỗi từ checkpoint đã ACK.
Nếu worker NEEDS_ATTENTION, gửi complete với completionId mới nhưng cùng snapshot/manifest để yêu cầu xử lý lại;
không upload các batch đã ACK. Mỗi đợt worker có tối đa 4 lần thực thi gồm lần đầu, delay 5/15/30 giây.
API không tự retry P2028 trong request; mobile áp ngân sách sync 1 lần đầu + 3 retry đã thống nhất.

### Metadata revision

**Luồng mobile đã chốt: pause/resume chỉ lưu SQLite, kể cả khi đang có mạng.**
Không gọi metadata sau mỗi lần bấm hoặc khi reconnect giữa phiên. Pause dừng collector và publish điểm mới;
resume tiếp tục collector/publisher. Socket còn kết nối thì người dùng vẫn ONLINE, marker giữ điểm cuối;
đoàn không nhận trạng thái PAUSED/RESUMED tức thời vì timeline chưa được gửi lên server.

Khi finish: commit STOPPED local trước, rồi có mạng mới gửi tất cả lệnh chưa ACK (bao gồm FINISH)
qua metadata, chờ server STOPPED, sau đó mới batches → manifests/pages → complete → status.
Quá 100 lệnh thì chia nhiều request metadata theo thứ tự, mỗi request có requestId riêng được lưu cố định;
request cuối mới chứa FINISH. Không upload tọa độ khi mới ACK một phần timeline.

Server thường vẫn ACTIVE trong suốt phiên local pause/resume. Đây là trạng thái server chưa nhận timeline,
không phải bằng chứng collector trên máy còn chạy. Khi mở lại app, không ghi đè PAUSED/STOPPED local
bằng ACTIVE từ server, không tự bật collector dựa riêng vào GET session.

metadataRevision ban đầu bằng 0. Luồng mới không cần request khởi tạo metadata rỗng lúc bắt đầu;
lệnh đầu tiên có sequence=1, gửi cùng các lệnh tiếp theo sau finish.
Request có nhiều lệnh liên tiếp dùng revision bằng sequence cuối, baseMetadataRevision bằng revision server đã ACK trước đó.
API vẫn tương thích phiên đã khởi tạo metadata rỗng revision=1: lệnh tiếp theo của phiên đó phải bắt đầu sequence=2.
Không tạo khoảng trống trong sequence, không dùng version session thay cho metadataRevision.
FINISH có occurredAt khớp endedAt. Lưu local trước network; lỗi request không tự đổi phiên local về ACTIVE.
Metadata mới bị chặn khi snapshot đang FINALIZE_PENDING/PROCESSING; đọc status và chờ hoàn tất trước khi đồng bộ timeline mới.

### Snapshot và hash

- snapshotRevision bắt đầu 1; snapshot sau tăng đúng 1 so với snapshot server đã nhận.
- Mỗi snapshot chứa các điểm mới cần đối soát; không cần gửi lại điểm của snapshot trước.
- final=true chỉ khi session đã STOPPED qua metadata; endedAt phải khớp session.
- API đã chặn upload lịch sử giữa phiên: batches, manifests/pages và complete chỉ nhận khi session STOPPED.
  ACTIVE/PAUSED trả HTTP 409, code GPS_INVALID_SESSION_STATE, details.reason=FINISH_REQUIRED_BEFORE_HISTORY_SYNC.
- complete bắt buộc final=true và endedAt; final=false hoặc thiếu endedAt bị ZodValidationPipe từ chối HTTP 400.
- Trước upload phải gửi timeline gồm FINISH qua metadata để server xác nhận STOPPED.
  Trong lúc ghi chỉ socket vị trí dùng mạng; pause/resume local không gọi API.

- expectedSampleCount đếm các ID duy nhất trong snapshot, bao gồm cả điểm bị reject có ACK.
- snapshotMaxSequence là ranh giới local để mobile giữ membership snapshot bất biến, không phải bằng chứng đủ dữ liệu trên server.
- Hash SHA-256 lowercase hex của canonical JSON UTF-8: keys object sắp xếp tăng dần, giữ thứ tự array,
  bỏ key undefined, số theo JSON.stringify của JavaScript. API/mobile React Native đều dùng thuật toán JS này.
- payloadHash = hash(samples); pageHash = hash(entries); manifestHash = hash(entries nối theo pageIndex).
- Mẫu có optional field bỏ trống khác mẫu có field null trong hash. Giữ nguyên payload đã lưu local khi retry.
- Snapshot rỗng: không gửi manifest page, expectedSampleCount=0, manifestHash=hash([]).
- Cùng khóa nhưng đổi payload trả GPS_IDEMPOTENCY_CONFLICT. Sửa payload cần ID mới, không thay ID của batch đã gửi.

### Chuyển đổi phiên đã gửi pause/resume lên server

- Không đổi cơ chế điều khiển giữa chừng cho phiên cũ đã gửi metadata. Giữ cơ chế gửi lệnh tức thời
  cho phiên đó đến finish; áp dụng local-until-finish cho phiên mới.
- Mobile lưu controlSyncMode theo phiên (IMMEDIATE_LEGACY hoặc LOCAL_UNTIL_FINISH) trong SQLite.
- Nếu server đã PAUSED thì socket publish bị chặn đến khi RESUME metadata được ACK.
  Không resume local đơn lẻ cho phiên IMMEDIATE_LEGACY và không ép sửa status trực tiếp trong DB.
- Với phiên LOCAL_UNTIL_FINISH, server chưa nhận PAUSE nên vẫn ACTIVE; resume local tiếp tục publish bình thường.
- API hiện đã hỗ trợ nhận timeline theo batch. Thay đổi này không cần sửa API hoặc migration server;
  phần mobile phải áp dụng mode nhất quán. Metadata vẫn cho phép trạng thái trung gian để nhận timeline dài chia trang.

## Socket và state

Namespace `/gps`. Người xem bản đồ subscribe `{requestId, tripId, protocolVersion:2}`.
Publisher chỉ cần socket đã xác thực và session v2 hợp lệ; không cần giữ subscription xem bản đồ để publish.
Rời bản đồ unsubscribe nhưng không ngắt socket nếu phiên cá nhân vẫn đang chia sẻ vị trí.
`gps:location.publish` nhận payload mục 7 của thiết kế; ACK chỉ sau lưu latest-location và outbox.
Server không thêm điểm publish vào gps_locations và không tạo job dựng đường.

Event `gps:location.updated`: userId, sessionId, sequence, **locationVersion**, location.
Event `gps:presence.updated`: userId, connectionStatus, **presenceVersion**.
Hai version này độc lập với memberVersion của roster; không dùng sequence client so với memberVersion.
locationVersion tăng xuyên các session của một người trong trip; client chỉ áp sự kiện mới hơn version đang hiển thị.
Sequence client tăng trong một session và phải được lưu SQLite để restart không quay về 1.
Publish sequence cũ trả applied=false; không làm marker lùi. Server có safety rate limit một publish/giây/session;
mobile thực hiện nhịp thích ứng 5 giây/5 m/15 giây như thiết kế, server không thay collector trên điện thoại.

REST state v2 trả thêm connectionStatus, presenceVersion, locationVersion và locationFreshness.
ONLINE dựa socket subscribe đang còn lease, không dựa tuổi tọa độ. Điểm cuối được giữ khi OFFLINE.
Ping/pong cấu hình 10/10 giây; instance crash được phát hiện bằng lease presence 20 giây và sweep 5 giây,
nên trường hợp crash/mất DB có thể chậm hơn ngắt socket thông thường. Không hứa luôn OFFLINE tức thì.

Mỗi API local đọc cùng DB outbox, ghi gps_event_deliveries riêng; không tranh claim với API khác.
Polling 500 ms khi có dữ liệu, lùi đến 5 giây khi rỗng; không polling vị trí khi không có subscription.
Do backoff và độ trễ DB, điểm đầu sau khi nhàn rỗi có thể chậm khoảng 5 giây cộng network; chưa có bảo đảm p95 1–2 giây.
Worker fanout dùng roster một lần/trip/lượt, receipt ghi theo batch; không gọi authorize theo event × socket.
Subscription mới hoặc reconnect phải lấy state: fanout chỉ replay cửa sổ gần 5 phút, không phải lưu vô hạn để phát bù.

## Giới hạn bảo vệ và phần cần đo thêm

- HTTP batch tối đa 200 điểm và không vượt maxBatchSamples của policy. Express mặc định có thể giới hạn body thấp hơn 256 KiB.
- Metadata tối đa 100 lệnh/request; manifest tối đa 100 entries/page, 100 pages và 1000 entries/snapshot.
- Snapshot tối đa 10000 điểm; phiên tối đa 10000 điểm đã chấp nhận. Worker từ chối lịch sử tổng hợp trip/user vượt 10000 điểm.
  Dữ liệu local không được xóa khi vượt giới hạn; cần chunked processor trước khi hỗ trợ hành trình lớn hơn mức này.
- Receipt tối đa 5000/phiên; API trả rate-limit khi đạt trần. Giới hạn này chống tăng dữ liệu vô hạn bằng ID mới.
- Mỗi process tối đa 8 transaction sync đồng thời; quá tải trả 429. Transaction sync maxWait 2 s, timeout 10 s,
  lock_timeout 2 s, statement_timeout 5 s. Không tạo Prisma pool riêng.
- Worker một job/instance, lease 30 s, tối đa 4 lần kể cả phục hồi sau crash; hết lượt NEEDS_ATTENTION.
- Bộ xử lý dùng lại GpsTrackService và checkpoint adapter trong transaction bounded 10 giây; chưa chuyển tính hình học sang worker thread.
  Đây là giới hạn triển khai hiện tại so với mục tiêu tối ưu trong thiết kế, cần đo dữ liệu lớn trước khi mở rộng.
- Không có cam kết server không bao giờ chết; lỗi DB dự kiến được bắt và phản hồi chuẩn, retry/queue có giới hạn.
- Chưa đo bandwidth/p95 dưới tải thật, chưa kiểm thử collector/background/animation vì mobile chưa thay đổi.
- Checkpoint/deviation chính thức tính khi đồng bộ lịch sử; publish vị trí không cập nhật chúng liên tục.

## Migration

Hai migration additive:

- `20261026120000_trip_gps_sync_v2`: sync states, receipts (gồm cả manifest page), consumer/delivery và socket presence.
- `20261026121000_trip_gps_presence_versions`: version presence/location theo user/trip.

Không rewrite migration cũ, không reset DB. Trước chạy server mới cần prisma generate và prisma migrate deploy.
Các phiên v1 không backfill thành v2. Khi rollback ứng dụng vẫn phải duy trì API nhận sync của phiên v2 đã tạo.

`TRIP_GPS_V2_ENABLED=false` chặn tạo phiên v2 mới; các phiên v2 đã tạo vẫn được nhận đồng bộ.
Không cần thay DATABASE_URL hoặc reset database. Hai migration trên đã được áp dụng vào DB cấu hình trong đợt triển khai này.

## Kiểm chứng đã thực hiện

Cập nhật quy tắc đồng bộ sau finish: đã sửa code GpsSyncService, DTO complete, test và OpenAPI;
không chỉ thay tài liệu. Không cần migration mới cho thay đổi điều kiện nhận lịch sử này.

- `npm run build`: thành công.
- `npm run test:trip-gps -- --silent`: 21 ca qua, 7 ca PostgreSQL được skip mặc định (sau cập nhật chỉ đồng bộ khi STOPPED).
- Chạy opt-in PostgreSQL cho recording + sync: 23 ca qua trong lượt tích hợp, fixture rollback toàn bộ.
- Chạy lại suite sync với PostgreSQL sau cập nhật STOPPED: 10/10 ca qua, gồm worker nhận lại lease hết hạn,
  commit kết quả, chặn lịch sử khi ACTIVE/PAUSED và từ chối final=false qua HTTP.
- Test socket hai API dùng cùng nguồn outbox: hai bên đều nhận sự kiện; quyền được đọc theo trip/lượt và receipt độc lập.
- `npm run openapi:trip-gps`: tạo được contract 16 endpoint REST.

Suite PostgreSQL cần `RUN_TRIP_GPS_DB_TEST=1` và cấu hình DB; không tự bật bằng lệnh test thường.
Fixture v1 chủ động chạy bộ xử lý route sau upload vì test không khởi động scheduler; không giả định upload tự tính xong lịch sử.
Chưa chạy kiểm thử tải, đo bandwidth hoặc kiểm thử mobile thật. Tính hình học hiện vẫn dùng processor hiện có trong transaction có giới hạn;
không diễn giải các kết quả trên thành bảo đảm tuyệt đối server không bao giờ dừng.
