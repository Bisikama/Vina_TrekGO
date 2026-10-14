import { PrismaClient, RentalDayCountMode } from '@prisma/client';

export async function seedRentalPolicy(prisma: PrismaClient) {
  console.log('Seeding Rental Policy (SOT Policy v1.5.2)...');

  const policy = await prisma.rentalPolicy.upsert({
    where: {
      policyCode_versionNo: {
        // Mã chính sách & phiên bản duy nhất
        policyCode: 'DEFAULT',
        versionNo: 1,
      },
    },
    update: {
      isActive: true, // Trạng thái kích hoạt chính sách (true = đang hoạt động)
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'), // Thời điểm bắt đầu có hiệu lực
      effectiveTo: null, // Thời điểm hết hạn (null = không giới hạn thời gian)
      returnBufferMinutes: 1440, // 24 giờ (1440 phút) đệm sau khi trả thông thường
      cleaningBufferMinutes: 1440, // 24 giờ (1440 phút) vệ sinh và chuẩn bị trước khi cho thuê lại
      deepInspectionBufferMinutes: 2880, // 48 giờ (2880 phút) đệm kiểm tra sâu khi có sự cố/hư hại
      cutoffHoursBeforeTrip: 24, // Hạn chót tạo đơn thuê mới trước giờ khởi hành (ít nhất 24 giờ)
      freeCancellationHours: 24, // Hạn hủy đơn thuê được hoàn 100% tiền (trước giờ giao 24 giờ)
      quoteTtlMinutes: 10, // Thời hạn hiệu lực của báo giá thuê (10 phút)
      paymentHoldMinutes: 15, // Thời gian giữ số lượng thiết bị chờ thanh toán (15 phút)
      pickupCodeTtlMinutes: 15, // Thời hạn của mã nhận thiết bị một lần (Pickup Code: 15 phút)
      pickupVerificationTtlMinutes: 10, // Thời hạn của mã xác minh người nhận (verificationRef: 10 phút)
      returnInspectionSlaHours: 72, // SLA nhân viên kho phải hoàn thành kiểm tra FINAL mọi món nhận (tối đa 72 giờ)
      deepInspectionSlaHours: 24, // SLA hoàn tất kiểm tra sâu đối với thiết bị có vấn đề (24 giờ)
      returnToInventoryAllowanceHours: 8, // Thời gian tối đa vận chuyển thiết bị từ điểm trả về kho chính (8 giờ)
      postInspectionCleaningAllowanceHours: 8, // Thời gian vệ sinh hoàn tất sau khi kiểm tra đạt (8 giờ)
    },
    create: {
      // 1. Nhận diện & Tiền tệ
      policyCode: 'DEFAULT', // Mã định danh chính sách
      versionNo: 1, // Phiên bản chính sách số 1
      currency: 'VND', // Đơn vị tiền tệ (VND)
      dayCountMode: RentalDayCountMode.CEIL_24H, // Cơ chế tính ngày: làm tròn lên theo chu kỳ 24h, tối thiểu 1 ngày

      // 2. Thời hạn (TTL) đặt đơn & thanh toán
      quoteTtlMinutes: 10, // Báo giá giữ được 10 phút, quá 10 phút phải lấy báo giá mới
      paymentHoldMinutes: 15, // Sau khi tạo đơn, giữ số lượng thiết bị tối đa 15 phút để thanh toán
      freeCancellationHours: 24, // Hủy đơn trước giờ giao >= 24h được hoàn 100% tiền thuê + cọc
      cutoffHoursBeforeTrip: 24, // Hạn chót đặt đơn thuê mới: trước giờ khởi hành chuyến đi ít nhất 24h

      // 3. Thời gian đệm chiếm dụng thiết bị (Occupied Window Buffers)
      prepBufferMinutes: 0, // Thời gian kho soạn hàng trước chuyến đi
      returnBufferMinutes: 1440, // 24 giờ đệm sau khi trả hàng (chống trùng lịch cho đơn sau)
      cleaningBufferMinutes: 1440, // 24 giờ thời gian vệ sinh, bảo dưỡng thông thường
      deepInspectionBufferMinutes: 2880, // 48 giờ đệm kiểm tra sâu đối với các thiết bị nghi ngờ hư hỏng/thiếu phụ kiện

      // 4. Giao nhận (Handover & Pickup Code)
      pickupCodeTtlMinutes: 15, // Mã 6 số cấp cho khách xuất trình có hiệu lực 15 phút
      pickupVerificationTtlMinutes: 10, // Sau khi nhân viên giao hàng quét mã, phiên xác thực giữ trong 10 phút

      // 5. Thu hồi & SLA kiểm tra thiết bị (Hybrid Return v1.5.2)
      returnInspectionSlaHours: 72, // Nhân viên kho phải kiểm tra FINAL tất cả món nhận thực tế trong vòng <= 72 giờ
      deepInspectionSlaHours: 24, // Thời hạn cam kết xử lý kiểm tra sâu không quá 24 giờ
      returnToInventoryAllowanceHours: 8, // Nhân viên giao nhận phải đưa thiết bị trả về kho trong vòng 8 giờ
      postInspectionCleaningAllowanceHours: 8, // Hoàn tất vệ sinh trong 8 giờ sau khi kiểm tra PASS để chuyển READY/AVAILABLE

      // 6. Xử lý sự cố, gia hạn & khiếu nại
      overdueReviewMinutes: 120, // Sau 2 giờ quá hạn trả thiết bị sẽ kích hoạt cảnh báo quá hạn
      deepInspectionReviewMinutes: 2880, // 48 giờ tối đa cho quy trình rà soát sự cố phức tạp
      adminApprovalMinutes: 1440, // 24 giờ để Admin xem xét và phê duyệt khoản khấu trừ tiền cọc
      userAssessmentReviewMinutes: 2880, // 48 giờ cho khách hàng phản hồi biên bản đánh giá hư hại
      lostConfirmationMinutes: 4320, // 72 giờ trước khi xác nhận chính thức thiết bị bị mất hoàn toàn (LOST)
      maxRentalAfterTripHours: 72, // Khách chỉ được xin trả muộn tối đa 72 giờ (3 ngày) sau khi kết thúc tour
      extensionRequestCutoffMinutes: 120, // Phải gửi yêu cầu gia hạn trước giờ trả dự kiến ít nhất 2 giờ
      extensionHoldMinutes: 15, // Giữ chỗ tạm thời 15 phút trong khi thanh toán phí gia hạn bổ sung
      maxExtensionCount: 2, // Mỗi đơn hàng chỉ được phép xin gia hạn tối đa 2 lần
      maxTotalRentalDays: 14, // Tổng số ngày thuê cả đơn không được vượt quá 14 ngày

      // 7. Quy tắc hủy & Hiệu lực
      cancellationRules: [], // Quy tắc hủy chi tiết (nếu có bổ sung)
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'), // Có hiệu lực từ 2020 để các chuyến đi test luôn hợp lệ
      effectiveTo: null, // Không có ngày kết thúc (luôn áp dụng cho đến khi có version mới)
      isActive: true, // Đang được kích hoạt làm chính sách hiện hành
    },
  });

  console.log(`Rental Policy configured: ${policy.policyCode} (v${policy.versionNo})`);
}
