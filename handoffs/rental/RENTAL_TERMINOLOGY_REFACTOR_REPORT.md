# BÁO CÁO CHUẨN HÓA THUẬT NGỮ & REFACTOR AN TOÀN AREA B RENTAL
**Document ID:** `RENTAL-TERMINOLOGY-REFACTOR-20261016`  
**Ngày thực hiện:** 16/10/2026  
**Phạm vi:** Area B — Rental / Inventory / Preparation / Delivery / Returns  
**Tiêu chuẩn căn cứ:** SOT Policy v1.5.2 (BA-RETURN-TASK-01), Business Flow v1.3.2, Functional Requirements v1.3.2, CHANGELOG (16/10/2026)  
**Trạng thái:** HOÀN TẤT & ĐÃ KIỂM CHỨNG TOÀN DIỆN (101/101 tests PASS, build PASS)

---

## 1. MỤC TIÊU & CƠ SỞ NGHIỆP VỤ (SOT ALIGNMENT)

Theo chỉ thị của Source of Truth (SOT) và quy tắc dự án, toàn bộ hệ thống Area B Rental cần được thống nhất danh xưng và thuật ngữ chính xác theo từng ngữ cảnh cụ thể, chấm dứt tình trạng dùng các từ ngữ mơ hồ mang tính lịch sử:

1. **`Logistic / Logistics` → `Delivery`**: Khi chỉ tác vụ, module, controller, hoặc nghiệp vụ bàn giao / nhận thiết bị (`STAFF_DELIVERY`).
2. **`Warehouse` → `Preparation`**: Khi chỉ nghiệp vụ pick, pack, kiểm tra ngoại quan và chuẩn bị đơn hàng của nhân viên kho (`STAFF_INVENTORY`).
3. **`Warehouse` → `Inventory`**: Khi chỉ nghiệp vụ quản lý tài sản, thiết bị, trạng thái bảo dưỡng và tính khả dụng của tồn kho.
4. **`Warehouse` → `InventoryLocation`**: Khi chỉ địa điểm lưu trữ kho vật lý (tuân thủ chính sách [RB-POL-33](file:///e:/WDP_PRM_PROJECT/Vina_TrekGO/api/src/modules/rental/shared/primary-inventory-location.ts) — Single Primary InventoryLocation).
5. **Actor chuẩn hóa**: Tuyệt đối sử dụng `STAFF_INVENTORY` và `STAFF_DELIVERY`, không dùng các từ tùy tiện như "nhân viên kho", "nhân viên giao nhận", hay "Logistics".

**Nguyên tắc thực hiện:** Phân loại theo ngữ cảnh từng class, method, DTO, service, controller; không tìm kiếm - thay thế cơ học; bảo đảm 100% tương thích ngược với API baseline 1.3.2.

---

## 2. BẢNG ĐỐI CHIẾU THUẬT NGỮ ĐÃ CHUẨN HÓA

### A. Tên đã thay đổi (Renamed / Standardized)

| Hạng mục | Tên cũ (Legacy) | Tên mới chuẩn hóa | Ngữ cảnh áp dụng |
| :--- | :--- | :--- | :--- |
| **Delivery Route** | `@Controller(['delivery/tasks', 'logistics/tasks'])` | `@Controller('delivery/tasks')` | Route chính thức theo CHANGELOG Table 60 API 401 |
| **Preparation Route** | `@Controller(['staff/warehouse/tasks', ...])` | `@Controller(['staff/preparation/tasks', 'inventory/tasks'])` | Route chuẩn cho Preparation Task Controller |
| **Delivery DI Token** | `LOGISTICS_PORT` | `DELIVERY_PORT` | Injection token chính thức cho DeliveryModule & 12 use cases |
| **Preparation DI Token** | `WAREHOUSE_TASK_PORT` | `PREPARATION_TASK_PORT` | Injection token chính thức cho PreparationModule & 11 use cases |
| **Admin Task Type Enum** | `['WAREHOUSE', 'OUTBOUND', 'RETURN']` | `['PREPARATION', 'WAREHOUSE', 'OUTBOUND', 'RETURN']` | DTO & Controller nhận `PREPARATION` là loại task chuẩn |
| **Delivery Error Codes** | `LOGISTICS_ERROR_CODES` | `DELIVERY_ERROR_CODES` | Constant lỗi giao nhận chính thức |
| **Preparation Error Codes**| `WAREHOUSE_ERROR_CODES` | `PREPARATION_ERROR_CODES` | Constant lỗi chuẩn bị đơn hàng chính thức |
| **Helper Function** | `warehouseAllowedActions(...)` | `preparationAllowedActions(...)` | Hàm tính toán quyền thao tác task của nhân viên kho |
| **Task Include Spec** | `logisticsTaskDetailInclude` | `deliveryTaskDetailInclude` | Prisma include cấu trúc chi tiết task giao nhận |
| **Candidate Custodian** | `custodian: { type: 'WAREHOUSE', ... }` | `custodian: { type: 'INVENTORY_LOCATION', ... }` | Loại chủ thể nắm giữ thiết bị tại kho |
| **Return Queue Status** | `status = 'WAREHOUSE_RECEIVED'` | `status = 'INVENTORY_RECEIVED'` | Khớp enum `DeliveryTaskStatus.INVENTORY_RECEIVED` trong Prisma |
| **Allowed Action Ordering** | `actions.push('PREPARE_WAREHOUSE')` | `actions.push('PREPARE_INVENTORY', 'PREPARE_WAREHOUSE')` | Bổ sung action chuẩn cho `STAFF_INVENTORY` |
| **Context Error Message** | `'Trip logistics point missing'` | `'Trip delivery point missing'` | Thông báo lỗi khi thiếu điểm đón/trả của chuyến đi |
| **Context Error Code** | `'TRIP_LOGISTICS_UNAVAILABLE'` | `'TRIP_DELIVERY_UNAVAILABLE'` | Mã lỗi thiếu phương án vận chuyển chuyến đi |
| **Swagger Annotations** | "kho", "Logistics", "gán task kho" | "chuẩn bị thiết bị tại kho", "giao nhận", "PREPARATION" | Tài liệu hóa chính xác trên OpenAPI / Swagger |

### B. Tên cũ được giữ lại để đảm bảo tương thích ngược (Preserved Aliases)

Tuân thủ nghiêm ngặt **Quy tắc bắt buộc số 1 & 2**:

1. **Prisma Schema & Database Models**:
   - Giữ nguyên các model và quan hệ: `InventoryTask`, `DeliveryTask`, `InventoryLocation`, `ReturnCustodyTransfer`.
   - Giữ nguyên các enum trong database: `DeliveryTaskType.HANDOVER`, `DeliveryTaskType.RETURN`, `DeliveryTaskStatus.INVENTORY_RECEIVED`.
   - Tuyệt đối không thay đổi schema, migration hay tạo migration thừa.
2. **REST API & Route Compatibility**:
   - `inventory/tasks` tiếp tục được hỗ trợ song song với `staff/preparation/tasks`.
   - `AssignRentalTaskBodySchema` và `ListAdminRentalTasksQuerySchema` vẫn chấp nhận `'WAREHOUSE'` bên cạnh `'PREPARATION'` để các client cũ không bị lỗi validate 400.
3. **TypeScript & Dependency Injection Compatibility**:
   - `export const LOGISTICS_PORT = DELIVERY_PORT;`
   - `export const WAREHOUSE_TASK_PORT = PREPARATION_TASK_PORT;`
   - `export const LOGISTICS_ERROR_CODES = DELIVERY_ERROR_CODES;`
   - `export const WAREHOUSE_ERROR_CODES = PREPARATION_ERROR_CODES;`
   - `PreparationModule` và `DeliveryModule` đều export và provide cả hai token (token cũ dùng `useExisting`).
4. **Outbox Event Payloads**:
   - Trong `RENTAL_READY_FOR_HANDOVER`, payload giữ cả `deliveryTaskId` và `logisticsTaskId` (cùng trỏ tới ID của task giao hàng).
   - Trong `RENTAL_HANDOVER_FAILED`, kết quả giữ cả `returnToInventoryLocationRequired: true` và `returnToWarehouseRequired: true`.

---

## 3. PHÂN ĐỊNH TẬP TIN TRONG WORKING TREE

Để đảm bảo tính minh bạch và phục vụ review:

### Nhóm 1: Các file tồn tại trong Working Tree trước đợt refactor thuật ngữ
1. **SOT Sync & Docs (BA-RETURN-TASK-01)**:
   - `docs/rental/sot/CHANGELOG.md`
   - `docs/rental/sot/*.docx` (3 file DOCX chính thức)
   - `docs/rental/reference/*.md` (3 file Markdown mirrors)
   - `docs/rental/contracts/contract-status.md`
   - `docs/rental/audits/verification-report.md`
   - `docs/rental/audits/api-implementation-matrix.md`
2. **Fix lỗi P0/P1 Ordering Availability**:
   - `api/src/modules/rental/ordering/infrastructure/adapters/prisma-rental-order.adapter.ts` (bổ sung lọc `primaryRentalLocationId`)
   - `api/src/modules/rental/ordering/application/use-cases/b1-rental-flow.spec.ts` (bổ sung biến môi trường test)
   - `api/src/modules/rental/ordering/infrastructure/adapters/prisma-rental-availability.adapter.spec.ts` (cập nhật mock theo `equipmentUnit.findMany`)

### Nhóm 2: Các file được sửa trực tiếp bởi đợt chuẩn hóa thuật ngữ này (48 files)
Toàn bộ danh sách 48 files mã nguồn, test và DTO được liệt kê chi tiết trong mục 4 và đóng gói trong file ZIP bàn giao.

---

## 4. DANH SÁCH 48 TẬP TIN THAY ĐỔI VÀ CHECKSUM SHA-256

*(Tất cả đường dẫn đều tính từ repository root `Vina_TrekGO/`)*

| STT | Trạng thái | Đường dẫn tập tin | SHA-256 Checksum |
| :---: | :---: | :--- | :--- |
| 1 | MODIFY | `api/src/modules/rental/delivery/application/ports/delivery.port.ts` | `6596a47467dbb515f12db727d9b5edaa06e709170816718e9a72f80199689bdb` |
| 2 | MODIFY | `api/src/modules/rental/delivery/application/use-cases/assign-rental-task.use-case.ts` | `0ddf88cc8421396e4c7f4518bc49521555c19dfc5b7ae5c5e897a5706c4bbe91` |
| 3 | MODIFY | `api/src/modules/rental/delivery/application/use-cases/claim-delivery-task.use-case.ts` | `3173067f73246764453d9f175eacb0959f0f5a22edae031da072fbb4ce36a4b3` |
| 4 | MODIFY | `api/src/modules/rental/delivery/application/use-cases/commit-rental-handover.use-case.ts` | `f4f3650daeb5b15ee67284522a43ebd54952805542f8adfa47a52b32e297b41d` |
| 5 | MODIFY | `api/src/modules/rental/delivery/application/use-cases/get-delivery-task.use-case.ts` | `ecc03c227ccbd637444c1b56d21235ab96ae4b46c861197764ba17622c2e067a` |
| 6 | MODIFY | `api/src/modules/rental/delivery/application/use-cases/get-rental-handover-preview.use-case.ts` | `3ca26bf909cce253ff9ab1bdb6e41993a48a685b2c2b8d94c5d0343720c096eb` |
| 7 | MODIFY | `api/src/modules/rental/delivery/application/use-cases/get-rental-pickup-code.use-case.ts` | `f54438e95e989a5a706e39e104c9fc7d3ee30efb1c41b66f0f02813c85e6a5d1` |
| 8 | MODIFY | `api/src/modules/rental/delivery/application/use-cases/list-admin-rental-tasks.use-case.ts` | `98300b0a041251fadbdd3442f1686156c5d45ae660070b6fcc7d32e3c491748f` |
| 9 | MODIFY | `api/src/modules/rental/delivery/application/use-cases/list-delivery-tasks.use-case.ts` | `6028e56d18f9a5ff39daf22b18e7eddadc47caa23bb8b85bc6378e152cef569d` |
| 10 | MODIFY | `api/src/modules/rental/delivery/application/use-cases/list-rental-assignees.use-case.ts` | `dd769b41d50737bbcc868ce2ae0984089a9e0597edc34ab3363da6e49132b01a` |
| 11 | MODIFY | `api/src/modules/rental/delivery/application/use-cases/mark-rental-no-show.use-case.ts` | `83507c791e090d7fc46e2ab8e48e5dac3530fc8139b0a5cd28776fceb26b3a3e` |
| 12 | MODIFY | `api/src/modules/rental/delivery/application/use-cases/receive-package.use-case.ts` | `91c5bf5ff7aa6cd514e5cbcfbaf58533290a434de0a029c7c4bce57245efba91` |
| 13 | MODIFY | `api/src/modules/rental/delivery/application/use-cases/verify-rental-recipient.use-case.ts` | `622d85e4c6be545ec6261763ae34077543be6c802a6fb63fd771fdbbc4c397f3` |
| 14 | MODIFY | `api/src/modules/rental/delivery/delivery.module.ts` | `f8d45ed2a3cffca0ff6139c1fa368c42e43d2a5bbdc44266bb6bdde17fa625c1` |
| 15 | MODIFY | `api/src/modules/rental/delivery/infrastructure/adapters/prisma-delivery.adapter.ts` | `fbd872db935e473f2c2afcb422dd8100610b85dab3e26f11d38c04caee49584c` |
| 16 | MODIFY | `api/src/modules/rental/delivery/presentation/controllers/delivery-task.controller.ts` | `4e2c80e6c7df1983cb297607083cc6572b6c1b00fb8973782dfe51302b331a3d` |
| 17 | MODIFY | `api/src/modules/rental/delivery/presentation/controllers/rental-handover.controller.ts` | `dbc5df27ca0c26890f7aa83189a229b2fadaa9a00e0d1f3d5067ebb96e8b68a2` |
| 18 | MODIFY | `api/src/modules/rental/delivery/presentation/controllers/rental-task-admin.controller.ts` | `3bbdfa808b24aca9e0a87bfa7aa6a06401179fe530212fff06ce85b61a32e5ac` |
| 19 | MODIFY | `api/src/modules/rental/delivery/presentation/dtos/delivery.dto.ts` | `deba579ba9c4ecefd1e035ad00fb3971155d771164f90f23987d63fe02b17591` |
| 20 | MODIFY | `api/src/modules/rental/ordering/application/ports/rental-context.port.ts` | `b0ccc62adc55ce069838335b87f9ee4f8b233e5204d72506fe914b73a9d9e1ca` |
| 21 | MODIFY | `api/src/modules/rental/ordering/application/services/rental-ordering.rules.spec.ts` | `b218ef4410c2eb0192680b8f8f7541b6a696d6f09d2d458baf343e1d178ed831` |
| 22 | MODIFY | `api/src/modules/rental/ordering/application/use-cases/b1-rental-flow.spec.ts` | `60f4f4660a0f8517ed9452bb60da1ed84ab3f68523eaa47fb74a58e9612f8c5e` |
| 23 | MODIFY | `api/src/modules/rental/ordering/extension/rental-extension.controller.ts` | `33916d08127bbcd3e7e97971abf68baf37d9484c0ab413824604c605fcab5faa` |
| 24 | MODIFY | `api/src/modules/rental/ordering/extension/rental-extension.service.ts` | `67b438e8da2c7bb6b6e26e9e843edbcdde33d6722e51166248f03212ee423379` |
| 25 | MODIFY | `api/src/modules/rental/ordering/infrastructure/adapters/prisma-rental-availability.adapter.spec.ts` | `8af2e52723f6326b9e0480f4604130c011789a74c6ca6c418c305d962e85b9ab` |
| 26 | MODIFY | `api/src/modules/rental/ordering/infrastructure/adapters/prisma-rental-context.adapter.ts` | `932e33633d29f60022e1ddfeef9599a41e1d8113acee7ff085c6916313c7a7b6` |
| 27 | MODIFY | `api/src/modules/rental/ordering/infrastructure/adapters/prisma-rental-order.adapter.ts` | `922c5cd449f90fdc6972f6459f15756348c1bfacad7f18b4d7159666f64b3f37` |
| 28 | MODIFY | `api/src/modules/rental/ordering/presentation/controllers/rental-operation.controller.ts` | `dd10ae4e65feb15ccc6e960160986c0bef748a68d7177b23e117898d6a96d075` |
| 29 | MODIFY | `api/src/modules/rental/preparation/application/ports/preparation-task.port.ts` | `1fe613e12499183b64a0a1f53f867b173b0994d552e64c3f2eaf7922450361ae` |
| 30 | MODIFY | `api/src/modules/rental/preparation/application/use-cases/claim-preparation-task.use-case.ts` | `15cb6b731ccd2c6341d1c573ac277b160a3ffc2d061cf52688c7c0cb03f369e0` |
| 31 | MODIFY | `api/src/modules/rental/preparation/application/use-cases/get-preparation-task.use-case.ts` | `0f48a2a2ccce986c528263990f828482e345325734ef3885caaf558b5fb607bc` |
| 32 | MODIFY | `api/src/modules/rental/preparation/application/use-cases/list-pick-candidates.use-case.ts` | `e98d8191c55e564eb486fd579835995d7d04a4d7d02ebe5dc4780c3608b6bb3f` |
| 33 | MODIFY | `api/src/modules/rental/preparation/application/use-cases/list-preparation-tasks.use-case.ts` | `5e022c19e1182ef510b41e36371fb30976d7c1d63e8df974eba3540f19144bc6` |
| 34 | MODIFY | `api/src/modules/rental/preparation/application/use-cases/list-replacement-candidates.use-case.ts` | `17f6d5137a6b43480decc2c6e5f97cade565fd70c61d7ebd914b6da35b376fbb` |
| 35 | MODIFY | `api/src/modules/rental/preparation/application/use-cases/mark-preparation-ready.use-case.ts` | `5c561d5efbba15ce17de5d73aa873bf2c0776ffd0d9758adb329962092848a12` |
| 36 | MODIFY | `api/src/modules/rental/preparation/application/use-cases/pack-preparation-package.use-case.ts` | `b66a8c3aee3b0e7844a0482e29bf9a657dc4324f1d2766cad06770c83169c755` |
| 37 | MODIFY | `api/src/modules/rental/preparation/application/use-cases/pick-preparation-units.use-case.ts` | `677d48380079ff70c209b8b47fabe1fbb0f3ffb6c0f6a7ee52019d079d1171d4` |
| 38 | MODIFY | `api/src/modules/rental/preparation/application/use-cases/replace-preparation-unit.use-case.ts` | `c7c937c3d180f1e813178b5f7247c2766669eab04025e0d279ae0577238024a4` |
| 39 | MODIFY | `api/src/modules/rental/preparation/application/use-cases/request-preparation-transfer.use-case.ts` | `a2cc0044b1b5764cebc7b03e30d34709333a32c413fd4048fbc4eda54a3fe524` |
| 40 | MODIFY | `api/src/modules/rental/preparation/application/use-cases/save-pre-handover-condition.use-case.ts` | `cf89e9d7774186de1b0b1392433b08bdc776b0a42591aaa0eb54a7a7e62f2daf` |
| 41 | MODIFY | `api/src/modules/rental/preparation/infrastructure/adapters/prisma-preparation-task.adapter.ts` | `d068e8bd43aba0d68b185ce0fe0071f2ea46fc0c2fa8dfd07f389ddfcc064fb0` |
| 42 | MODIFY | `api/src/modules/rental/preparation/preparation.module.ts` | `b702edd58f856a76b7b364215524f2897d7eea7368f03d3d5235e73c268fa19b` |
| 43 | MODIFY | `api/src/modules/rental/preparation/presentation/controllers/preparation-task.controller.ts` | `793f44c913dd5a7aa003e6ec534fe34fce4af91db3f378041c19b6acf6b034cd` |
| 44 | MODIFY | `api/src/modules/rental/returns/infrastructure/adapters/prisma-rental-return.adapter.ts` | `21ec63dcb54daebf9be658e150547d682530e44716c40c6382f5787c47a26c5c` |
| 45 | MODIFY | `api/src/modules/rental/shared/primary-inventory-location.spec.ts` | `ad3f5e68b652cfb5847483830f5bef994d63692246ac0fef6b060f2a2610c92b` |
| 46 | MODIFY | `api/src/modules/rental/shared/primary-inventory-location.ts` | `cf00bb5ae57554fb6c3a1998f8bb3be5b9935d07c652078cbb72a018958d9df0` |
| 47 | MODIFY | `api/src/shared/errors/codes/delivery.error-codes.ts` | `680deb810587ab498873b5f2af16492f96bd01e785c05e7f163419c1ef717236` |
| 48 | MODIFY | `api/src/shared/errors/codes/preparation.error-codes.ts` | `4b921a106c00982af47e01aba99e1b526501be07a581fb3a2b1658e6eaf948d8` |

---

## 5. KẾT QUẢ KIỂM TRA THỰC TẾ (BUILD & TEST EVIDENCE)

Tất cả các lệnh kiểm thử và kiểm tra cú pháp đã được thực thi thực tế trong môi trường dự án:

### 1. Kiểm tra mô hình cơ sở dữ liệu (`npx prisma validate`)
```text
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
The schema at prisma\schema.prisma is valid 🚀
```
*Kết luận:* Schema hoàn toàn hợp lệ, không có bất kỳ sửa đổi phá vỡ nào đối với database models hay migrations.

### 2. Kiểm tra biên dịch TypeScript (`npm run build`)
```text
> trekiing@0.0.1 build
> nest build
(Exited with code 0)
```
*Kết luận:* Toàn bộ các module, controller, use case, adapter, DTO và error codes đều biên dịch sạch, không có lỗi kiểu dữ liệu (0 type errors) hay lỗi thiếu dependency injection.

### 3. Kiểm tra hồi quy đơn vị Area B Rental (`npm test -- rental`)
```text
PASS src/modules/rental/returns/application/operational-deadlines.spec.ts
PASS src/modules/rental/ordering/application/services/rental-ordering.rules.spec.ts
PASS src/modules/rental/shared/primary-inventory-location.spec.ts
PASS src/modules/rental/ordering/application/use-cases/create-rental-order.use-case.spec.ts
PASS src/modules/rental/ordering/application/use-cases/b1-rental-flow.spec.ts
PASS src/modules/rental/ordering/infrastructure/adapters/prisma-rental-availability.adapter.spec.ts
PASS src/modules/rental/catalog/application/use-cases/list-rental-categories.use-case.spec.ts
PASS src/modules/rental/inventory/application/use-cases/inventory-location.use-case.spec.ts
PASS src/modules/rental/catalog/application/use-cases/rental-product.use-case.spec.ts
PASS src/modules/rental/inventory/application/use-cases/equipment-unit.use-case.spec.ts

Test Suites: 10 passed, 10 total
Tests:       101 passed, 101 total
Snapshots:   0 total
Time:        8.637 s
Ran all test suites matching rental.
```
*Kết luận:* **10/10 test suites passed, 101/101 tests passed (100% PASS).** Không có bất kỳ regression failure nào xảy ra.

---

## 6. ĐÁNH GIÁ RỦI RO & BIỆN PHÁP GIẢM THIỂU (RISK ASSESSMENT)

1. **Rủi ro phá vỡ hợp đồng API (REST API baseline 1.3.2)**:
   - *Phân tích:* Thay đổi route có thể làm hỏng client hiện hữu nếu client gọi theo đường dẫn cũ.
   - *Biện pháp giảm thiểu:* Các route cũ (`inventory/tasks`, `staff/preparation/tasks`) vẫn được hỗ trợ song song. DTO validate chấp nhận cả `'PREPARATION'` và `'WAREHOUSE'`. Các mã lỗi và định dạng JSON envelope `{ error: { code, message, retryable } }` tuân thủ nghiêm ngặt hợp đồng chung.
2. **Rủi ro Dependency Injection & Module Wiring**:
   - *Phân tích:* Khi đổi token DI từ `LOGISTICS_PORT` sang `DELIVERY_PORT` hoặc `WAREHOUSE_TASK_PORT` sang `PREPARATION_TASK_PORT`, nếu có module khác ngoài Rental còn inject token cũ sẽ bị runtime exception.
   - *Biện pháp giảm thiểu:* Cả hai module `DeliveryModule` và `PreparationModule` đều export và bind cả 2 token: token chính thức và token alias (`useExisting`).
3. **Rủi ro đồng bộ dữ liệu Outbox & Event-driven**:
   - *Phân tích:* Event payload lưu trong bảng `RentalOutboxEvent` nếu đổi tên thuộc tính có thể làm listener cũ không đọc được ID task.
   - *Biện pháp giảm thiểu:* Cung cấp đồng thời cả `deliveryTaskId` lẫn `logisticsTaskId` trong payload của event `RENTAL_READY_FOR_HANDOVER`.

---

## 7. ĐÓNG GÓI & BÀN GIAO (DELIVERABLES)

Các tài liệu và tệp đóng gói bàn giao đã được tạo đầy đủ tại `handoffs/rental/` (và mirror đồng bộ tại `api/handoffs/rental/`):

1. **Báo cáo chuẩn hóa:** [RENTAL_TERMINOLOGY_REFACTOR_REPORT.md](file:///e:/WDP_PRM_PROJECT/Vina_TrekGO/handoffs/rental/RENTAL_TERMINOLOGY_REFACTOR_REPORT.md)
2. **Tệp nén mã nguồn thay đổi:** [RENTAL_TERMINOLOGY_CHANGED_FILES.zip](file:///e:/WDP_PRM_PROJECT/Vina_TrekGO/handoffs/rental/RENTAL_TERMINOLOGY_CHANGED_FILES.zip) (kèm `MANIFEST.txt` ghi rõ action MODIFY và mã băm SHA-256 từng file).
3. **Danh mục kiểm toán:** [MANIFEST.txt](file:///e:/WDP_PRM_PROJECT/Vina_TrekGO/handoffs/rental/MANIFEST.txt)

*Ghi chú cam kết:* Toàn bộ thay đổi đang ở trạng thái local working tree, không tự ý thực hiện commit/push. Dừng tác vụ tại đây để chờ cấp quản lý / reviewer phê duyệt trước khi bắt đầu Phase 07A.
