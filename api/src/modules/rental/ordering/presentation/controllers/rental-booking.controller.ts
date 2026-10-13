import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ApiErrorResponse } from 'src/shared/swagger/api-error-response.helper';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { GetRentalEligibilityUseCase } from '../../application/use-cases/get-rental-eligibility.use-case';
import { GetRentalRecommendationsUseCase } from '../../application/use-cases/get-rental-recommendations.use-case';
import {
  RentalTripIdParamSchema,
  RentalRecommendationQuerySchema,
  type RentalTripIdParamDto,
  type RentalRecommendationQueryDto,
} from '../dtos/ordering.dto';

@ApiTags('Rental Ordering - Trip')
@ApiBearerAuth('bearer')
@Controller('trips/:tripId')
export class RentalTripController {
  constructor(
    private readonly getRentalEligibilityUseCase: GetRentalEligibilityUseCase,
    private readonly getRentalRecommendationsUseCase: GetRentalRecommendationsUseCase,
  ) {}

  @Get('rental-eligibility')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER)
  @ApiOperation({
    summary: 'Kiểm tra điều kiện thuê thiết bị của chuyến đi',
    description: `
**RB-API-101** — Kiểm tra Trip membership có đủ điều kiện thuê thiết bị hay không.

- Chuyến đi phải thuộc user hiện tại.
- Nếu chưa đủ điều kiện, vẫn trả HTTP 200 với \`eligible = false\` kèm lý do.
- Không dùng \`participantCount\` làm quota thuê.
- \`cutoff\` và \`contextVersion\` do server trả về, FE không tự tính.
`,
  })
  @ApiParam({
    name: 'tripId',
    type: String,
    format: 'uuid',
    description: 'ID chuyến đi cần kiểm tra',
    example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
  })
  @ApiResponse({ status: 200, description: 'Trả về kết quả kiểm tra: eligible (true/false), lý do, cutoff, contextVersion' })
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(403, 'Không có quyền', 'FORBIDDEN', 'Chuyến đi không thuộc về user hiện tại')
  @ApiErrorResponse(404, 'Không tìm thấy', 'TRIP_MEMBERSHIP_NOT_FOUND', 'Không tìm thấy thông tin thành viên của chuyến đi')
  async getEligibility(
    @Param(new ZodValidationPipe(RentalTripIdParamSchema))
    params: RentalTripIdParamDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.getRentalEligibilityUseCase.execute({
      tripId: params.tripId,
      userId,
    });
  }

  @Get('rental-recommendations')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER)
  @ApiOperation({
    summary: 'Gợi ý thiết bị phù hợp cho chuyến đi',
    description: `
**RB-API-104** — Lấy danh sách thiết bị được gợi ý dựa trên đặc điểm chuyến đi.

- Sử dụng hệ thống gợi ý rule-based (P0).
- Điểm số (\`score\`) chỉ dùng để xếp hạng và giải thích gợi ý, **không** quyết định eligibility, availability, giá, cọc hoặc số lượng.
- Có thể lọc theo danh mục thiết bị (\`categoryId\`) và giới hạn số lượng kết quả (\`limit\`).
`,
  })
  @ApiParam({
    name: 'tripId',
    type: String,
    format: 'uuid',
    description: 'ID chuyến đi',
    example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Lọc gợi ý theo danh mục thiết bị',
    example: 'd4e5f6a7-8901-23de-f012-456789012cde',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Số lượng gợi ý tối đa trả về (1–50, mặc định: 5)',
    example: 5,
  })
  @ApiResponse({ status: 200, description: 'Trả về danh sách thiết bị gợi ý kèm điểm số và lý do' })
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(403, 'Không có quyền', 'FORBIDDEN', 'Chuyến đi không thuộc về user hiện tại')
  @ApiErrorResponse(422, 'Không đủ điều kiện', 'TRIP_MEMBERSHIP_NOT_ELIGIBLE', 'Chuyến đi không đủ điều kiện thuê thiết bị')
  async getRecommendations(
    @Param(new ZodValidationPipe(RentalTripIdParamSchema))
    params: RentalTripIdParamDto,
    @Query(new ZodValidationPipe(RentalRecommendationQuerySchema))
    query: RentalRecommendationQueryDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.getRentalRecommendationsUseCase.execute({
      tripId: params.tripId,
      userId,
      categoryId: query.categoryId,
      limit: query.limit,
    });
     
  }
}