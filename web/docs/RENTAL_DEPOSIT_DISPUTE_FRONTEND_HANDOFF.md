# FE handoff: phản đối khoản trừ cọc thuê thiết bị

Tài liệu mô tả source backend hiện tại; cần xác nhận phiên bản đã deploy và thử trên môi trường tích hợp trước khi bật giao diện. Quy trình áp dụng theo từng thiết bị của một đơn thuê. Tiền thuê và tiền cọc là các khoản riêng; FE không tự tính hoặc tự tạo refund.

## Luồng cho khách

1. Gọi `GET /api/v1/rental-orders/{orderId}/deposit`, dùng `items[]` để hiển thị cọc, khoản trừ và khả năng phản đối theo từng món.
2. Gọi `GET /api/v1/rental-orders/{orderId}/assessment`, ghép `items[].inspectionId` với `deposit.items[].assessmentId` hoặc ghép `unit.id` với `unitId`. Ở assessment, `publishedDecision` chứa quyết định đã công bố và danh sách ID bằng chứng. Nó có thể là `null` trong khi hồ sơ chưa được công bố.
3. Với từng media ID trong `publishedDecision.evidenceIds`, gọi `GET /api/v1/media/{mediaId}/delivery?variant=EVIDENCE_PREVIEW` để xem ảnh; dùng `VIDEO_PREVIEW` cho video. Cần bearer token của **chủ đơn**. API trả URL, không trả trực tiếp file. Trường hợp Media chưa sẵn sàng hoặc không truy cập được, hiển thị đang chờ xử lý và không suy đoán thời điểm bắt đầu 48 giờ. `GET /api/v1/rental-orders/{orderId}/documents` liệt kê chứng từ đơn; PDF chỉ dùng khi tài liệu tương ứng thực sự có và đã sẵn sàng.
4. Chỉ bật “Phản đối khoản trừ” khi `canSubmitReview === true`. Hiển thị `reviewWindowEndsAt` theo múi giờ người dùng. Backend là nguồn quyết định cuối cùng; refetch trước khi gửi và xử lý lỗi nếu hạn hoặc trạng thái đã thay đổi.
5. Nếu khách gửi ảnh/video, tạo upload intent với scope `EXCEPTION_EVIDENCE`, upload theo kết quả trả về và gọi `POST /api/v1/media/{id}/complete`. Chỉ gửi các media ID đã `READY`; ảnh là tùy chọn. Xem thêm `MEDIA_FRONTEND_INTEGRATION_GUIDE.md`.
6. Gửi `POST /api/v1/rental-orders/{orderId}/assessment-reviews`, header `Idempotency-Key` duy nhất cho hành động, body `{ "assessmentId": "<UUID>", "reason": "<3–3000 ký tự>", "evidenceIds": ["<UUID>"] }`. `evidenceIds` có thể bỏ qua hoặc là `[]`, tối đa 20. Khi retry do timeout, dùng lại cùng key và cùng body. Với ý định mới dùng key mới; mỗi assessment/chủ đơn chỉ có một review.
7. Sau khi gửi thành công, refetch deposit/assessment. ADMIN xem xét case; khi đã giải quyết, tiếp tục theo dõi trạng thái cọc/refund. Không coi `REFUND_PENDING` hoặc refund `PROCESSING` là tiền đã về; chỉ `SUCCEEDED` là hoàn thành công.

## Các field bổ sung trên mỗi item của 607

| Field | Ý nghĩa |
| --- | --- |
| `assessmentId` | UUID kiểm định FINAL để gửi 609; `null` khi chưa có. |
| `exceptionCaseId` | Case quyết định ban đầu đã công bố; `null` trước khi công bố. |
| `reviewCaseId` | Case gắn với review do khách gửi; `null` nếu chưa gửi. Hai case ID có thể khác nhau. |
| `evidenceAccessibleAt` | Mốc UTC chứng cứ và thông báo đã được xác minh công bố; `null` nghĩa là chưa mở cửa sổ. |
| `reviewWindowEndsAt` | Hạn phản hồi UTC do backend tính; `null` khi chưa xác định hoặc quyền xem đang gián đoạn. Không tự cộng 48 giờ từ thời điểm ADMIN bấm duyệt. |
| `evidenceAccessBlockedAt` | Thời điểm backend ghi nhận sự cố truy cập; `null` khi không có sự cố đang mở. |
| `evidenceAccessCustomerConfirmationRequired` | `true` nếu khách đã báo lỗi và cần tự xác nhận đã xem lại được trước khi server xác minh và khởi động lại thời hạn. |
| `reviewStatus` | `NOT_SUBMITTED`, `SUBMITTED` hoặc `RESOLVED`; phản ánh review của chủ đơn, không phải trạng thái quyết định ban đầu. |
| `canSubmitReview` | Quyền gửi theo trạng thái tại thời điểm đọc; backend kiểm tra lại lúc ghi. |
| `cannotSubmitReviewReason` | `null` nếu được gửi; nếu không, một trong `ORDER_OWNER_ONLY`, `ASSESSMENT_NOT_READY`, `REVIEW_ALREADY_SUBMITTED`, `NO_APPROVED_DEDUCTION`, `EVIDENCE_NOT_ACCESSIBLE`, `EVIDENCE_ACCESS_INTERRUPTED`, `USER_REVIEW_WINDOW_EXPIRED`, `SETTLEMENT_ALREADY_STARTED`. |
| `approvedDeduction` | Số tiền ADMIN duyệt, VND nguyên; có thể khác `deduction` khi chưa quyết toán. |

`NOT_SUBMITTED` không có nghĩa chắc chắn được phản đối: kiểm tra `canSubmitReview`. Chủ đơn mới được gửi 609; người nhận có thể được phép xem đơn nhưng không tự động có quyền phản đối.

## Trạng thái và lỗi

- Nếu `EVIDENCE_NOT_ACCESSIBLE`, hiển thị hồ sơ đang được công bố; không hiển thị đồng hồ hay hứa thời điểm bắt đầu.
- Nếu không xem được chứng cứ đã công bố, chủ đơn có thể gửi `POST /api/v1/rental-orders/{orderId}/assessments/{assessmentId}/evidence-access-reports` với bearer token và `Idempotency-Key` (8–200 ký tự), không cần body. Retry cùng key. Hệ thống giữ khoản liên quan và ghi audit. Với `EVIDENCE_ACCESS_INTERRUPTED`, hiển thị “Đang khôi phục chứng cứ”, không hiển thị hạn cũ.
- Khi `evidenceAccessCustomerConfirmationRequired = true`, cho khách thử xem lại toàn bộ chứng cứ. Chỉ khi khách xác nhận đã xem được, gọi `POST /api/v1/rental-orders/{orderId}/assessments/{assessmentId}/evidence-access-confirmations` với bearer token, key idempotency mới và không cần body. Response `AWAITING_VERIFICATION` chưa phải đã khôi phục. Backend xác minh server và thông báo lại; khi thành công cấp **đủ 48 giờ mới**. Refetch 607 để lấy hạn mới. Nếu quyết toán đã bắt đầu, báo cáo lỗi trả `SETTLEMENT_ALREADY_STARTED`, cần hướng khách đến hỗ trợ.
- `REVIEW_ALREADY_SUBMITTED`: refetch, hiển thị review/case đã gửi; không tạo key mới để gửi lại cùng nội dung. Nếu timeout chưa rõ kết quả, retry với **cùng** key/body trước.
- `USER_REVIEW_WINDOW_EXPIRED`: đóng form và refetch. Thời hạn được kiểm tra theo đồng hồ server, bao gồm cả khi người dùng để form mở lâu.
- `ORDER_OWNER_ONLY`, `NO_APPROVED_DEDUCTION`, `SETTLEMENT_ALREADY_STARTED`: không cho gửi; thông báo theo tình trạng thực tế.
- Lỗi API theo envelope chung: đọc `response.data.error.code`, `response.data.error.message` và `response.data.error.details.reason`; không đọc `response.data.message`.
- Không có chức năng “đồng ý để bỏ qua 48 giờ” trong contract này. Không dùng 609 để ghi nhận sự đồng ý.

## Lưu ý vận hành và kiểm thử

Sau ADMIN duyệt, worker xác minh URL chứng cứ theo quyền chủ đơn, sau đó lưu thông báo in-app và mốc công bố. Cấu hình `RENTAL_MEDIA_ACCESS_ATTESTATION_SECRET`, Media và khả năng truy cập provider phải hoạt động; lỗi sẽ giữ hồ sơ chờ retry. Một số hồ sơ cũ có tập bằng chứng case thiếu file từ assessment/findings có thể cần được xử lý, không được tự bật đồng hồ. Quyết toán được thử lại qua 606 sau khi đủ điều kiện; nếu hệ thống trả lỗi, không giả định đã hoàn tiền.

Kiểm thử tối thiểu trên môi trường thật: hai món cùng đơn (một PASS, một ISSUE), xem chứng cứ bằng chủ đơn và từ chối người ngoài, công bố thành công/thất bại, gửi review có/không ảnh, retry cùng key, gửi trùng key khác, hết hạn, ADMIN xử lý review, quyết toán và refund `SUCCEEDED`. Các thời điểm phải lấy từ backend; dữ liệu sandbox không chứng minh tiền thật đã được hoàn.
