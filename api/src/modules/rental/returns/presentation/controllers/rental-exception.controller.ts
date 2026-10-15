import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { ListRentalExceptionsUseCase } from '../../application/use-cases/list-rental-exceptions.use-case';
import { GetRentalExceptionUseCase } from '../../application/use-cases/get-rental-exception.use-case';
import { ExceptionIdParamSchema, ListExceptionsQuerySchema, type ExceptionIdParamDto, type ListExceptionsQueryDto } from '../dtos/rental-return.dto';

@ApiTags('Rental Exceptions')
@ApiBearerAuth('bearer')
@Controller('staff/rental-exceptions')
@Auth([AuthType.Bearer])
export class RentalExceptionController {
  constructor(private readonly listUseCase: ListRentalExceptionsUseCase, private readonly getUseCase: GetRentalExceptionUseCase) {}

  @Get()
  @Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'RB-API-612 — Danh sách ngoại lệ trả hàng',
    description:
      'Nhân viên nhà chứa hoặc Admin xem danh sách các ngoại lệ phát sinh trong quy trình trả hàng. ' +
      'Hỗ trợ lọc theo loại, trạng thái, và nhân viên được gán.',
  })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Loại ngoại lệ', example: 'DAMAGE_DEDUCTION' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Trạng thái ngoại lệ', example: 'OPEN' })
  @ApiQuery({ name: 'assignee', required: false, type: String, description: 'UUID nhân viên được gán xử lý' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Trang hiện tại (mặc định 1)', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Số item mỗi trang (mặc định 20)', example: 20 })
  @ApiResponse({ status: 200, description: 'Danh sách ngoại lệ và thông tin phân trang' })
  async list(@Query(new ZodValidationPipe(ListExceptionsQuerySchema)) query: ListExceptionsQueryDto, @ActiveUser('id') actorUserId: string, @ActiveUser('role') actorRole: string) {
    return this.listUseCase.execute({ actorUserId, actorRole, ...query });
  }

  @Get(':id')
  @Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'RB-API-615 — Chi tiết ngoại lệ, bằng chứng, và lịch sử xử lý',
    description:
      'Xem chi tiết một ngoại lệ trả hàng, bao gồm: loại ngoại lệ, thiết bị liên quan, ' +
      'ảnh/video minh chứng, phản hồi từ khách, và lịch sử quyết định của Admin.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID ngoại lệ', example: '990e8400-e29b-41d4-a716-446655440010' })
  @ApiResponse({ status: 200, description: 'Chi tiết ngoại lệ, bằng chứng, và lịch sử' })
  @ApiResponse({ status: 404, description: 'Ngoại lệ không tồn tại' })
  async detail(@Param(new ZodValidationPipe(ExceptionIdParamSchema)) params: ExceptionIdParamDto, @ActiveUser('id') actorUserId: string, @ActiveUser('role') actorRole: string) {
    return this.getUseCase.execute({ actorUserId, actorRole, exceptionId: params.id });
  }
}
