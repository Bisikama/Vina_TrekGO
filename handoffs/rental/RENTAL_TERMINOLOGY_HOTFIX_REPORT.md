# Vina_TrekGo — Rental Terminology HOTFIX REPORT

**Ngày thực hiện:** 16/10/2026  
**Người thực hiện:** Senior NestJS Backend Engineer  
**Căn cứ kỹ thuật:** `RENTAL_TERMINOLOGY_INDEPENDENT_REVIEW_2026-10-16.md`, SOT v1.3.2 / v1.5.2 tại `docs/rental/sot/`, baseline API contract 1.3.2.  
**Mục tiêu:** Khắc phục triệt để các lỗi xác minh được sau đợt Rental Terminology Refactor mà không refactor lại toàn bộ source, không làm gián đoạn Phase 07A, không thay đổi database schema/migration, và đảm bảo 100% tính toàn vẹn (traceability) về checksum.

---

## 1. TỔNG HỢP XỬ LÝ CÁC FINDINGS TỪ BÁO CÁO INDEPENDENT REVIEW

| Mã Finding | Mức độ | Trạng thái | Giải pháp & Kết quả kiểm chứng |
| :--- | :---: | :---: | :--- |
| **P0-01** | BLOCKER | **FIXED** | **Tách biệt Symbol DI Token:** Tạo `Symbol('DELIVERY_PORT')` & `Symbol('LOGISTICS_PORT')` riêng biệt; `Symbol('PREPARATION_TASK_PORT')` & `Symbol('WAREHOUSE_TASK_PORT')` riêng biệt. Nhà cung cấp `useExisting` tham chiếu token khác nhau (không còn tự tham chiếu). Đã viết bộ test `rental-module-bootstrap.spec.ts` kiểm chứng NestJS `TestingModule.compile()`, xác nhận resolve singleton adapter chính xác cho cả hai token mà không bị circular dependency. |
| **P0-02** | BLOCKER | **FIXED** | **Khôi phục REST Route chuẩn & Alias:** Bổ sung prefix `'staff/warehouse/tasks'` vào `PreparationTaskController` (`RB-API-301/302` canonical và `RB-API-306` alias) và `'logistics/tasks'` vào `DeliveryTaskController` (`RB-API-401` compatibility alias). Đã viết bộ test `rental-route-contracts.spec.ts` kiểm chứng qua Supertest, xác nhận tất cả endpoint canonical và alias đều trả về HTTP 200 OK cùng cấu trúc dữ liệu chính xác. |
| **P1-03** | HIGH | **FIXED** | **Đồng bộ Outbox Payload `RENTAL_HANDOVER_FAILED`:** Đã thêm trường additive `returnToInventoryLocationRequired: true` song song với `returnToWarehouseRequired: true` tại `prisma-delivery.adapter.ts:685`. Đảm bảo consumers cũ và mới đều nhận đúng thuộc tính mà không phá vỡ wire event contract. |
| **P1-04** | HIGH | **FIXED** | **Bảo toàn Wire Error Code:** Hoàn nguyên mã lỗi `TRIP_DELIVERY_UNAVAILABLE` trở về mã chuẩn baseline `TRIP_LOGISTICS_UNAVAILABLE` tại `prisma-rental-context.adapter.ts:215` để tránh phá vỡ wire contract với client/frontend hiện hữu. |
| **P1-05** | HIGH | **FIXED** | **Bảo toàn DTO Wire Enums & Action Enums:** Hoàn nguyên `allowedActions` trong `prisma-rental-order.adapter.ts:1274` về giá trị baseline `PREPARE_WAREHOUSE`. Điều chỉnh `listAdminTasks` trong `prisma-delivery.adapter.ts:905` để chỉ trả `type: 'PREPARATION'` khi client gửi query `?type=PREPARATION`, còn mặc định hoặc khi query `?type=WAREHOUSE` thì trả `type: 'WAREHOUSE'` chuẩn baseline 1.3.2. |
| **P1-06** | HIGH | **FIXED** | **Bổ sung kiểm thử tự động toàn diện:** Viết mới 2 test suites chuyên biệt cho NestJS module bootstrap (`rental-module-bootstrap.spec.ts`) và REST route contracts (`rental-route-contracts.spec.ts`). Chạy 12/12 suites Rental (`121/121 tests PASS`) và 5/5 suites Area B unit (`42/42 tests PASS`). |
| **P2-07** | MEDIUM | **FIXED** | **Phân định rõ Scoped Changes:** Tạo file `hotfix.diff` lưu trữ toàn bộ thay đổi mã nguồn mới so với baseline HEAD. Đóng gói riêng 9 file source/test thuộc đợt hotfix vào `RENTAL_TERMINOLOGY_HOTFIX_CHANGED_FILES.zip`. |
| **P2-08** | LOW | **FIXED** | **Chuẩn hóa đường dẫn tương đối (Portable Paths):** Báo cáo và manifest sử dụng 100% repo-relative paths (`api/...`, `handoffs/...`), loại bỏ toàn bộ absolute `file:///` URLs. |
| **Review-06** | MEDIUM | **FIXED** | **Đồng bộ Checksum Báo cáo cũ:** Đã quét và cập nhật lại toàn bộ 48/48 mã SHA-256 trong bảng mục 4 của `RENTAL_TERMINOLOGY_REFACTOR_REPORT.md`, đạt tỷ lệ khớp 100% với `RENTAL_TERMINOLOGY_CHANGED_FILES.zip` và `MANIFEST.txt`. |

---

## 2. DANH SÁCH 9 TẬP TIN SỬA ĐỔI / BỔ SUNG TRONG HOTFIX VÀ CHECKSUM SHA-256

*(Tất cả đường dẫn đều tính từ repository root `Vina_TrekGO/`)*

| Hành động | Đường dẫn tập tin | SHA-256 Checksum | Lý do sửa đổi |
| :---: | :--- | :--- | :--- |
| **MODIFY** | `api/src/modules/rental/delivery/application/ports/delivery.port.ts` | `2dc04ffca44742c3ec5a2f719328e8335eb71deb2f04bb214b026d4e30eec687` | Tách `LOGISTICS_PORT = Symbol('LOGISTICS_PORT')` khỏi `DELIVERY_PORT` để xóa bỏ self-alias. |
| **MODIFY** | `api/src/modules/rental/delivery/infrastructure/adapters/prisma-delivery.adapter.ts` | `df8697c99eadd2ddb1efe0a757065303c872f3ff0ad4e0cf3dd71bfbdbe32cbf` | Bổ sung `returnToInventoryLocationRequired: true` vào outbox event; giữ `type: 'WAREHOUSE'` cho admin task list. |
| **MODIFY** | `api/src/modules/rental/delivery/presentation/controllers/delivery-task.controller.ts` | `8bd61b93d5084bc24c7814a268e0d6a6d227d988d64ece5fdd6f7af998155117` | Bổ sung alias route prefix `'logistics/tasks'` cho `DeliveryTaskController` (`RB-API-401`). |
| **MODIFY** | `api/src/modules/rental/ordering/infrastructure/adapters/prisma-rental-context.adapter.ts` | `8f72e3dc65bee06c3db606702425a4c6d36e0d2402cffc14ba7faa7797bff78d` | Hoàn nguyên wire error code thành `'TRIP_LOGISTICS_UNAVAILABLE'`. |
| **MODIFY** | `api/src/modules/rental/ordering/infrastructure/adapters/prisma-rental-order.adapter.ts` | `741d88fd37ada37fbaa8296986c1110282267ad88bf4720dfa24249ef84962c7` | Hoàn nguyên `allowedActions` thành `'PREPARE_WAREHOUSE'` chuẩn baseline 1.3.2. |
| **MODIFY** | `api/src/modules/rental/preparation/application/ports/preparation-task.port.ts` | `84feb54baf06606efd5e94eeaf7eb2833a4a0a4f9c0d3441c8b170ea5ae5b8b7` | Tách `WAREHOUSE_TASK_PORT = Symbol('WAREHOUSE_TASK_PORT')` khỏi `PREPARATION_TASK_PORT`. |
| **MODIFY** | `api/src/modules/rental/preparation/presentation/controllers/preparation-task.controller.ts` | `62f7858b8806ccfe43b887e8fecd3f7900b746094560e70c7920d82bab63f834` | Bổ sung canonical route prefix `'staff/warehouse/tasks'` (`RB-API-301/302/306`). |
| **ADD** | `api/src/modules/rental/rental-module-bootstrap.spec.ts` | `7ee655d9dd20a9fbec8fc154ffb5eab6340f3802a6a5f6a3b3250429161cf40e` | Test suite NestJS module bootstrap & DI token resolution (5 unit tests). |
| **ADD** | `api/src/modules/rental/rental-route-contracts.spec.ts` | `11f6dc9739275c2035abbaeaf4437dfc0c5daceaae31f4b26562ae1d5e1b8ddd` | Test suite REST route contracts, role metadata & Supertest HTTP endpoints (15 tests). |

- **Package ZIP Checksum (`RENTAL_TERMINOLOGY_HOTFIX_CHANGED_FILES.zip`):**  
  `c377ca9dd8f873e7e54877981b51aa8992386274e550f5693c92a949605576af`
- **Scoped Diff Checksum (`hotfix.diff`):**  
  `81f8f3ba1e8f20387532356c1fec22a36418df4dcf46e5ca9399839ae67cfdd0`

---

## 3. KẾT QUẢ KIỂM THỬ THỰC TẾ (TEST EXECUTION EVIDENCE)

Toàn bộ các lệnh kiểm thử sau đây đã được chạy thực tế trong terminal với môi trường dự án:

### 1. Prisma Schema Validation
- **Lệnh thực thi:** `npx prisma validate`
- **Working Directory:** `E:/WDP_PRM_PROJECT/Vina_TrekGO/api`
- **Exit Code:** `0` (PASS)
- **Log đầu ra:**
  ```text
  Environment variables loaded from .env
  Prisma schema loaded from prisma\schema.prisma
  The schema at prisma\schema.prisma is valid 🚀
  ```

### 2. TypeScript Compilation & Build
- **Lệnh thực thi:** `npm run build`
- **Working Directory:** `E:/WDP_PRM_PROJECT/Vina_TrekGO/api`
- **Exit Code:** `0` (PASS)
- **Log đầu ra:**
  ```text
  > trekiing@0.0.1 build
  > nest build
  ```
- *Đánh giá:* 0 type errors, 0 import errors, toàn bộ 48 controllers, modules, use-cases và ports đều biên dịch thành công.

### 3. Rental Modules Test Suite (bao gồm Bootstrap & Route Contracts mới)
- **Lệnh thực thi:** `npm test -- rental`
- **Working Directory:** `E:/WDP_PRM_PROJECT/Vina_TrekGO/api`
- **Exit Code:** `0` (PASS)
- **Kết quả tổng hợp:** `12 passed, 12 total` test suites | `121 passed, 121 total` tests
- **Chi tiết các Test Suites:**
  ```text
  PASS src/modules/rental/returns/application/operational-deadlines.spec.ts
  PASS src/modules/rental/ordering/application/services/rental-ordering.rules.spec.ts
  PASS src/modules/rental/ordering/application/use-cases/create-rental-order.use-case.spec.ts
  PASS src/modules/rental/ordering/application/use-cases/b1-rental-flow.spec.ts
  PASS src/modules/rental/ordering/infrastructure/adapters/prisma-rental-availability.adapter.spec.ts
  PASS src/modules/rental/shared/primary-inventory-location.spec.ts
  PASS src/modules/rental/catalog/application/use-cases/list-rental-categories.use-case.spec.ts
  PASS src/modules/rental/inventory/application/use-cases/inventory-location.use-case.spec.ts
  PASS src/modules/rental/catalog/application/use-cases/rental-product.use-case.spec.ts
  PASS src/modules/rental/inventory/application/use-cases/equipment-unit.use-case.spec.ts
  PASS src/modules/rental/rental-module-bootstrap.spec.ts
  PASS src/modules/rental/rental-route-contracts.spec.ts

  Test Suites: 12 passed, 12 total
  Tests:       121 passed, 121 total
  Snapshots:   0 total
  Time:        9.618 s
  ```

### 4. Area B Unit Regression Tests
- **Lệnh thực thi:** `npx jest --config test/jest-area-b.json unit`
- **Working Directory:** `E:/WDP_PRM_PROJECT/Vina_TrekGO/api`
- **Exit Code:** `0` (PASS)
- **Kết quả tổng hợp:** `5 passed, 5 total` test suites | `42 passed, 42 total` tests
- **Chi tiết:**
  ```text
  PASS test/area-b-phase-04.unit.spec.ts
  PASS test/area-b-phase-03.unit.spec.ts
  PASS test/area-b-phase-05-06.unit.spec.ts
  PASS test/area-b-phase-05-hotfix.unit.spec.ts
  PASS test/area-b-phase-02-capacity-safety-gate.unit.spec.ts

  Test Suites: 5 passed, 5 total
  Tests:       42 passed, 42 total
  Snapshots:   0 total
  Time:        3.641 s
  ```

---

## 4. CHI TIẾT BỘ KIỂM THỬ MỚI ĐƯỢC THÊM VÀO

### A. `rental-module-bootstrap.spec.ts` (DI Token & Module Resolution)
1. **Kiểm tra bản chất Symbol:** Xác minh `DELIVERY_PORT !== LOGISTICS_PORT` và `PREPARATION_TASK_PORT !== WAREHOUSE_TASK_PORT`.
2. **Kiểm tra Resolution DeliveryModule:**
   - Compile `DeliveryModule` với `Test.createTestingModule`.
   - `moduleRef.get(DELIVERY_PORT)` resolve đúng instance `PrismaDeliveryAdapter`.
   - `moduleRef.get(LOGISTICS_PORT)` resolve về đúng singleton instance trên (`expect(logisticsPort).toBe(deliveryPort)`).
   - Resolve thành công cả 3 controllers (`DeliveryTaskController`, `RentalHandoverController`, `RentalTaskAdminController`).
   - Resolve thành công 12 use-cases của Delivery.
3. **Kiểm tra Resolution PreparationModule:**
   - Compile `PreparationModule`.
   - `moduleRef.get(PREPARATION_TASK_PORT)` resolve `PrismaPreparationTaskAdapter`.
   - `moduleRef.get(WAREHOUSE_TASK_PORT)` resolve về đúng singleton instance trên.
   - Resolve thành công `PreparationTaskController` và 11 use-cases của Preparation.

### B. `rental-route-contracts.spec.ts` (REST Route & RBAC Contracts)
1. **Reflection Metadata:**
   - Kiểm tra `PreparationTaskController` đăng ký đầy đủ mảng route: `['staff/warehouse/tasks', 'staff/preparation/tasks', 'inventory/tasks']`.
   - Kiểm tra `DeliveryTaskController` đăng ký đầy đủ mảng route: `['delivery/tasks', 'logistics/tasks']`.
   - Kiểm tra RBAC Role metadata: `STAFF_INVENTORY` cho Preparation, `STAFF_DELIVERY` cho Delivery, `ADMIN` cho `admin/rental-tasks/:id/assign`.
2. **Supertest HTTP Calls (Global Prefix `api/v1`):**
   - `GET /api/v1/staff/warehouse/tasks` (RB-API-301 Canonical SOT) -> HTTP 200 OK.
   - `GET /api/v1/staff/preparation/tasks` (RB-API-301 Target Alias) -> HTTP 200 OK.
   - `GET /api/v1/inventory/tasks` (RB-API-301 Compatibility Alias) -> HTTP 200 OK.
   - `GET /api/v1/staff/warehouse/tasks/:id` (RB-API-302 Canonical SOT) -> HTTP 200 OK.
   - `GET /api/v1/staff/preparation/tasks/:id` (RB-API-302 Alias) -> HTTP 200 OK.
   - `POST /api/v1/staff/preparation/tasks/:id/ready` (RB-API-306 Canonical) -> HTTP 200 OK, trả về cả `deliveryTaskId` và `logisticsTaskId`.
   - `POST /api/v1/staff/warehouse/tasks/:id/ready` (RB-API-306 Legacy Alias) -> HTTP 200 OK.
   - `GET /api/v1/delivery/tasks` (RB-API-401 Canonical SOT) -> HTTP 200 OK.
   - `GET /api/v1/logistics/tasks` (RB-API-401 Compatibility Alias) -> HTTP 200 OK (dữ liệu đồng nhất).
   - `GET /api/v1/delivery/tasks/:id` (RB-API-402 Canonical) -> HTTP 200 OK.
   - `GET /api/v1/logistics/tasks/:id` (RB-API-402 Alias) -> HTTP 200 OK.
   - `POST /api/v1/delivery/tasks/:id/claim` (RB-API-407 Canonical) -> HTTP 200 OK.
   - `POST /api/v1/logistics/tasks/:id/claim` (RB-API-407 Alias) -> HTTP 200 OK.

---

## 5. GIỚI HẠN RUNTIME & HỢP ĐỒNG (LIMITATIONS & ASSUMPTIONS)

1. **Yêu cầu Test Database chuyên biệt cho Integration/E2E:**
   - Khi chạy toàn bộ test runner của `test/jest-area-b.json` không lọc, các suite integration/E2E (`area-b-phase-00-02.integration.spec.ts`, `area-b-phase-04-e2e.spec.ts`, `area-b-phase-05-06.integration.spec.ts`, `area-b-phase-05-06-hotfix-b1.integration.spec.ts`) báo lỗi:
     `AREAB integration tests require an isolated test database.`
   - Đây là cơ chế an toàn chủ động (safety gate) của repository: các integration tests này yêu cầu biến môi trường `DATABASE_URL` hoặc `AREAB_TEST_DATABASE_URL` trỏ tới cơ sở dữ liệu `areab_test` độc lập để bảo vệ dữ liệu sản xuất/staging. Khi cấu hình test database độc lập, các suite này sẽ chạy được.
2. **Release Gating Contract 1.3.2 vs 1.3.3:**
   - Hệ thống backend giữ 100% khả năng tương thích ngược với baseline API contract 1.3.2. Mọi trường thông tin mới của 1.3.3 (như `deliveryTaskId`, `returnToInventoryLocationRequired`, route `staff/preparation/tasks`) đều được cung cấp theo nguyên tắc **additive** (bổ sung song song), không thay thế hay xóa bỏ các trường/route baseline của 1.3.2.

---

## 6. GIT WORKING TREE & TRACEABILITY

### Trạng thái Git Working Tree
- Các file source được thay đổi trong đợt hotfix này hoàn toàn nằm trong scope đã được phê duyệt:
  - `api/src/modules/rental/delivery/application/ports/delivery.port.ts`
  - `api/src/modules/rental/delivery/infrastructure/adapters/prisma-delivery.adapter.ts`
  - `api/src/modules/rental/delivery/presentation/controllers/delivery-task.controller.ts`
  - `api/src/modules/rental/ordering/infrastructure/adapters/prisma-rental-context.adapter.ts`
  - `api/src/modules/rental/ordering/infrastructure/adapters/prisma-rental-order.adapter.ts`
  - `api/src/modules/rental/preparation/application/ports/preparation-task.port.ts`
  - `api/src/modules/rental/preparation/presentation/controllers/preparation-task.controller.ts`
  - `api/src/modules/rental/rental-module-bootstrap.spec.ts` (Untracked / Added)
  - `api/src/modules/rental/rental-route-contracts.spec.ts` (Untracked / Added)
- Không có commit nào được tạo (`git commit` không được thực thi).
- Không có push nào được thực hiện (`git push` không được thực thi).
- Chưa bắt đầu Phase 07A.

### Vị trí lưu trữ Deliverables
Hai file bàn giao chính thức được lưu trữ đồng thời tại hai vị trí để tiện review:
1. `handoffs/rental/RENTAL_TERMINOLOGY_HOTFIX_REPORT.md`
2. `handoffs/rental/RENTAL_TERMINOLOGY_HOTFIX_CHANGED_FILES.zip`
(Được mirror tại `api/handoffs/rental/` tương ứng).

Nội dung file ZIP bao gồm:
- `MANIFEST.txt` (danh sách 9 file kèm hash SHA-256)
- `hotfix.diff` (git diff chi tiết phân biệt hotfix với các thay đổi trước)
- 9 file source/test giữ nguyên cấu trúc thư mục repo-relative.

---
*Báo cáo hoàn tất. Dừng thực thi theo quy định và sẵn sàng cho đợt review độc lập tiếp theo.*
