import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { AppError } from 'src/shared/errors/app-error';
import { DELIVERY_ERROR_CODES as DL } from 'src/shared/errors/codes/delivery.error-codes';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { AssignRentalTaskUseCase } from '../../application/use-cases/assign-rental-task.use-case';
import { ListAdminRentalTasksUseCase } from '../../application/use-cases/list-admin-rental-tasks.use-case';
import { ListRentalAssigneesUseCase } from '../../application/use-cases/list-rental-assignees.use-case';
import {
  AssignRentalTaskBodySchema,
  ListAdminRentalTasksQuerySchema,
  ListRentalAssigneesQuerySchema,
  DeliveryIdempotencyKeySchema,
  DeliveryTaskIdParamSchema,
  type AssignRentalTaskBodyDto,
  type ListAdminRentalTasksQueryDto,
  type ListRentalAssigneesQueryDto,
  type DeliveryTaskIdParamDto,
} from '../dtos/delivery.dto';

@ApiTags('Admin Rental Tasks')
@ApiBearerAuth('bearer')
@Controller()
@Auth([AuthType.Bearer])
export class RentalTaskAdminController {
  constructor(
    private readonly assignTaskUseCase: AssignRentalTaskUseCase,
    private readonly listAdminTasksUseCase: ListAdminRentalTasksUseCase,
    private readonly listAssigneesUseCase: ListRentalAssigneesUseCase,
  ) {}

  @Post('admin/rental-tasks/:id/assign')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-408 — Admin gán task chuẩn bị/giao hàng cho nhân viên',
    description:
      'Admin gán (hoặc chuyển gán) task chuẩn bị tại inventory location hoặc task giao nhận cho nhân viên cụ thể. ' +
      'Lưu ý: API này KHÔNG di chuyển custody, chỉ thay đổi người phụ trách task. ' +
      'Loại task: PREPARATION (chuẩn bị thiết bị), OUTBOUND (giao đi), RETURN (nhận trả).',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID task cần gán', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng', example: 'assign-20261005-abc123' })
  @ApiBody({
    description: 'Thông tin gán task cho nhân viên',
    schema: {
      type: 'object',
      required: ['taskType', 'assigneeId', 'reason', 'expectedVersion'],
      properties: {
        taskType: { type: 'string', enum: ['PREPARATION', 'WAREHOUSE', 'OUTBOUND', 'RETURN'], description: 'Loại task', example: 'OUTBOUND' },
        assigneeId: { type: 'string', format: 'uuid', description: 'UUID nhân viên được gán', example: '770e8400-e29b-41d4-a716-446655440003' },
        reason: { type: 'string', minLength: 3, maxLength: 1000, description: 'Lý do gán/chuyển gán', example: 'Nhân viên A bận, chuyển cho nhân viên B' },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản task hiện tại', example: 1 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task đã được gán thành công cho nhân viên' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  @ApiResponse({ status: 404, description: 'Task hoặc nhân viên không tồn tại' })
  async assign(
    @Param(new ZodValidationPipe(DeliveryTaskIdParamSchema)) params: DeliveryTaskIdParamDto,
    @Body(new ZodValidationPipe(AssignRentalTaskBodySchema)) body: AssignRentalTaskBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.assignTaskUseCase.execute({
      actorUserId,
      taskId: params.id,
      taskType: body.taskType,
      assigneeId: body.assigneeId,
      reason: body.reason,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requireDeliveryIdempotencyKey(rawKey),
    });
  }

  @Get('admin/rental-tasks')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'RB-API-411 — Danh sách task toàn bộ hệ thống (Admin)',
    description:
      'Admin xem toàn bộ task chuẩn bị (inventory location) và giao hàng trong hệ thống. ' +
      'Hỗ trợ lọc theo loại (PREPARATION/OUTBOUND/RETURN), ngày, và trạng thái gán (UNASSIGNED/ASSIGNED/ME).',
  })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Loại task', enum: ['PREPARATION', 'WAREHOUSE', 'OUTBOUND', 'RETURN'] })
  @ApiQuery({ name: 'date', required: false, type: String, description: 'Ngày lọc (YYYY-MM-DD)', example: '2026-10-05' })
  @ApiQuery({ name: 'assignment', required: false, type: String, description: 'Trạng thái gán', enum: ['UNASSIGNED', 'ASSIGNED', 'ME'] })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Trang hiện tại (mặc định 1)', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Số item mỗi trang (mặc định 20)', example: 20 })
  @ApiResponse({ status: 200, description: 'Danh sách task và thông tin phân trang' })
  async listAdmin(
    @Query(new ZodValidationPipe(ListAdminRentalTasksQuerySchema)) query: ListAdminRentalTasksQueryDto,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.listAdminTasksUseCase.execute({ actorUserId, ...query });
  }

  @Get('staff/rental-assignees')
  @Roles(UserRole.STAFF_INVENTORY, UserRole.STAFF_DELIVERY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'RB-API-412 — Danh sách nhân viên có thể nhận task',
    description:
      'Trả về danh sách nhân viên đang hoạt động có thể nhận task, ' +
      'lọc theo vai trò (STAFF_INVENTORY hoặc STAFF_DELIVERY). ' +
      'Dùng để hiển thị dropdown khi Admin gán task hoặc nhân viên chuẩn bị kho chọn người nhận package.',
  })
  @ApiQuery({ name: 'role', required: true, type: String, description: 'Vai trò nhân viên', enum: ['STAFF_INVENTORY', 'STAFF_DELIVERY'] })
  @ApiQuery({ name: 'taskId', required: false, type: String, description: 'UUID task (để lọc nhân viên phù hợp)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Trang hiện tại (mặc định 1)', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Số item mỗi trang (mặc định 20)', example: 20 })
  @ApiResponse({ status: 200, description: 'Danh sách nhân viên khả dụng' })
  async assignees(
    @Query(new ZodValidationPipe(ListRentalAssigneesQuerySchema)) query: ListRentalAssigneesQueryDto,
    @ActiveUser('id') actorUserId: string,
    @ActiveUser('role') actorRole: string,
  ) {
    return this.listAssigneesUseCase.execute({ actorUserId, actorRole, ...query });
  }
}

function requireDeliveryIdempotencyKey(raw: string | undefined): string {
  const parsed = DeliveryIdempotencyKeySchema.safeParse(raw);
  if (!parsed.success) throw AppError.fromCode(DL.IDEMPOTENCY_KEY_REQUIRED);
  return parsed.data;
}
