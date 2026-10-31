import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { ApiErrorResponses } from 'src/shared/swagger/api-error-response.helper';
import { CancelRentalOrderSystemFaultUseCase } from '../../application/use-cases/cancel-rental-order-system-fault.use-case';
import { SYSTEM_FAULT_REASON_CODES } from '../../application/ports/rental-system-fault-cancellation.port';
import { Prisma, RentalFinancialStatus, RentalOrderExceptionStatus, RentalOrderStatus } from '@prisma/client';
import { UserRole } from 'src/shared/constants/enum.constant';
import { AuthType } from 'src/shared/constants/auth.constant';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { PrismaService } from 'src/shared/services/prisma.service';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_ORDERING_ERROR_CODES } from 'src/shared/errors/codes/rental-ordering.error-codes';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { ApiErrorResponse } from 'src/shared/swagger/api-error-response.helper';
import {
  AdminIdempotencyKeySchema,
  AdminRentalOrderIdParamSchema,
  ListAdminRentalOrdersQuerySchema,
  SystemFaultCancellationBodySchema,
  type AdminRentalOrderIdParamDto,
  type ListAdminRentalOrdersQueryDto,
  type SystemFaultCancellationBodyDto,
} from '../dtos/admin-rental-order.dto';

@ApiTags('Admin Rental Orders - Quản trị đơn thuê')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles(UserRole.ADMIN, UserRole.STAFF_INVENTORY, UserRole.STAFF_DELIVERY)
@Controller('admin/rental-orders')
export class AdminRentalOrderController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cancelSystemFaultUseCase: CancelRentalOrderSystemFaultUseCase,
  ) {}

  @Post(':orderId/system-fault-cancellation')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Team Extension — ADMIN huỷ đơn do lỗi TrekGo trước bàn giao (hoàn 100%)',
    description: `
**Team Extension (ngoài contract 1.3.2/1.3.3)** — chỉ ADMIN.
Dùng khi TrekGo không giao được đơn đã thanh toán, ví dụ hạ hạng làm thiếu hàng (\`GRADE_DOWNGRADE_CAPACITY_SHORTAGE\`) và không tìm được món đúng hạng.
- Chỉ đơn PAID / PREPARING / READY_FOR_HANDOVER, chưa bàn giao, \`financialStatus = PAID\`.
- Hoàn 100% tiền thuê + tiền cọc về nguồn thanh toán gốc, giải phóng reservation, thu hồi pickup code.
- Unit đã pick/đóng gói còn ở kho chính được trả về AVAILABLE; unit khác được trả trong \`unsafeUnits\` và đơn giữ \`ACTION_REQUIRED\`.
- Kiện đã giao cho nhân viên giao hàng → 409 \`CANCELLATION_REQUIRES_CUSTODY_RETURN\` (đưa về kho trước).
- Đơn đã gia hạn (nhiều hoá đơn) → 409 \`PAYMENT_RECONCILIATION_REQUIRED\`.
- Khách nhận thông báo huỷ qua RENTAL_ORDER_CANCELLED.
- Retry cùng body với cùng Idempotency-Key trả lại kết quả cũ.
`,
  })
  @ApiParam({ name: 'orderId', type: String, format: 'uuid', description: 'UUID đơn thuê thiết bị' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng (8–200 ký tự)', example: 'sysfault-20261031-abc123' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['reasonCode', 'note', 'expectedVersion'],
      properties: {
        reasonCode: { type: 'string', enum: [...SYSTEM_FAULT_REASON_CODES] },
        note: { type: 'string', minLength: 3, maxLength: 2000, description: 'Ghi chú nội bộ' },
        expectedVersion: { type: 'integer', minimum: 1, description: 'version hiện tại của đơn' },
      },
      example: {
        reasonCode: 'GRADE_DOWNGRADE_CAPACITY_SHORTAGE',
        note: 'Không còn lều hạng Rất mới cho khoảng thuê này',
        expectedVersion: 4,
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Đơn đã huỷ, yêu cầu hoàn tiền đã tạo',
    schema: {
      type: 'object',
      properties: {
        order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            status: { type: 'string', example: 'CANCELLED' },
            financialStatus: { type: 'string', example: 'REFUND_PENDING' },
            exceptionStatus: { type: 'string' },
            cancelledAt: { type: 'string', format: 'date-time' },
            version: { type: 'integer' },
          },
        },
        refund: {
          type: 'object',
          properties: {
            refundRef: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            feeRefund: { type: 'number' },
            depositRefund: { type: 'number' },
            status: { type: 'string' },
          },
        },
        releasedUnitIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        unsafeUnits: {
          type: 'array',
          items: { type: 'object', properties: { unitId: { type: 'string' }, reason: { type: 'string' } } },
        },
      },
    },
  })
  @ApiErrorResponse(400, 'Thiếu Idempotency-Key', 'IDEMPOTENCY_KEY_REQUIRED', 'Gửi header Idempotency-Key 8–200 ký tự')
  @ApiErrorResponse(404, 'Không tìm thấy đơn thuê', 'RENTAL_ORDER_NOT_FOUND', 'Đơn thuê không tồn tại')
  @ApiErrorResponses(409, 'Không huỷ được lúc này', [
    { name: 'notAllowed', summary: 'Đơn không ở trạng thái huỷ system-fault được', code: 'RENTAL_SYSTEM_FAULT_CANCELLATION_NOT_ALLOWED', message: 'Chỉ đơn PAID/PREPARING/READY_FOR_HANDOVER chưa bàn giao' },
    { name: 'custody', summary: 'Kiện đang ở chỗ nhân viên giao', code: 'CANCELLATION_REQUIRES_CUSTODY_RETURN', message: 'Đưa kiện về kho trước' },
    { name: 'payment', summary: 'Cần đối soát thanh toán', code: 'PAYMENT_RECONCILIATION_REQUIRED', message: 'details.reason cho biết lý do (đơn gia hạn, nguồn thanh toán chưa xác thực...)' },
    { name: 'trip', summary: 'Trip đã huỷ', code: 'TRIP_CANCELLATION_PROCESSING', message: 'Luồng huỷ Trip sẽ xử lý đơn' },
    { name: 'version', summary: 'Xung đột phiên bản', code: 'VERSION_CONFLICT', message: 'Tải lại đơn rồi thử lại' },
    { name: 'keyReused', summary: 'Idempotency-Key dùng lại với body khác', code: 'IDEMPOTENCY_KEY_REUSED', message: 'Dùng khoá mới' },
  ])
  async cancelSystemFault(
    @Param(new ZodValidationPipe(AdminRentalOrderIdParamSchema)) params: AdminRentalOrderIdParamDto,
    @Body(new ZodValidationPipe(SystemFaultCancellationBodySchema)) body: SystemFaultCancellationBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    const key = AdminIdempotencyKeySchema.safeParse(rawKey);
    if (!key.success) throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED);
    return this.cancelSystemFaultUseCase.execute({
      orderId: params.orderId,
      actorUserId,
      idempotencyKey: key.data,
      ...body,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Team Extension — Danh sách đơn thuê thiết bị cho quản trị / vận hành',
    description: `
**Team Extension (ngoài contract 1.3.2/1.3.3)**
Hỗ trợ quản trị viên (Admin) và nhân viên vận hành (Staff) tra cứu danh sách đơn thuê thiết bị để phục vụ kiểm tra, xử lý sự cố hoặc gọi các bước tiếp theo trong quy trình trả hàng/quyết toán (ví dụ: RB-API-606).
Hỗ trợ lọc linh hoạt theo \`tripId\`, \`userId\`, \`status\`, \`financialStatus\`, \`exceptionStatus\` và phân trang.
`,
  })
  @ApiQuery({ name: 'tripId', required: false, type: String, format: 'uuid', description: 'Lọc theo UUID chuyến đi' })
  @ApiQuery({ name: 'userId', required: false, type: String, format: 'uuid', description: 'Lọc theo UUID người thuê' })
  @ApiQuery({ name: 'status', required: false, enum: RentalOrderStatus, description: 'Lọc theo trạng thái vòng đời đơn thuê' })
  @ApiQuery({ name: 'financialStatus', required: false, enum: RentalFinancialStatus, description: 'Lọc theo trạng thái tài chính / cọc' })
  @ApiQuery({ name: 'exceptionStatus', required: false, enum: RentalOrderExceptionStatus, description: 'Lọc theo trạng thái sự cố ngoại lệ' })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1, default: 1, example: 1, description: 'Trang hiện tại' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, minimum: 1, maximum: 100, default: 20, example: 20, description: 'Kích thước trang' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách đơn thuê kèm phân trang',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              quoteId: { type: 'string', format: 'uuid' },
              userId: { type: 'string', format: 'uuid' },
              tripId: { type: 'string', format: 'uuid' },
              bookingId: { type: 'string', format: 'uuid', nullable: true },
              status: { type: 'string' },
              financialStatus: { type: 'string' },
              exceptionStatus: { type: 'string' },
              rentalFee: { type: 'number' },
              totalDeposit: { type: 'number' },
              totalAmount: { type: 'number' },
              currency: { type: 'string' },
              rentalStartAt: { type: 'string', format: 'date-time' },
              rentalEndAt: { type: 'string', format: 'date-time' },
              paymentExpiresAt: { type: 'string', format: 'date-time' },
              paidAt: { type: 'string', format: 'date-time', nullable: true },
              cancelledAt: { type: 'string', format: 'date-time', nullable: true },
              completedAt: { type: 'string', format: 'date-time', nullable: true },
              version: { type: 'integer' },
              createdAt: { type: 'string', format: 'date-time' },
              linesCount: { type: 'integer' },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
            totalItems: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
  })
  async listOrders(@Query(new ZodValidationPipe(ListAdminRentalOrdersQuerySchema)) query: ListAdminRentalOrdersQueryDto) {
    const where: Prisma.RentalOrderWhereInput = {
      ...(query.tripId ? { tripId: query.tripId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.financialStatus ? { financialStatus: query.financialStatus } : {}),
      ...(query.exceptionStatus ? { exceptionStatus: query.exceptionStatus } : {}),
    };

    const [totalItems, orders] = await Promise.all([
      this.prisma.rentalOrder.count({ where }),
      this.prisma.rentalOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          rentalOrderLinesViaOrderId: {
            select: { id: true },
          },
        },
      }),
    ]);

    return {
      items: orders.map((o) => ({
        id: o.id,
        quoteId: o.quoteId,
        userId: o.userId,
        tripId: o.tripId,
        bookingId: o.bookingId,
        status: o.status,
        financialStatus: o.financialStatus,
        exceptionStatus: o.exceptionStatus,
        rentalFee: Number(o.rentalFee),
        totalDeposit: Number(o.totalDeposit),
        totalAmount: Number(o.totalAmount),
        currency: o.currency,
        rentalStartAt: o.rentalStartAt.toISOString(),
        rentalEndAt: o.rentalEndAt.toISOString(),
        paymentExpiresAt: o.paymentExpiresAt.toISOString(),
        paidAt: o.paidAt?.toISOString() ?? null,
        cancelledAt: o.cancelledAt?.toISOString() ?? null,
        completedAt: o.completedAt?.toISOString() ?? null,
        version: o.version,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
        linesCount: o.rentalOrderLinesViaOrderId.length,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize) || 1,
      },
    };
  }

  @Get(':orderId')
  @ApiOperation({
    summary: 'Team Extension — Xem chi tiết 1 đơn thuê thiết bị cho quản trị / vận hành',
    description: `
**Team Extension (ngoài contract 1.3.2/1.3.3)**
Trả về chi tiết toàn diện của đơn thuê thiết bị:
- Thông tin đơn thuê (order core & order lines & unit assignments)
- Thông tin kiện hàng (packages & package items)
- Các tác vụ vận hành (tasks: chuẩn bị kho, giao hàng, bàn giao, kiểm tra trả hàng)
- Tổng hợp tài chính (financial summary: phí thuê, tiền cọc, hóa đơn thanh toán, quyết toán cọc và hoàn tiền).
`,
  })
  @ApiParam({ name: 'orderId', type: String, format: 'uuid', description: 'UUID đơn thuê thiết bị', example: '550e8400-e29b-41d4-a716-446655440103' })
  @ApiResponse({ status: 200, description: 'Chi tiết đơn thuê gồm order + packages + tasks + financial summary' })
  @ApiErrorResponse(404, 'Không tìm thấy đơn thuê', 'RENTAL_ORDER_NOT_FOUND', 'Đơn thuê không tồn tại')
  async getOrderDetail(@Param(new ZodValidationPipe(AdminRentalOrderIdParamSchema)) params: AdminRentalOrderIdParamDto) {
    const order = await this.prisma.rentalOrder.findUnique({
      where: { id: params.orderId },
      include: {
        rentalOrderLinesViaOrderId: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                usageGroup: true,
                dailyPrice: true,
                replacementValue: true,
              },
            },
            rentalQuantityReservationsViaOrderLineId: true,
            rentalUnitAssignmentsViaOrderLineId: {
              include: {
                equipmentUnit: {
                  select: { id: true, assetCode: true, status: true, condition: true },
                },
              },
            },
          },
        },
        packageViaOrderId: {
          include: {
            packageItemsViaPackageId: {
              include: {
                equipmentUnit: { select: { id: true, assetCode: true } },
              },
            },
          },
        },
        inventoryTaskViaOrderId: true,
        deliveryTasksViaOrderId: true,
        rentalHandoverViaOrderId: true,
        returnInspectionsViaOrderId: {
          include: {
            findingsViaInspectionId: true,
          },
        },
        depositSettlementViaOrderId: {
          include: {
            depositSettlementItemsViaSettlementId: {
              include: {
                refundViaDepositSettlementItemId: true,
              },
            },
          },
        },
        invoicesViaRentalOrderId: {
          include: {
            paymentsViaInvoiceId: true,
          },
        },
        refundsViaRentalOrderId: true,
        pickupPoint: { select: { id: true, name: true, address: true } },
        returnPoint: { select: { id: true, name: true, address: true } },
        rentalPolicy: { select: { id: true, policyCode: true, versionNo: true } },
        user: { select: { id: true, email: true, fullName: true, phone: true } },
      },
    });

    if (!order) {
      throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.RENTAL_ORDER_NOT_FOUND, {
        details: { orderId: params.orderId },
      });
    }

    return {
      order: {
        id: order.id,
        quoteId: order.quoteId,
        userId: order.userId,
        tripId: order.tripId,
        bookingId: order.bookingId,
        status: order.status,
        financialStatus: order.financialStatus,
        exceptionStatus: order.exceptionStatus,
        rentalFee: Number(order.rentalFee),
        totalDeposit: Number(order.totalDeposit),
        totalAmount: Number(order.totalAmount),
        currency: order.currency,
        rentalStartAt: order.rentalStartAt.toISOString(),
        rentalEndAt: order.rentalEndAt.toISOString(),
        paymentExpiresAt: order.paymentExpiresAt.toISOString(),
        paidAt: order.paidAt?.toISOString() ?? null,
        cancelledAt: order.cancelledAt?.toISOString() ?? null,
        completedAt: order.completedAt?.toISOString() ?? null,
        version: order.version,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        customer: order.user,
        pickupPoint: order.pickupPoint,
        returnPoint: order.returnPoint,
        rentalPolicy: order.rentalPolicy,
        lines: order.rentalOrderLinesViaOrderId.map((line) => ({
          id: line.id,
          productId: line.productId,
          product: line.product,
          quantity: line.quantity,
          dailyPriceSnapshot: Number(line.dailyPriceSnapshot),
          depositPerUnitSnapshot: Number(line.depositPerUnitSnapshot),
          replacementValueSnapshot: Number(line.replacementValueSnapshot),
          lineRentalFee: Number(line.lineRentalFee),
          lineDeposit: Number(line.lineDeposit),
          reservations: line.rentalQuantityReservationsViaOrderLineId,
          assignedUnits: line.rentalUnitAssignmentsViaOrderLineId.map((a) => ({
            assignmentId: a.id,
            status: a.status,
            equipmentUnit: a.equipmentUnit,
          })),
        })),
      },
      packages: order.packageViaOrderId
        ? {
            id: order.packageViaOrderId.id,
            packageCode: order.packageViaOrderId.packageCode,
            status: order.packageViaOrderId.status,
            sealedAt: order.packageViaOrderId.sealedAt?.toISOString() ?? null,
            items: order.packageViaOrderId.packageItemsViaPackageId.map((item) => ({
              id: item.id,
              equipmentUnitId: item.equipmentUnitId,
              assetCode: item.equipmentUnit.assetCode,
            })),
          }
        : null,
      tasks: {
        inventoryTask: order.inventoryTaskViaOrderId
          ? {
              id: order.inventoryTaskViaOrderId.id,
              inventoryLocationId: order.inventoryTaskViaOrderId.inventoryLocationId,
              status: order.inventoryTaskViaOrderId.status,
              staffId: order.inventoryTaskViaOrderId.staffId,
              deadline: order.inventoryTaskViaOrderId.deadline?.toISOString() ?? null,
              startedAt: order.inventoryTaskViaOrderId.startedAt?.toISOString() ?? null,
              completedAt: order.inventoryTaskViaOrderId.completedAt?.toISOString() ?? null,
            }
          : null,
        deliveryTasks: order.deliveryTasksViaOrderId.map((task) => ({
          id: task.id,
          taskType: task.taskType,
          status: task.status,
          staffId: task.staffId,
          scheduledAt: task.scheduledAt?.toISOString() ?? null,
          handoverAt: task.handoverAt?.toISOString() ?? null,
          returnedAt: task.returnedAt?.toISOString() ?? null,
        })),
        handover: order.rentalHandoverViaOrderId
          ? {
              id: order.rentalHandoverViaOrderId.id,
              staffId: order.rentalHandoverViaOrderId.staffId,
              verificationRef: order.rentalHandoverViaOrderId.verificationRef,
              recipientNotes: order.rentalHandoverViaOrderId.recipientNotes,
              handedOverAt: order.rentalHandoverViaOrderId.handedOverAt.toISOString(),
            }
          : null,
        returnInspections: order.returnInspectionsViaOrderId.map((insp) => ({
          id: insp.id,
          stage: insp.stage,
          outcome: insp.outcome,
          inspectorId: insp.inspectorId,
          notes: insp.notes,
          findings: insp.findingsViaInspectionId,
          createdAt: insp.createdAt.toISOString(),
        })),
      },
      financialSummary: {
        rentalFee: Number(order.rentalFee),
        totalDeposit: Number(order.totalDeposit),
        totalAmount: Number(order.totalAmount),
        currency: order.currency,
        financialStatus: order.financialStatus,
        invoices: order.invoicesViaRentalOrderId.map((inv) => ({
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          status: inv.status,
          totalAmount: Number(inv.totalAmount),
          payments: inv.paymentsViaInvoiceId.map((p) => ({
            id: p.id,
            transactionRef: p.transactionRef,
            amount: Number(p.amount),
            currency: p.currency,
            status: p.status,
            paymentGateway: p.paymentGateway,
          })),
        })),
        depositSettlement: order.depositSettlementViaOrderId
          ? {
              id: order.depositSettlementViaOrderId.id,
              status: order.depositSettlementViaOrderId.status,
              totalDeposit: Number(order.depositSettlementViaOrderId.totalDeposit),
              totalDeduction: Number(order.depositSettlementViaOrderId.totalDeduction),
              refundAmount: Number(order.depositSettlementViaOrderId.refundAmount),
              items: order.depositSettlementViaOrderId.depositSettlementItemsViaSettlementId.map((item) => ({
                id: item.id,
                depositAmount: Number(item.depositAmount),
                deductionAmount: Number(item.deductionAmount),
                refundAmount: Number(item.refundAmount),
                status: item.status,
                outcome: item.outcome,
                refund: item.refundViaDepositSettlementItemId,
              })),
            }
          : null,
        refunds: order.refundsViaRentalOrderId.map((ref) => ({
          id: ref.id,
          amount: Number(ref.amount),
          currency: ref.currency,
          status: ref.status,
          refundTransactionRef: ref.refundTransactionRef,
        })),
      },
    };
  }
}
