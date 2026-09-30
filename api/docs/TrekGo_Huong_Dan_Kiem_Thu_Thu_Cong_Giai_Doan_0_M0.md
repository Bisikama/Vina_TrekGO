# TREKGO — HƯỚNG DẪN KIỂM THỬ THỦ CÔNG GIAI ĐOẠN 0 VÀ M0

**Trạng thái tài liệu:** Hướng dẫn thực hiện; chưa phải biên bản xác nhận đã đạt.  
**Phạm vi:** B0 — danh mục và kho thiết bị; M0 — tiếp nhận, xác minh, phân phối, nguồn gốc và xóa tệp hình ảnh/video.  
**Điều kiện kết thúc:** Có bằng chứng thực tế của từng trường hợp bắt buộc, dữ liệu được đối chiếu với cơ sở dữ liệu và Cloudinary, không chỉ dựa vào kết quả biên dịch hoặc kiểm thử tự động.

> **Lưu ý về ngôn ngữ:** Nội dung giải thích viết bằng tiếng Việt. Tên đường dẫn API, tên trường JSON, tên trạng thái và lệnh trong khối mã được giữ nguyên để thao tác đúng với mã nguồn.

## I. Kiểm tra trước khi bắt đầu

### 1. Kiểm tra công cụ sinh tài liệu giao diện lập trình

Cấu trúc `src/`, `scripts/`, `contracts/openapi/`, `docs/`, `prisma/`, `test/` đã được đề xuất phù hợp. Tuy nhiên, **mã `generate-openapi.ts` hiện được cung cấp chọn tệp đích theo `NODE_ENV`**. Nếu `.env` đang đặt `NODE_ENV=development`, lệnh `npm run openapi:generate` hiện được mô tả có thể tạo nhầm `openapi.dev.json`, thay vì hợp đồng chính `openapi.json`.

**Sửa hai lệnh để xác định môi trường rõ ràng trước khi sinh tài liệu:**

```json
{
  "scripts": {
    "openapi:generate": "cross-env NODE_ENV=production MEDIA_DEV_UPLOAD_ENABLED=false ts-node scripts/generate-openapi.ts",
    "openapi:generate:dev": "cross-env NODE_ENV=development MEDIA_DEV_UPLOAD_ENABLED=true ts-node scripts/generate-openapi.ts"
  }
}
```

Chỉ áp dụng sau khi kiểm tra dự án đã cài `cross-env` và quy trình khởi tạo ứng dụng ở chế độ sản xuất không đòi những cấu hình ngoài phạm vi kiểm thử. Nếu chưa thể chạy chế độ sản xuất cục bộ, báo rõ vướng mắc; không dùng nhầm hợp đồng phát triển làm hợp đồng sản xuất.

Chạy hai lệnh, sau đó xác minh thực tế:

```powershell
npm run openapi:generate
npm run openapi:generate:dev
```

- `contracts/openapi/openapi.json`: **không có** `/api/v1/dev/media/upload-test`.
- `contracts/openapi/openapi.dev.json`: **có** `/api/v1/dev/media/upload-test`, phương thức `POST`, dạng `multipart/form-data`, trường `file` có `format: binary`, có khai báo Bearer, **không có `ownerUserId`**.
- Hai tệp phải phản ánh đúng mã nguồn đang chạy, không dùng tệp cũ chỉ vì tên giống nhau.
- So sánh thiết lập tiền tố `/api/v1`, cơ chế xác thực và bộ thông tin Swagger giữa `main.ts` và `scripts/generate-openapi.ts`; nếu khác nhau, dùng chung một hàm cấu hình để tránh lệch hợp đồng.

**Có thể kiểm tra nhanh tệp đã sinh bằng lệnh:**

```powershell
node -e "const a=require('./contracts/openapi/openapi.json'); const b=require('./contracts/openapi/openapi.dev.json'); const p='/api/v1/dev/media/upload-test'; console.log('Sản xuất không có đường thử:',!a.paths[p]); console.log('Phát triển có đường thử:',!!b.paths[p]); console.log('Bảo mật:',b.paths[p]?.post?.security); console.log('Các trường:',Object.keys(b.paths[p]?.post?.requestBody?.content?.['multipart/form-data']?.schema?.properties||{}))"
```

Chỉ tiếp tục nếu cả hai điều kiện về sự tồn tại của đường dẫn đều đúng.

### 2. Chuẩn bị môi trường riêng để kiểm thử

Dùng cơ sở dữ liệu phát triển và tài khoản Cloudinary chuyên để kiểm thử, **không dùng dữ liệu thật của khách hàng**. Trong `.env` cục bộ, chuẩn bị các biến sau mà không chép giá trị bí mật vào tài liệu:

```dotenv
NODE_ENV=development
MEDIA_ENABLED=true
MEDIA_DEV_UPLOAD_ENABLED=true
MEDIA_PROVIDER=CLOUDINARY
CLOUDINARY_CLOUD_NAME=<gia_tri_cua_ban>
CLOUDINARY_API_KEY=<gia_tri_cua_ban>
CLOUDINARY_API_SECRET=<gia_tri_cua_ban>
CLOUDINARY_SIGNATURE_ALGORITHM=sha256
```

Nếu trước đây đã gửi tệp `.env` chứa khóa thật qua trò chuyện hoặc đưa vào kho Git, phải thay khóa trước khi tiếp tục. Bảo đảm `.env` không được đưa lên Git; chỉ chia sẻ `.env.example` chứa giá trị mẫu.

Thực hiện kiểm tra khởi động:

```powershell
npx prisma validate
npx prisma migrate status
npm run build
npx jest
npm run start:dev
```

Ghi lại **kết quả thực tế** của từng lệnh và thời điểm thực hiện. Không coi số lượng bài thử do trợ lý lập trình tự báo là bằng chứng nếu chưa có đầu ra của lần chạy hiện tại.

Mở đường dẫn Swagger do ứng dụng thực tế công bố (thường là `http://localhost:3000/api` hoặc đường dẫn được khai báo trong `main.ts`). Trước khi kiểm thử, xác định đúng địa chỉ bằng cách xem `main.ts` hoặc nhật ký khởi động; không tự mặc định đường dẫn chỉ dựa vào tài liệu này.

### 3. Chuẩn bị tài khoản và tệp thử

Tạo hoặc dùng các tài khoản thử **có phân quyền thực trong cơ sở dữ liệu**: `USER`, `LEADER`, `STAFF_INVENTORY`, `STAFF_DELIVERY`, `ADMIN`. Dùng ít nhất hai tài khoản độc lập để kiểm tra truy cập chéo. Lấy mã truy cập hợp lệ theo quy trình xác thực TrekGo và nhập ở nút **Authorize** của Swagger. Không đưa mã truy cập vào ảnh, nhật ký chia sẻ hoặc tệp báo cáo.

Chuẩn bị tệp giả lập, không chứa dữ liệu người thật:

| Mã mẫu | Tệp thử | Đặc điểm |
|---|---|---|
| T01 | Ảnh JPEG sản phẩm | Dung lượng nhỏ, kích thước khoảng 1.200 × 900 điểm ảnh |
| T02 | Ảnh JPEG tình trạng thiết bị | Kích thước hợp lệ, có EXIF thử nghiệm nếu có thể |
| T03 | Video MP4 trả thiết bị | Dung lượng nhỏ, dài khoảng 5–10 giây, kích thước hợp lệ |
| T04 | Ảnh JPEG không hợp lệ | Kích thước 100 × 100 điểm ảnh, nhỏ hơn ngưỡng cấu hình |
| T05 | Một tệp không được cho phép | Ví dụ tệp văn bản; dùng để thử bước tiếp nhận |

Nếu quy định cấu hình của bản mã mới khác các ngưỡng nêu trên thì lấy ngưỡng thực tế từ `config.ts`, không cố dùng số liệu mẫu này.

### 4. Quy tắc thu thập bằng chứng

Mỗi trường hợp bắt buộc phải lưu: mã tình huống, người thực hiện, ngày giờ, vai trò, phương thức và đường dẫn API, mã phản hồi, `mediaId`/mã thiết bị liên quan, ảnh chụp giao diện Swagger đã **che mã truy cập/chữ ký**, kết quả đối chiếu cơ sở dữ liệu và Cloudinary (nếu có), cùng kết luận đạt/không đạt.

**Các khóa ký tải tệp lên là dữ liệu có thời hạn.** Không đưa toàn bộ kết quả `upload-intents`, chữ ký Cloudinary, mật khẩu, khóa bí mật, đường dẫn gốc có quyền truy cập vào biên bản gửi ra ngoài. Đặt các tệp tạm trong thư mục cục bộ đã được loại trừ khỏi Git và xóa sau thử nghiệm.

---

## II. Kiểm thử B0 — Danh mục và kho thiết bị của Giai đoạn 0

Đây là phần **B0**. Nó tách biệt với **M0**; không được lấy việc tải hình thành công làm bằng chứng rằng toàn bộ danh mục, kho và nghiệp vụ thiết bị đã đạt.

| Mã | Thao tác trên Swagger | Điều kiện đạt / cần quan sát |
|---|---|---|
| B0-01 | `GET /api/v1/rental-categories` | Trả danh sách danh mục theo dữ liệu thực; phân trang ổn định. |
| B0-02 | `GET /api/v1/rental-products` | Chỉ trả sản phẩm hợp lệ để công khai; bộ lọc và phân trang hoạt động. |
| B0-03 | `POST /api/v1/staff/rental-products` | `STAFF_INVENTORY` tạo sản phẩm đúng yêu cầu; lưu trạng thái khởi tạo dự kiến. |
| B0-04 | `GET /api/v1/rental-products/{id}` | Sản phẩm đang được công khai xem được; sản phẩm ẩn không vô tình lộ theo API công khai. |
| B0-05 | `PATCH /api/v1/staff/rental-products/{id}` | Thay đổi thông tin với `expectedVersion` hợp lệ; phiên bản cũ phải bị từ chối. |
| B0-06 | `PATCH /api/v1/staff/rental-products/{id}/status` | Kiểm tra vòng đời công khai/ẩn/lưu trữ và xung đột phiên bản. |
| B0-07 | `GET /api/v1/staff/inventory-locations` | Trả danh sách địa điểm kho và bộ lọc phù hợp. |
| B0-08 | `POST /api/v1/staff/equipment-units` | Tạo một thiết bị vật lý cho sản phẩm và kho hợp lệ; có mã tài sản, mã QR và trạng thái khởi tạo theo quy tắc hiện hành. |
| B0-09 | `POST /api/v1/staff/equipment-units/batch` | Thêm lô; chế độ tự sinh và chế độ cung cấp mã; khi lỗi phải bảo đảm tính toàn vẹn cả lô. |
| B0-10 | `GET /api/v1/staff/equipment-units` và `GET /api/v1/staff/equipment-units/{id}` | Danh sách, bộ lọc, thống kê số lượng, chi tiết và lịch sử khớp cơ sở dữ liệu. |
| B0-11 | `PATCH /api/v1/staff/equipment-units/{id}` | Chỉ trường thông tin được phép mới thay đổi; không sửa trái phép trạng thái vật lý; phiên bản cũ bị từ chối. |
| B0-12 | `POST /api/v1/staff/equipment-units/{id}/maintenance` | Bắt đầu và kết thúc bảo trì theo điều kiện trạng thái; thiết bị đang được thuê phải bị chặn. |
| B0-13 | `POST /api/v1/staff/equipment-units/labels` | Tạo được dữ liệu tem/mã QR; không làm thay đổi trạng thái thiết bị. |
| B0-14 | Lặp lại thao tác quản trị với `USER` | Các thao tác yêu cầu nhân viên không được thực hiện bởi người dùng thường. |

**Kiểm thử liên kết B0 ↔ M0:** Dùng một ảnh sản phẩm từ M0 đạt `READY`, gắn `mediaId` vào `imageMediaIds` khi tạo/cập nhật sản phẩm B0. Đối chiếu dữ liệu thực tế trong `RentalProduct.images` (nếu bản mã hiện hành vẫn lưu ở trường này). Sau đó thử xóa tệp: nếu còn được tham chiếu, yêu cầu xóa phải bị chặn. Đây là phép thử quan trọng vì tầng kiểm tra tham chiếu hiện xét các mảng JSON.

**Giới hạn phạm vi:** B0 ở đây là danh mục/kho thiết bị theo các API đã có. Các luồng thanh toán, thuê đồ, giao nhận và hoàn trả đầy đủ thuộc các giai đoạn nghiệp vụ riêng; không kết luận chúng hoàn tất từ kết quả B0/M0.

---

## III. Kiểm thử M0 — Nền tảng tệp hình ảnh và video

### M0-01. Kiểm tra đường dẫn thử trực tiếp trên Swagger

Trong Swagger đang chạy thật, tìm:

```text
POST /api/v1/dev/media/upload-test
```

Nhấn **Try it out** và xác nhận có nút **Choose File** cùng các trường `scope`, `captureSource`, `clientCapturedAt` (không bắt buộc). Không được có trường `ownerUserId` để người gửi tự chọn chủ sở hữu. Kiểm tra nút **Authorize** hoạt động bằng tài khoản thực.

Nếu chỉ nhìn thấy tệp JSON có đường dẫn này, **chưa đủ**: phải nhìn thấy đường dẫn trong Swagger của ứng dụng đã khởi động bằng mã nguồn hiện tại. Nếu đường dẫn không xuất hiện, kiểm tra `NODE_ENV`, `MEDIA_DEV_UPLOAD_ENABLED`, quá trình khởi động lại ứng dụng và cách sinh tệp hợp đồng.

### M0-02. Tải ảnh danh mục bằng nút chọn tệp

Đăng nhập bằng `STAFF_INVENTORY` hoặc `ADMIN`. Tại đường dẫn thử, chọn **T01**, dùng `scope=RENTAL_PRODUCT`, `captureSource=GALLERY` hoặc `UNKNOWN`, để trống thời điểm chụp nếu không biết. Gửi yêu cầu.

**Điều kiện đạt:** Phản hồi cuối có `id`, `scope=RENTAL_PRODUCT`, `resourceType=IMAGE`, `status=READY`. Trong bảng `media_assets`, bản ghi có `provider=CLOUDINARY`, `providerPublicId`, định dạng, dung lượng, kích thước và thời điểm xác minh; trên Cloudinary tài sản thuộc loại phân phối `upload`. Tài liệu phản hồi không chứa khóa bí mật hay siêu dữ liệu nhạy cảm.

Sau đó gọi:

```text
GET /api/v1/media/{id}/delivery?variant=CATALOG_CARD&format=WEBP
```

Mở URL nhận được để kiểm tra hình thực sự hiển thị ở định dạng được yêu cầu. Lặp lại với `CATALOG_THUMBNAIL`, `CATALOG_DETAIL` và `format=JPEG`. Không chỉ kiểm tra URL có chuỗi biến đổi: cần mở hình và kiểm tra kích thước cùng nội dung hiển thị.

### M0-03. Tải ảnh bằng chứng có bảo vệ quyền

Đăng nhập bằng `STAFF_INVENTORY`; chọn **T02**; dùng `scope=CONDITION_EVIDENCE`, `captureSource=GALLERY` nếu tệp lấy từ thư viện, hoặc `CAMERA` chỉ khi thực sự dùng luồng chụp trực tiếp mà ứng dụng cung cấp. Không khai khống thời điểm chụp.

**Điều kiện đạt:** Tài sản Cloudinary có loại phân phối `authenticated`; bản gốc không bị thay thế bởi ảnh đã thu nhỏ; quy trình xác minh sinh trạng thái `READY`. Trong dữ liệu lưu trữ phải có SHA-256 bản gốc, pHash nếu dịch vụ hỗ trợ và các kết quả EXIF/nguồn gốc phù hợp. **Không suy ra ảnh là ảnh gốc chỉ dựa trên EXIF hoặc `captureSource=CAMERA`.** C2PA `UNSUPPORTED` là chấp nhận được nếu chưa tích hợp trình xác minh thật.

Kiểm tra:

```text
GET /api/v1/media/{id}/delivery?variant=EVIDENCE_PREVIEW&format=JPEG
GET /api/v1/media/{id}/delivery?variant=EVIDENCE_PREVIEW&format=WEBP
```

Phải mở được cả hai dẫn xuất được cho phép. Thử lấy URL bằng tài khoản **không phải chủ sở hữu và không có quyền**: API TrekGo phải từ chối. Thử yêu cầu `variant=CATALOG_CARD` trên chính mã bằng chứng đó: phải bị từ chối.

**Chú ý bảo mật trọng yếu:** URL Cloudinary **đã ký hợp lệ** có thể mở được khi sao chép sang một trình duyệt chưa đăng nhập TrekGo; chữ ký trong URL chính là quyền truy cập ở tầng Cloudinary. Do đó không đánh dấu lỗi chỉ vì URL đã ký mở được trong trình duyệt ẩn danh. Thay vào đó, phải chứng minh URL **không có chữ ký** không đọc được bằng chứng và API TrekGo từ chối người không có quyền. Nếu sản phẩm yêu cầu URL tự hết hạn, phải thử thời hạn thật; chữ ký URL thông thường **không đồng nghĩa** với quyền truy cập có thời hạn.

### M0-04. Tải video bằng chứng

Đăng nhập bằng `STAFF_INVENTORY` hoặc `STAFF_DELIVERY`. Chọn **T03**, dùng `scope=RETURN_EVIDENCE`. Xác nhận `resourceType=VIDEO`, `deliveryType=authenticated`, thời lượng và kích thước thực tế sau xác minh, trạng thái `READY`.

Lấy dẫn xuất:

```text
GET /api/v1/media/{id}/delivery?variant=VIDEO_PREVIEW
```

Mở và phát video thật. Ghi lại độ dài, khả năng phát và việc không cần chuyển đổi tệp trên máy chủ NestJS. Không yêu cầu pHash/EXIF của ảnh đối với video.

### M0-05. Kiểm tra tệp bị từ chối

Dùng **T04** (JPEG 100 × 100) với một phạm vi cho phép ảnh. Để ghi được chính xác `mediaId`, nên thực hiện bằng luồng trực tiếp ở Mục IV thay vì chỉ dùng đường dẫn thử gộp (đường thử gộp có thể trả lỗi trước khi trả về mã tài sản).

**Điều kiện đạt:** Tiếp nhận tệp thành công ở bước tải trực tiếp, nhưng kiểm tra kích thước thực tế từ Cloudinary phát hiện tệp không hợp lệ; xác nhận tệp không trở thành `READY`, bản ghi chuyển `REJECTED` nếu đúng quy tắc áp dụng. Phân biệt trường hợp bị chặn ngay từ đầu vì MIME hoặc dung lượng khai báo: trường hợp đó có thể không tạo ra bản ghi đã tải lên để chuyển `REJECTED`.

### M0-06. Kiểm tra phân quyền tiếp nhận

Dùng tài khoản `USER` gửi `scope=RENTAL_PRODUCT`: phải bị từ chối. Dùng `STAFF_INVENTORY` gửi cùng tệp và phạm vi: phải được tiếp nhận. Kiểm tra thêm `STAFF_DELIVERY` với `RETURN_EVIDENCE` và một tài khoản không liên quan thử đọc bằng chứng của tài khoản khác.

### M0-07. Kiểm tra xác nhận sai chủ sở hữu

Tạo một yêu cầu tiếp nhận bằng tài khoản A, lưu `mediaId`. Đăng nhập tài khoản B và gọi:

```text
POST /api/v1/media/{id}/complete
```

Trước khi tài khoản A xác nhận, tài khoản B dùng cùng mã và dữ liệu trả từ Cloudinary. **Điều kiện đạt:** Không được xác nhận tài sản của A; nếu cơ chế che giấu tài nguyên dùng `MEDIA_NOT_FOUND`, chấp nhận phản hồi 404. Sau đó A xác nhận đúng và tài sản có thể đạt `READY`.

### M0-08. Kiểm tra tính an toàn khi lặp yêu cầu xác nhận

Đối với tệp đã đạt `READY`, gửi lại yêu cầu xác nhận bằng **chính chủ sở hữu**, với dữ liệu hợp lệ đã lưu tạm trong môi trường kiểm thử. Điều kiện đạt: tài sản vẫn ở `READY`, không tạo tệp mới hoặc chạy lại hàng loạt phép phân tích tốn phí. Với hai yêu cầu cùng lúc trước khi `READY`, chỉ một yêu cầu được giành quyền xử lý; yêu cầu còn lại phải được xử lý theo quy tắc xung đột/thử lại đã công bố, không tính phí tạo dẫn xuất hai lần một cách không kiểm soát.

### M0-09. Kiểm tra xóa tài sản đủ điều kiện

**Không dùng ngay một ảnh `READY` mới tạo để khẳng định xóa có lỗi.** Mã nguồn áp dụng thời hạn lưu trữ cho ảnh danh mục và bằng chứng; ảnh mới thường chưa đủ điều kiện xóa.

Chuẩn bị **một tài sản thử không có tham chiếu** và làm cho thời hạn lưu trữ đã hết trong cơ sở dữ liệu phát triển bằng dữ liệu thử có kiểm soát hoặc chờ thời hạn quy định. Không sửa thủ công dữ liệu sản xuất; không sửa bản ghi đang liên quan đến đơn thuê thật.

Gọi:

```text
DELETE /api/v1/media/{id}
```

**Điều kiện đạt:** Kiểm tra bằng nhật ký an toàn hoặc phép thử trạng thái rằng yêu cầu đã đi qua `DELETE_PENDING` (lần xóa đồng bộ có thể chuyển sang trạng thái cuối quá nhanh để quan sát trực tiếp); sau khi dịch vụ lưu trữ xóa thành công, bản ghi chuyển `DELETED`, có `deletedAt`, **hàng cơ sở dữ liệu vẫn còn** để kiểm toán. Kiểm tra tài sản Cloudinary và phép yêu cầu vô hiệu hóa bộ nhớ đệm. Lặp lại DELETE: phải an toàn theo quy tắc lặp yêu cầu; API phân phối không được trả lại tài sản `DELETED`. Không tuyên bố tệp đã biến mất tức thì khỏi mọi bộ nhớ đệm/bản sao dự phòng.

### M0-10. Kiểm tra ngăn xóa tài sản đang được sử dụng

Dùng ảnh `READY` đã gắn vào sản phẩm B0, hoặc một ảnh bằng chứng đã gắn vào bản ghi nghiệp vụ tương ứng. Chỉ đối với dữ liệu thử, đưa `retentionUntil` về thời điểm đã qua để tránh việc kiểm tra thời hạn che mất lỗi kiểm tra tham chiếu. Sau đó gọi DELETE bằng tài khoản được phép.

**Điều kiện đạt:** Bị chặn do còn tham chiếu; không đổi sang `DELETED`, không gọi xóa vật lý. Nếu tài sản chưa hết thời hạn, hệ thống có thể chặn sớm bằng quy tắc lưu trữ; kết quả đó **không đủ** để kết luận kiểm tra tham chiếu hoạt động.

### M0-11. Kiểm tra xóa bị gián đoạn và chạy dọn dẹp

Thử trên môi trường riêng, với một bản ghi thử ở trạng thái `DELETE_PENDING`: mô phỏng dịch vụ lưu trữ tạm thời không đáp ứng, kiểm tra trạng thái vẫn được giữ để thử lại, không có phản hồi thành công giả. Sau đó khôi phục dịch vụ, chạy lại yêu cầu hoặc cơ chế dọn dẹp và đối chiếu `DELETED`.

Chuẩn bị riêng dữ liệu thử: `PENDING_UPLOAD` quá hạn, `REJECTED` quá hạn, `READY` không có tham chiếu và đã hết hạn, `READY` còn tham chiếu, `DELETE_PENDING`, `DELETED`. Đối chiếu ứng viên theo giới hạn lô và bảo đảm bản ghi còn tham chiếu **không bị xóa**. Lưu ý lịch dọn dẹp hiện được thiết kế chạy theo giờ; nếu không có trình kích hoạt chỉ dùng trong kiểm thử, kiểm tra trực tiếp ca này bằng phép thử tích hợp hoặc chờ lịch trên môi trường thử. Không tạo đường dẫn công khai để bất kỳ ai kích hoạt dọn dẹp.

### M0-12. Kiểm tra rò rỉ thông tin

Rà soát phản hồi và nhật ký của các ca trên: không được có `CLOUDINARY_API_SECRET`, khóa quản trị Supabase, mật khẩu, siêu dữ liệu GPS gốc hoặc toàn bộ siêu dữ liệu pháp chứng trong API thông thường. Những trường như SHA-256, pHash và EXIF chi tiết chỉ được giữ nội bộ theo phân quyền; các ảnh chụp bằng chứng phải che mã truy cập và đường dẫn gốc nhạy cảm.

---

## IV. Kiểm thử luồng tải trực tiếp thực sự, không qua máy chủ NestJS

Đường thử bằng nút chọn tệp ở Mục III là công cụ hỗ trợ phát triển. Nó **không thay thế** luồng chính của ứng dụng trong đó trình duyệt/điện thoại tải thẳng lên Cloudinary. Mục này là bắt buộc cho **cả ảnh JPEG và video MP4**.

### 1. Tạo yêu cầu tải tệp trên Swagger

Dùng tài khoản có đúng quyền. Ví dụ yêu cầu JPEG danh mục:

```http
POST /api/v1/media/upload-intents
Authorization: Bearer <ma_truy_cap_hop_le>
Content-Type: application/json
```

```json
{
  "scope": "RENTAL_PRODUCT",
  "resourceType": "IMAGE",
  "fileName": "anh-san-pham.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 345678,
  "captureSource": "GALLERY"
}
```

**Thay `sizeBytes` bằng dung lượng thực tế của tệp**, không sao chép số mẫu. Không điền `clientCapturedAt` nếu không có giá trị do thiết bị người dùng cung cấp thật.

Giữ tạm phản hồi vào máy cục bộ để lấy: `data.mediaId`, `data.upload.uploadUrl`, `data.upload.formFields`. Tệp tạm này chứa chữ ký upload có thời hạn; không commit.

### 2. Tải tệp trực tiếp lên Cloudinary

Dùng `curl.exe` hoặc công cụ gửi `multipart/form-data`; gửi **trực tiếp tới `uploadUrl`**, không gửi tệp vào NestJS. Mỗi trường trong `formFields` phải được gửi đúng giá trị và tệp đặt ở trường `file`.

Ví dụ khung lệnh (giá trị thực lấy từ phản hồi ở bước 1):

```powershell
curl.exe -X POST "<uploadUrl>" `
  -F "file=@C:\duong-dan\anh-san-pham.jpg" `
  -F "api_key=<api_key_tu_formFields>" `
  -F "timestamp=<timestamp_tu_formFields>" `
  -F "signature=<signature_tu_formFields>" `
  -F "public_id=<public_id_tu_formFields>" `
  -F "type=<type_tu_formFields>"
```

Nếu phiên bản sau trả thêm trường ký hợp lệ khác, phải gửi **toàn bộ `formFields`**, không giới hạn ở ví dụ này.

Cloudinary phải trả `public_id`, `version`, `signature`. Không đưa phản hồi này vào Git.

### 3. Xác nhận với TrekGo

Trở lại Swagger, gọi:

```http
POST /api/v1/media/{mediaId}/complete
```

```json
{
  "publicId": "<public_id_tu_cloudinary>",
  "version": 123456789,
  "signature": "<signature_tu_cloudinary>"
}
```

Điều kiện đạt: API tự truy vấn siêu dữ liệu chính thức từ Cloudinary, kiểm chữ ký và chính sách, rồi chuyển sang `READY` hoặc `REJECTED` đúng nguyên nhân. Không tin URL/dung lượng/kích thước do người dùng tự gửi ở bước hoàn tất.

Lặp lại toàn bộ mục này với **T03 MP4 và phạm vi `RETURN_EVIDENCE`**, đăng nhập bằng vai trò được phép. Phản hồi intent phải có `type=authenticated`, đường tải lên dùng nhánh video Cloudinary, việc xác nhận phải đối chiếu thời lượng và kích thước video thật.

---

## V. Kiểm tra dữ liệu sau mỗi tình huống

Có thể dùng Prisma Studio hoặc công cụ quản trị PostgreSQL trên môi trường phát triển:

```powershell
npx prisma studio
```

Không sửa dữ liệu tùy tiện trừ khi tình huống kiểm thử ghi rõ cần một **bản ghi thử có kiểm soát** để vượt thời hạn lưu trữ. Với `MediaAsset`, cần quan sát tối thiểu: `id`, `ownerUserId`, `scope`, `resourceType`, `status`, `providerPublicId`, `deliveryType`, `sizeBytes`, `width`, `height`, `durationMs`, `uploadedAt`, `readyAt`, `retentionUntil`, `deletedAt`, `version`. Với ảnh bằng chứng còn kiểm tra nội bộ `sha256`, `perceptualHash`, `exifMetadata`, `exifCapturedAt`, `c2paStatus`, `provenanceStatus`, `provenanceReasons` nhưng **không đưa giá trị pháp chứng nhạy cảm đầy đủ vào biên bản ngoài nhóm kỹ thuật**.

Các giá trị phải được đối chiếu với Cloudinary ở cùng `providerPublicId`. Không đánh dấu đạt nếu chỉ có phản hồi HTTP đúng mà dữ liệu nền sai trạng thái.

---

## VI. Tiêu chí đóng băng Giai đoạn 0 và M0

### 1. Cổng B0

- [ ] Danh mục công khai hoạt động.
- [ ] Tạo/cập nhật/thay đổi trạng thái sản phẩm hoạt động đúng quyền và khóa phiên bản.
- [ ] Địa điểm kho xem được đúng quyền.
- [ ] Tạo một thiết bị và tạo lô hoạt động.
- [ ] Danh sách, chi tiết, bộ lọc và thống kê thiết bị đúng.
- [ ] Cập nhật thông tin thiết bị không vượt phạm vi cho phép.
- [ ] Bảo trì đúng vòng đời và khóa trường hợp thiết bị đang thuê.
- [ ] Sinh dữ liệu nhãn/mã QR không gây thay đổi vòng đời.
- [ ] Người dùng không có quyền bị chặn khỏi các thao tác nhân viên.
- [ ] `mediaId` thật có thể được gắn vào sản phẩm và tham chiếu được phát hiện khi xóa.

### 2. Cổng M0

- [ ] Swagger phát triển có nút chọn tệp thật và dùng Bearer thật.
- [ ] JPEG `RENTAL_PRODUCT` qua đường thử → `READY`.
- [ ] JPEG `CONDITION_EVIDENCE` qua đường thử → `authenticated` → nguồn gốc → `READY`.
- [ ] MP4 `RETURN_EVIDENCE` qua đường thử → `authenticated` → `READY`.
- [ ] Ảnh/video dẫn xuất mở và hiển thị/phát thực tế.
- [ ] Bằng chứng không thể bị đổi thành biến thể danh mục công khai.
- [ ] File không đạt chính sách → không trở thành `READY`; trạng thái cuối phù hợp.
- [ ] `USER` không được tải ảnh `RENTAL_PRODUCT`.
- [ ] Chủ sở hữu khác không thể hoàn tất/đọc/xóa bằng chứng trái phép.
- [ ] Xóa tài sản đủ điều kiện tạo tombstone `DELETED`, không xóa hàng cơ sở dữ liệu.
- [ ] Xóa tài sản còn tham chiếu bị chặn.
- [ ] Thời hạn lưu trữ thực sự được áp dụng.
- [ ] Cơ chế dọn dẹp chỉ xử lý ứng viên hợp lệ và lặp lại an toàn.
- [ ] Luồng trực tiếp JPEG: TrekGo tạo intent → máy khách tải thẳng Cloudinary → TrekGo complete → `READY`.
- [ ] Luồng trực tiếp MP4: TrekGo tạo intent → máy khách tải thẳng Cloudinary → TrekGo complete → `READY`.
- [ ] Không rò rỉ bí mật hoặc dữ liệu pháp chứng nhạy cảm.

### 3. Quy tắc kết luận

Chỉ ghi **“Giai đoạn 0 đạt”** khi toàn bộ B0 bắt buộc đạt. Chỉ ghi **“M0 — Nền tảng tệp hình ảnh và video đã đóng băng”** khi toàn bộ cổng M0 bắt buộc đạt. Nếu B0 đạt nhưng M0 còn một ca thủ công chưa chạy, ghi riêng `B0 đạt` và `M0 chờ kiểm thử`, không gộp thành đạt toàn bộ. Nếu mã nguồn/test tự động đạt nhưng chưa chạy luồng thật với Cloudinary, trạng thái đúng vẫn là **“cổng mã nguồn đạt — kiểm thử thủ công chưa hoàn tất”**.

---

## VII. Mẫu biên bản kết quả

| Mã | Ngày giờ | Vai trò | Dữ liệu/tệp thử | Kết quả mong đợi | Kết quả thực tế | Mã HTTP | Mã đối tượng | Bằng chứng | Kết luận |
|---|---|---|---|---|---|---:|---|---|---|
| B0-01 | | | | | | | | | |
| B0-03 | | STAFF_INVENTORY | | | | | | | |
| B0-08 | | STAFF_INVENTORY | | | | | | | |
| B0-12 | | STAFF_INVENTORY | | | | | | | |
| M0-02 | | STAFF_INVENTORY | T01 | READY | | | | | |
| M0-03 | | STAFF_INVENTORY | T02 | READY | | | | | |
| M0-04 | | STAFF_DELIVERY | T03 | READY | | | | | |
| M0-05 | | | T04 | REJECTED/đúng lỗi | | | | | |
| M0-09 | | | | DELETED | | | | | |
| M0-10 | | | | Bị chặn | | | | | |
| M0-TT-ẢNH | | | T01 | Direct → READY | | | | | |
| M0-TT-VIDEO | | | T03 | Direct → READY | | | | | |

**Kết luận cuối:**  
B0: ☐ Đạt ☐ Không đạt ☐ Chờ kiểm thử  
M0: ☐ Đã đóng băng ☐ Không đạt ☐ Chờ kiểm thử  
Người kiểm thử: ____________________  
Ngày giờ xác nhận: ____________________
