# NAMING MIGRATION MATRIX — VINA_TREKGO AREA B

Theo yêu cầu chuẩn hóa tên, các thuật ngữ `warehouse` và `logistics` cần được chuyển sang các thuật ngữ cụ thể hơn theo từng ngữ cảnh nghiệp vụ. Bảng dưới đây liệt kê các thuật ngữ hiện hành có vấn đề và phương án đổi tên (sẽ được thực hiện trong tương lai, KHÔNG thực hiện ở Đợt 0).

## Ma trận đổi tên (Dự kiến)

| Tên hiện tại (Hoặc tên hỗn hợp) | Tên chuẩn mới (Mục tiêu) | Ngữ cảnh sử dụng | Hành động tương lai |
|---|---|---|---|
| `warehouse.error-codes.ts` | Phân tách vào `inventory`, `preparation`, `inventoryLocation` tùy loại lỗi | Chứa các error codes hỗn hợp liên quan đến kho. | Map các mã lỗi vào đúng module chuẩn. |
| `logistics.error-codes.ts` | Phân tách vào `delivery`, `returns` | Chứa các error codes liên quan đến giao nhận. | Map vào `delivery` và `returns` error codes. |
| (Nếu có) `WarehouseLocation` | `InventoryLocation` | Nơi vật lý lưu trữ đồ thuê. | (Đã đúng trong DB: `InventoryLocation`). |
| (Nếu có) `WarehouseTask` | `InventoryTask` | Nhiệm vụ liên quan đến kho bãi. | (Đã đúng trong DB: `InventoryTask`). |
| Nhiệm vụ chọn/đóng gói (Pick/Pack) | `preparation` | Các operations chuẩn bị đơn hàng (pick, condition, pack, ready). | Cập nhật tên service, controller, URL. |
| Quản lý tổng kho | `inventory` | Quản lý `EquipmentUnit` và tồn kho (Capacity, Stock). | Giữ nguyên hoặc gom nhóm đúng về `inventory`. |
| Nghiệp vụ Giao, Nhận, Custody | `delivery` | Giao đồ (handover), thu hồi, chuyển giao custody. | (Đã đúng trong DB: `DeliveryTask`, `CustodyEvent`). |
| Nghiệp vụ trả đồ & kiểm tra | `returns` | Kiểm tra trả hàng (inspection), xử lý unit hỏng hóc. | (Đã đúng trong DB: `ReturnInspection`). |

## Các model Prisma HIỆN HÀNH (Được giữ nguyên)
Những model sau đây ĐÃ khớp với nghiệp vụ và KHÔNG CẦN thay đổi tên:
- `InventoryLocation`
- `EquipmentUnit`
- `InventoryTask`
- `DeliveryTask`
- `CustodyEvent`
- `ReturnInspection`
- `RentalOrder`
- `RentalOrderLine`

**Lưu ý:**
- Không tự đổi tên bảng cơ sở dữ liệu (`@@map`) hoặc public API nếu Frontend đã bắt đầu sử dụng. Việc đổi tên API cần phối hợp qua Swagger / Frontend Integration Team.
- Ở các đợt refactor sau, khi thực hiện đổi tên các file lỗi như `warehouse.error-codes.ts`, cần cập nhật cả phần sử dụng trong service và controller tương ứng.
