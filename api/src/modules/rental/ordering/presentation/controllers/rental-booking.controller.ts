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
    summary: 'Kiểm tra Trip membership có đủ điều kiện thuê thiết bị',
    description: `
RB-API-101.
- Trip membership phải thuộc USER hiện tại.
- Trip membership chưa đủ điều kiện vẫn trả HTTP 200 với eligible=false.
- Không dùng participantCount làm quota thuê.
- cutoff/contextVersion do server trả về; FE không tự tính.
`,
  })
  @ApiParam({
    name: 'tripId',
    format: 'uuid',
    description: 'Trip UUID',
  })
  @ApiResponse({ status: 200, description: 'Kết quả eligibility của Trip' })
  @ApiErrorResponse(403, 'Forbidden', 'FORBIDDEN', 'Trip membership không thuộc USER hiện tại')
  @ApiErrorResponse(404, 'Not Found', 'TRIP_MEMBERSHIP_NOT_FOUND', 'Không tìm thấy Trip membership')
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
    summary: 'Lấy gợi ý thiết bị theo Trip',
    description: `
RB-API-104.
P0 dùng rule-based recommendation. Score chỉ dùng để xếp hạng/giải thích,
không được quyết định eligibility, availability, price, deposit hoặc quantity.
`,
  })
  @ApiParam({ name: 'tripId', format: 'uuid', description: 'Trip UUID' })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    format: 'uuid',
    description: 'Lọc candidate theo Rental Category',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    default: 5,
    minimum: 1,
    maximum: 50,
  })
  @ApiResponse({ status: 200, description: 'Danh sách gợi ý rule-based' })
  @ApiErrorResponse(403, 'Forbidden', 'FORBIDDEN', 'Trip membership không thuộc USER hiện tại')
  @ApiErrorResponse(
    422,
    'Unprocessable Entity',
    'TRIP_MEMBERSHIP_NOT_ELIGIBLE',
    'Trip membership không đủ điều kiện thuê',
  )
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