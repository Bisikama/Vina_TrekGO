# Bàn giao Frontend — Gear Advisor có hướng dẫn

Tài liệu này mô tả API backend hiện có để nhóm Frontend xây dựng trải nghiệm từng bước. Phần giao diện chưa được triển khai. Mọi API bên dưới có tiền tố `/api/v1`; xác thực bằng Bearer token của chủ tủ đồ và kế hoạch.

## Luồng đề xuất

1. Chọn chuyến đi; gọi `GET /gear/plans/prefill?tripId={tripId}` để lấy dữ kiện và gợi ý khí hậu. Người dùng cần xác nhận khí hậu trước khi đánh giá. Nếu không đủ thông tin, không tự suy đoán.
2. Lấy tủ đồ qua `GET /gear/items`. Người dùng chọn những món muốn mang. Để thêm món mới, gọi `POST /gear/items` với `name`, `category`, `condition` và `attributes`; các thuộc tính kỹ thuật có thể để trống. UI có thể cho phép nhập dần, nhưng backend hiện yêu cầu lưu món vào tủ đồ trước khi chọn cho kế hoạch. Lựa chọn “chưa có” là trạng thái hiển thị trên client, chưa có API lưu riêng theo chuyến.
3. Gọi `POST /gear/plans` với `title`, `contextMode: "TRIP"`, `tripId`, `selectedItemIds`; lưu `id` và `inputRevision`. Có thể cập nhật lựa chọn qua `PATCH /gear/plans/{id}` với `expectedInputRevision` hiện tại.
4. Gọi `POST /gear/plans/{id}/evaluate` với `expectedInputRevision` và `confirmedClimate` gồm `temp_min_c`, `temp_max_c`, `temp_min_night_c`, `rain_prob_pct`. Lấy phiên bản thực tế từ `GET /gear/plans/{id}` (`evaluatedRevision`) sau khi đánh giá, vì đánh giá lại sau khi món đồ thay đổi có thể tăng phiên bản.
5. Gọi `GET /gear/plans/{id}/revisions/{revision}/guidance`. Đây là hướng dẫn cho **snapshot phiên bản được yêu cầu**, không tự thay đổi khi món đồ được cập nhật.
6. Khi người dùng bổ sung thông tin, lấy `GET /gear/items/{itemId}` để có `version` mới nhất; gọi `PATCH /gear/items/{itemId}` với `expectedVersion` và `attributes` cần cập nhật. Sau đó lấy kế hoạch, đánh giá lại bằng `inputRevision` hiện tại và đọc `evaluatedRevision` mới trước khi lấy guidance. Tôn trọng lỗi xung đột phiên bản và tải lại dữ liệu khi cần.

Response `evaluate` bổ sung `displayGuidance` ở từng phần tử `itemVerdicts` và `coreCheck.items` mà không thay `verdict`: `READY` (verdict phù hợp), `NEEDS_INFO` (chỉ thiếu dữ liệu), `NEEDS_PREPARATION` (đã có vi phạm). `actions` đưa hành động gợi ý; `missingAttributes` gồm `key`, `type`, `unit` khi có, và các rule `requiredBy` thực sự áp dụng. Nếu có cả vi phạm và thông tin thiếu, ưu tiên `NEEDS_PREPARATION`. Các trường này được tính khi trả evaluate, không ghi vào snapshot bất biến; response lịch sử trong `/revisions/{revision}` không tự có trường mới.

## Dữ liệu guidance

- `available: false` nghĩa là snapshot không có chi tiết core cần thiết; không hiển thị như một kết quả phù hợp. Khi `available: true`, `items` và `requirements` là hai góc nhìn khác nhau.
- `revision` là snapshot đang xem; `inputRevision` và `evaluatedRevision` là phiên bản hiện tại của kế hoạch. `isLatestEvaluation: false` nghĩa là đang xem lịch sử. `needsReevaluation: true` nghĩa là đầu vào chưa được đánh giá lại hoặc kiểm tra hiện có phát hiện dữ liệu đã cũ; hãy hướng dẫn đánh giá lại thay vì coi snapshot là kết quả hiện tại. Hai trạng thái độc lập: đang xem lịch sử vẫn có thể có `needsReevaluation: false` khi bản mới nhất không bị phát hiện cũ. `isStale` dùng cùng cơ chế kiểm tra của `GET /gear/plans/{id}`; `false` không bảo đảm dữ liệu ngoài hệ thống không thay đổi hoặc mọi kiểm tra dữ liệu nguồn đều thành công.
- `items` gồm từng món thuộc 5 danh mục core với `itemId`, `category`, verdict kỹ thuật, `displayStatus`, `reasons` và `questions`. `nameAtEvaluation` và `versionAtEvaluation` là tên/phiên bản lúc đánh giá, có thể là `null` ở snapshot cũ. Đây là dữ liệu lịch sử: trước khi sửa vẫn phải lấy món hiện tại và dùng `version` mới nhất cho `expectedVersion`. `SUITABLE` là verdict core, không có nghĩa toàn bộ kế hoạch đã được đáp ứng. `NEEDS_INFORMATION` là thiếu dữ liệu cho quy tắc áp dụng; `NEEDS_ATTENTION` là có vi phạm hoặc verdict không phù hợp. Nếu có cả hai, vẫn có câu hỏi và ưu tiên `NEEDS_ATTENTION`.
- `requirements` gồm `requirementId`, `category`, `priority`, `status`, `recommendedAction`, `remainingQuantity`, `assignedItemIds`, `warnings`, `questions`. Trạng thái và hành động giữ nguyên theo backend. Danh sách này bao gồm cả các danh mục mở rộng **nếu có yêu cầu tương ứng**; không phải mặc định chuyến nào cũng yêu cầu lều, gậy hay đồ mưa.
- `contextQuestions` là phần bổ sung giai đoạn 2: `{ available, items }`. Mỗi item có `itemId`, `nameAtEvaluation`, `category` và `questions`; mỗi câu hỏi thêm `requirementId` và `constraintIds`. Backend chỉ xét món đã chọn, yêu cầu cùng danh mục còn `remainingQuantity > 0`, và thuộc tính của constraint còn null/thiếu trong snapshot. `0` và `false` là giá trị đã biết. Câu hỏi này chỉ cho biết còn thiếu dữ liệu, không bảo đảm món đồ sẽ phù hợp sau khi trả lời; các rule core và kết quả coverage vẫn cần được đọc riêng. Nếu snapshot cũ không có dữ liệu cần thiết, `available` là `false`. Có thể xuất hiện câu hỏi trùng với `items.questions`, frontend nên gộp hiển thị theo item và field nếu cần.
- Câu hỏi trong `requirements` thuộc yêu cầu, không chỉ ra món nào gây thiếu dữ liệu. Không tự gán câu hỏi cho `assignedItemIds`; chỉ cập nhật một món khi người dùng đã chọn rõ món đó và trường hợp lệ cho danh mục của nó.
- Câu hỏi có `field`, `question`, `valueType` (`number`, `boolean`, `enum` hoặc `unknown`), `allowUnknown`; có thể có `unit`, `min`, `max`, `isInteger`, `options`. `unknown` hoặc trường `attributes` là hướng dẫn chung, không phải ô có thể PATCH trực tiếp. Các metadata là giới hạn hợp lệ của dữ liệu nhập, không phải giá trị đề xuất hay kết luận phù hợp.
- Nếu chọn “Không biết”, không tự điền `false`, `0` hoặc một ngưỡng suy đoán. Để nguyên giá trị chưa biết; `null` trong PATCH có nghĩa xóa giá trị đã có. Không chuyển câu trả lời “có chống mưa” thành số `waterproof_mm`.

Ví dụ câu hỏi thiếu độ bám giày:

```json
{
  "field": "grip_level",
  "question": "Độ bám của đế giày là mức mấy (1–5)?",
  "valueType": "number",
  "min": 1,
  "max": 5,
  "isInteger": true,
  "allowUnknown": true
}
```

Ví dụ cập nhật một món giày đã được người dùng chọn, với phiên bản đọc từ API:

```json
{
  "expectedVersion": 2,
  "attributes": { "grip_level": 4 }
}
```

## Ảnh, link và thuê

- `GET /gear/capabilities` cho biết tiện ích nào được bật/đã cấu hình. `POST /gear/extractions` tạo bản nháp từ ảnh/link; người dùng kiểm tra và gọi `POST /gear/extractions/{draftId}/confirm` trước khi lưu. `extractionFieldProvenance` mô tả từng thuộc tính trong bản nháp là `FOUND`/`MISSING`; `null` khi bản nháp không xác định danh mục hoặc khi xác nhận đổi danh mục. Chỉ dấu này mô tả nội dung trích xuất, không xác minh nguồn hay tính đúng đắn của giá trị người dùng chỉnh sửa. Nếu không đọc được có thể nhận `manualEntry.required`; hãy cho nhập tay. Ảnh cần media asset hợp lệ đã hoàn tất upload. AI trích xuất là gợi ý, không phải xác minh thực tế.
- Nếu muốn thuê đồ còn thiếu, backend hiện có `POST /gear/plans/{id}/options`, `POST /gear/plans/{id}/advice`, `POST /gear/plans/{id}/quote-intents`, sau đó gửi `prefillRentalQuote` sang `POST /rentals/quote`. Phương án/ý định báo giá chưa tạo đơn hoặc giữ hàng. Xem mô tả request/response trong Swagger.
- Đọc lỗi theo `response.data.error`; các trường version cần lấy từ phản hồi thực tế, không cố định theo ví dụ. Màn hình và bộ UI dùng chuẩn chung của dự án Frontend.

## Giai đoạn 2: trạng thái chuẩn bị theo kế hoạch

- `GET /gear/plans/{planId}/preparation-selections` trả `{ planId, choices, version, updatedAt }`; khi chưa có bản lưu, `choices: []`, `version: 0`, `updatedAt: null`.
- `PUT` cùng đường dẫn dùng `{ "expectedVersion": 0, "choices": [{ "category": "JACKET", "status": "HAVE" }] }`; lần sau lấy version mới. Status gồm `HAVE`, `NOT_HAVE`, `CHECK_LATER`, tối đa một lựa chọn cho mỗi danh mục trong tám danh mục. `choices` thay thế toàn bộ danh sách đã lưu. Xung đột trả `GEAR_PROGRESS_CAS_CONFLICT` (409), cần tải lại.
- Đây là khai báo người dùng, độc lập với `selectedItemIds`, `inputRevision` và checklist đóng gói. `HAVE` không tự chọn món, không đánh giá phù hợp và không đánh dấu đã đóng gói. Nếu người dùng thực sự chọn món, vẫn cập nhật `selectedItemIds` qua API kế hoạch.

## Giai đoạn 2: danh mục sản phẩm cá nhân

- `STAFF_INVENTORY` hoặc `ADMIN` tạo hồ sơ bằng `POST /staff/gear/personal-catalog`: `{ name, brand?, category, attributes, evidence }`. Mỗi thuộc tính có giá trị phải có `evidence` cùng key, giá trị là mô tả nguồn do nhân viên nhập. `GET /staff/gear/personal-catalog/drafts` liệt kê tối đa 50 bản chờ duyệt; `PUT /staff/gear/personal-catalog/{id}` cập nhật toàn bộ bản nháp với `expectedVersion`.
- `ADMIN` công bố bằng `POST /admin/gear/personal-catalog/{id}/verify` với `{ expectedVersion }`. Khi phát hiện sai, `POST /admin/gear/personal-catalog/{id}/revoke` với phiên bản hiện tại ngừng công bố; hồ sơ đã duyệt không chỉnh sửa trực tiếp. Trạng thái là `DRAFT`, `VERIFIED` hoặc `REVOKED`. Bản nháp/thu hồi không xuất hiện ở tìm kiếm công khai.
- `GET /gear/personal-catalog?q=...&category=...&limit=20&cursor=...` tìm sản phẩm đã duyệt theo tên/thương hiệu; phản hồi `{ items, nextCursor }`, mặc định 20, tối đa 50. Khi đổi bộ lọc hãy bắt đầu lại không dùng cursor cũ.
- `GET /gear/personal-catalog/{id}` trả hồ sơ đã công bố; với hồ sơ bị thu hồi chỉ trả `{ id, state: "REVOKED", revokedAt }`. Bản nháp và ID không tồn tại trả 404.
- `POST /gear/personal-catalog/{id}/items` với `{ condition: "good", acknowledgeDuplicate?: false }` tạo bản sao trong tủ đồ, có giới hạn 50 món và cảnh báo trùng như tạo tay. Danh mục không đồng nhất với sản phẩm cho thuê và không tạo đơn thuê. Kiểm duyệt là xác nhận của nhân viên dựa trên nguồn ghi nhận, không đảm bảo tình trạng thực tế của món người dùng sở hữu.

## Giai đoạn 2: nguồn của từng thông số

- Món đồ trả thêm `attributeProvenance`, một object keyed theo tên thuộc tính. `source` có thể là `USER`, `AI_IMAGE`, `AI_LINK`, `VERIFIED_CATALOG`; với AI/catalog có `referenceId` tương ứng. Món dữ liệu cũ có thể trả `null`: không suy ra nguồn. Trường chưa có giá trị không có provenance.
- Khi xác nhận bản nháp, giá trị trùng với kết quả trích xuất cùng danh mục được ghi nguồn AI; giá trị người dùng thay đổi hoặc tự thêm được ghi `USER`. Đây là dấu vết so khớp theo dữ liệu, không phải xác minh sự thật và không thể biết người dùng có tự nhập lại một giá trị giống hệt hay không.
- Với PATCH, các thuộc tính được gửi có giá trị được ghi lại nguồn `USER`, trường null xóa provenance; các trường không gửi giữ nguồn cũ. Khi đổi danh mục, nguồn cũ bị xóa. Bản sao từ catalog ghi `VERIFIED_CATALOG` và ID hồ sơ; nếu catalog sau đó bị thu hồi, bản sao trong tủ đồ không tự sửa. Frontend nên xem thông tin catalog theo ID trước khi diễn giải trạng thái nguồn hiện tại.
- Hệ thống không backfill provenance cho dữ liệu cũ. Đây là thay đổi additive sau hai migration `20261031110000_gear_advisor_phase2` và `20261031110100_gear_catalog_revocation`.
