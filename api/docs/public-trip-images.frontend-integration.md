# Gallery ảnh cho Public Trip — hướng dẫn tích hợp frontend

## Phạm vi và hiện trạng

Backend bổ sung gallery riêng cho public trip; không thay đổi private trip và không triển khai UI trong lần thay đổi này. Trước đây API public trip chưa lưu danh sách ảnh; vùng hero của web chỉ nhận một ảnh minh họa qua `trip.image`.

Quy tắc:

- Tối đa **10 ảnh** mỗi public trip, không bắt buộc có ảnh khi tạo/publish.
- Ảnh đầu tiên là ảnh bìa; thứ tự trong `mediaIds` cũng là thứ tự carousel.
- Chỉ leader ACTIVE sở hữu chuyến được lưu ảnh, tại `DRAFT`, `OPEN`, `FULL`, `CLOSED`.
- Không sửa gallery khi chuyến đã xuất phát, hoàn thành, đang yêu cầu hủy, đã hủy hoặc bị gián đoạn.
- Ảnh giới thiệu là **nội dung công khai** trên CDN, kể cả khi upload để chuẩn bị draft. Không tải tài liệu riêng tư vào scope này. API chi tiết public trip vẫn không cho xem draft.
- Không gửi file/base64/URL ảnh vào API trip. Backend chỉ liên kết `mediaId` đã xác nhận READY.

Các URL dưới đây dùng prefix `/api/v1`. Success JSON là giá trị trả trực tiếp từ controller; với Axios, đọc `response.data`. Không tự thêm lớp `data` nếu HTTP client dự án không có wrapper riêng.

## 1. Upload ảnh bằng API media hiện có

Mỗi file đi qua ba bước; không cần API upload mới riêng cho trip.

### Tạo upload intent

`POST /api/v1/media/upload-intents`, Bearer token của LEADER ACTIVE:

```json
{
  "scope": "PUBLIC_TRIP",
  "resourceType": "IMAGE",
  "fileName": "ta-nang.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 845321,
  "captureSource": "GALLERY"
}
```

Response `201` có `mediaId`, `expiresAt`, `status`, `provider` và `upload`:

```json
{
  "mediaId": "11111111-1111-4111-8111-111111111111",
  "status": "PENDING_UPLOAD",
  "expiresAt": "2026-11-08T15:15:00.000Z",
  "provider": "CLOUDINARY",
  "upload": {
    "uploadUrl": "https://api.cloudinary.com/v1_1/<cloud-name>/image/upload",
    "method": "POST",
    "resourceType": "IMAGE",
    "formFields": {
      "api_key": "<returned-api-key>",
      "timestamp": 1794140400,
      "signature": "<returned-signature>",
      "public_id": "trekgo/public-trip/11111111-1111-4111-8111-111111111111",
      "type": "upload"
    }
  }
}
```

Dùng nguyên `uploadUrl`, `method` và **tất cả** `formFields` thực tế được trả về; không hardcode chữ ký hay danh sách field trong ví dụ.

### Upload trực tiếp Cloudinary

```ts
const form = new FormData();
Object.entries(intent.upload.formFields).forEach(([key, value]) => {
  form.append(key, String(value));
});
form.append("file", file);
const result = await fetch(intent.upload.uploadUrl, {
  method: intent.upload.method,
  body: form,
});
if (!result.ok) throw new Error("Không tải được ảnh lên Cloudinary");
const uploaded = await result.json();
```

Không đính kèm Bearer token TrekGo vào request Cloudinary. Để trình duyệt tự đặt Content-Type multipart cùng boundary.

### Xác nhận upload

`POST /api/v1/media/{mediaId}/complete`, dùng Bearer token TrekGo:

```json
{
  "publicId": "<uploaded.public_id>",
  "version": 1794140400,
  "signature": "<uploaded.signature>"
}
```

`version` ở đây là version Cloudinary trả về, **khác** `expectedVersion` của trip. Chỉ đưa `mediaId` vào gallery khi complete trả `status: READY`. API complete có tính idempotent cho media đã READY.

Ảnh hỗ trợ JPEG, PNG, WebP, HEIC, HEIF; không nhận PDF/video. Giới hạn dùng cấu hình media chung: mặc định 20 MiB mỗi ảnh, kích thước mỗi chiều từ 320 đến 12000 px. Upload ảnh public trip được ký với `overwrite: false`, không cho ghi đè nội dung media đã upload; muốn thay file thì tạo mediaId mới. Backend kiểm tra metadata thực tế từ Cloudinary; kiểm tra ở frontend chỉ giúp báo lỗi sớm. HEIC/HEIF có thể không preview được bằng browser; URL catalog trả ảnh đã chuyển định dạng tự động.

Upload nhiều file với concurrency khoảng 3 file; giữ riêng trạng thái chờ/đang tải/READY/lỗi. Khi một file lỗi, cho thử lại file đó, không tải lại tất cả ảnh đã READY. Intent hết hạn thì tạo intent mới; chỉ chuyển bước khi các ảnh được chọn đều READY và gallery đã lưu thành công.

## 2. Lưu, xóa và đổi thứ tự gallery

`PUT /api/v1/leader/public-trips/{tripId}/images`, Bearer token:

```json
{
  "expectedVersion": 3,
  "mediaIds": [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222"
  ]
}
```

Response `200`:

```json
{
  "tripId": "33333333-3333-4333-8333-333333333333",
  "version": 4,
  "images": [
    {
      "mediaId": "11111111-1111-4111-8111-111111111111",
      "position": 1,
      "url": "https://res.cloudinary.com/<cloud-name>/image/upload/<transforms>/trekgo/public-trip/<id>",
      "width": 1920,
      "height": 1080
    },
    {
      "mediaId": "22222222-2222-4222-8222-222222222222",
      "position": 2,
      "url": "https://res.cloudinary.com/<cloud-name>/image/upload/<transforms>/trekgo/public-trip/<id-2>",
      "width": 1600,
      "height": 1200
    }
  ],
  "coverImage": {
    "mediaId": "11111111-1111-4111-8111-111111111111",
    "position": 1,
    "url": "https://res.cloudinary.com/<cloud-name>/image/upload/<transforms>/trekgo/public-trip/<id>",
    "width": 1920,
    "height": 1080
  },
  "imageCount": 2
}
```

Ví dụ minh họa URL, không tự ghép URL từ mẫu. `width`/`height` là kích thước gốc, URL detail giới hạn chiều rộng 1600 và tự tối ưu chất lượng/định dạng.

Đây là **thay toàn bộ danh sách**, không phải append:

- Thêm ảnh: gửi danh sách cũ cộng ảnh READY mới.
- Xóa ảnh: gửi danh sách còn lại. Xóa hết: `mediaIds: []`.
- Đổi thứ tự/ảnh bìa: gửi thứ tự mới, ảnh bìa đứng đầu.
- Mỗi lần lưu thành công tăng version trip một lần. Cập nhật version trong cache/state để dùng cho lưu thông tin, route, publish và thao tác tiếp theo.
- Tránh chạy song song các thao tác ghi trên cùng trip. Lưu lại sau timeout có thể trả version conflict nếu lần trước đã commit; tải lại chi tiết để đối chiếu, không tự ghi đè.
- Xóa khỏi gallery chỉ gỡ liên kết. Backend đặt hạn dọn ảnh khi không còn tham chiếu; frontend không cần gọi DELETE media để thực hiện thao tác xóa gallery.
- Upload bỏ dở được cơ chế cleanup media hiện có xử lý. Không xóa media vẫn được dùng bởi chuyến khác.

## 3. Dữ liệu hiển thị

- `GET /api/v1/leader/public-trips/{id}` và `GET /api/v1/public-trips/{id}` bổ sung `images`, `coverImage`, `imageCount`.
- `GET /api/v1/leader/public-trips` và `GET /api/v1/public-trips` chỉ bổ sung `coverImage`, `imageCount`; không có `images` để giảm payload.
- Gallery chi tiết trả theo `position` tăng dần, URL dùng `CATALOG_DETAIL`; ảnh bìa danh sách dùng `CATALOG_CARD` (rộng tối đa 720 px).
- Trip cũ/không có ảnh: chi tiết trả `images: []`, `coverImage: null`, `imageCount: 0`; danh sách không có field `images`.
- Public read không cần đăng nhập, giữ nguyên quy tắc hiển thị trip đã publish. Không thay đổi API create/patch để nhận `mediaIds`.
- Nếu cần lấy lại URL riêng cho một media, có thể tái sử dụng `GET /api/v1/media/{mediaId}/delivery?variant=CATALOG_DETAIL`. Không cần gọi một lần cho mỗi ảnh vì response trip đã chứa URL.

## 4. Các trang frontend cần tích hợp sau này

### Leader tạo và xem lại

- `/leader/create-trip` → `LeaderCreateTripStepOne`: thêm mục **Ảnh chuyến đi** sau “Thông tin cơ bản & Hồ sơ đoàn”. Dùng input multiple, preview, nút xóa, đổi thứ tự và nhãn ảnh bìa. Không lưu File/object URL vào sessionStorage; giải phóng object URL khi không dùng nữa.
- Khi tiếp tục: hoàn tất upload/complete → tạo hoặc cập nhật draft bằng API hiện tại → lấy `id/version` từ response → PUT gallery → ghi nhận version mới → chuyển `/leader/create-trip/route?tripId=...`.
- Nếu đã tạo draft nhưng lưu gallery lỗi: giữ lại `tripId`, không tạo chuyến mới khi thử lại. Giữ danh sách media READY trong state và cho thử lại gallery. Khi reload, lấy gallery đã lưu từ chi tiết leader; không coi ảnh mới chỉ preview là đã được lưu.
- `/leader/create-trip/review` → `LeaderCreateTripReview`: hiển thị ảnh đã lưu và ảnh bìa, dùng version hiện tại để publish. Không thêm điều kiện bắt buộc có ảnh.
- `/leader/trips/[tripId]/edit` → `LeaderTripEdit`: thêm phần quản lý ảnh độc lập để sửa gallery ở OPEN/FULL/CLOSED dù các trường nội dung khác vẫn bị khóa. Không mở khóa toàn bộ form chỉ vì gallery được sửa.

### Khách xem chi tiết

- `/trips/[id]` → `TripDetailClient` / `TripHeader`: thay vùng hero dùng `trip.image` bằng gallery từ API. Bổ sung mapping/type ở luồng public trip; không chỉ sửa component mà bỏ qua lớp chuyển dữ liệu.
- Mỗi thời điểm hiện **một ảnh lớn**; hai nút `<` và `>` chuyển ảnh trước/sau. Quay vòng ở hai đầu, không autoplay.
- Phía dưới có một chấm cho mỗi ảnh: chấm không chọn mờ, chấm đang chọn nổi bật. Cho bấm chấm để chuyển ảnh.
- Một ảnh: ẩn nút và chấm điều hướng. Không ảnh: hiển thị ảnh mặc định hiện có.
- Hỗ trợ bàn phím trái/phải khi vùng carousel có focus; nút có `aria-label`, chấm đang chọn có `aria-current`. Alt mô tả tên chuyến và thứ tự ảnh.
- Chỉ ưu tiên tải ảnh đầu, preload ảnh kế tiếp, giữ kích thước khung ổn định để tránh nhảy layout. Ảnh lỗi có placeholder và vẫn cho chuyển sang ảnh khác; reset/clamp chỉ số đang chọn khi gallery đổi.
- Dùng `coverImage.url` cho card danh sách. Nếu dùng Next Image, kiểm tra cấu hình remotePatterns cho `res.cloudinary.com` và cloud tương ứng trước khi tích hợp.
- Tái sử dụng bộ UI tại `@/components/ui`, theo README/index của thư viện, cho Button, SurfaceCard, LoadingState, ErrorAlert và các phần liên quan.

## 5. Xử lý lỗi và phiên bản

API gallery mới và media dùng `GlobalErrorFilter`:

```json
{
  "error": {
    "code": "PUBLIC_TRIP_IMAGES_VERSION_CONFLICT",
    "message": "Chuyến đi đã thay đổi. Hãy tải lại trước khi lưu ảnh.",
    "retryable": false
  },
  "meta": {
    "requestId": "<request-id>",
    "serverTime": "2026-11-08T15:00:00.000Z",
    "contractVersion": "0.2.0-final-flow"
  }
}
```

`details` có thể có khi validation lỗi; nếu không có dữ liệu, JSON có thể bỏ field này. Với Axios đọc `err.response?.data?.error`, không dùng top-level `message/code`.

| HTTP | Code | Cách xử lý |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Kiểm tra UUID, expectedVersion > 0, tối đa 10 ảnh, ID không trùng, không gửi field thừa. |
| 401 | `UNAUTHENTICATED` | Yêu cầu đăng nhập lại theo flow auth hiện có. |
| 403 | `FORBIDDEN` | Chỉ leader ACTIVE sở hữu trip được sửa. |
| 404 | `PUBLIC_TRIP_IMAGES_NOT_FOUND` | Không có public trip tương ứng; private trip cũng không được dùng API này. |
| 409 | `PUBLIC_TRIP_IMAGES_LOCKED` | Tải lại trip, khóa quản lý ảnh theo trạng thái. |
| 409 | `PUBLIC_TRIP_IMAGES_VERSION_CONFLICT` | Tải lại chi tiết/version, yêu cầu người dùng đối chiếu trước khi lưu lại. |
| 422 | `PUBLIC_TRIP_IMAGES_INVALID_MEDIA` | Kiểm tra complete READY, scope PUBLIC_TRIP, chủ sở hữu và metadata; không tự retry vô hạn. |

Các lỗi `MEDIA_*` trong bước upload/complete giữ theo API media hiện tại. Cloudinary trực tiếp có envelope riêng; xử lý theo HTTP status và response nhà cung cấp.

**CF01 cũ vẫn dùng envelope cũ.** Lần thay đổi này không migrate `TripErrorFilter` hoặc các client create/patch/publish hiện tại. Hãy xử lý gallery bằng contract mới riêng, không sửa parser lỗi chung khiến các màn hình CF01 cũ mất thông báo.

## 6. Kiểm tra tích hợp và triển khai

- Chạy migration mới `20261108100000_public_trip_images`, generate Prisma Client và deploy backend trước khi frontend dùng scope/field mới. Nếu có migration khác đang chờ, không tự áp dụng ngoài phạm vi gallery.
- Dùng Cloudinary thật ở môi trường kiểm thử để xác nhận upload intent → upload → complete → PUT gallery → khách xem chi tiết. Kiểm tra cấu hình `MEDIA_ENABLED` và khóa Cloudinary; không đưa API secret lên frontend.
- Kiểm tra 0/1/10 ảnh, ảnh lỗi upload, ảnh quá dung lượng, reorder/đổi bìa, gỡ ảnh, reload, hai tab sửa cùng chuyến và version conflict.
- Kiểm tra khách không đăng nhập xem được ảnh của trip đã publish; draft không xuất hiện trong public API.
- Kiểm tra quyền leader, trạng thái khóa và việc giữ nguyên nội dung/private trip khác.
- Test backend dùng storage giả để tránh upload/xóa tài nguyên Cloudinary thật; test database xác nhận transaction và bảo vệ xóa media. Kiểm thử provider thực tế là bước riêng khi có môi trường media hoạt động.

Lệnh test gallery: `npm run test:public-trip-images`. Suite PostgreSQL chỉ chạy khi đặt `PUBLIC_TRIP_IMAGES_TEST_DATABASE_URL` tới database đã có migration; test chỉ tạo và dọn fixture UUID riêng, không reset database.
