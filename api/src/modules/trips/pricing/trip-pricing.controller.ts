import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { z } from 'zod'
import { Auth } from '../../../shared/decorators/auth.decorator'
import { ActiveUser } from '../../../shared/decorators/active-user.decorator'
import { Roles } from '../../../shared/decorators/roles.decorator'
import { AuthType } from '../../../shared/constants/auth.constant'
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe'
import { TripPricingService } from './trip-pricing.service'
import {
  costPlanSaveSchema,
  pricingConfirmSchema,
  pricingPreviewSchema,
  tripIdParamSchema,
} from './trip-pricing.dto'
import type { CostPlanSaveInput, PricingConfirmInput, PricingPreviewInput } from './trip-pricing.dto'

const schema = (value: z.ZodType): SchemaObject => {
  const { $schema, ...json } = z.toJSONSchema(value, { target: 'openapi-3.0' })
  return json as SchemaObject
}

const idParam = (name: string) => ApiParam({ name, schema: { type: 'string', format: 'uuid' } })

@Controller('leader')
@ApiTags('CF01 Leader Public Trip Pricing')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles('LEADER')
@ApiResponse({ status: 400, description: 'VALIDATION_ERROR — dữ liệu đầu vào không hợp lệ.' })
@ApiResponse({ status: 403, description: 'FORBIDDEN — cần tài khoản LEADER ACTIVE sở hữu chuyến đi.' })
@ApiResponse({ status: 404, description: 'TRIP_PRICING_NOT_FOUND — không tìm thấy chuyến đi hoặc bảng chi phí.' })
@ApiResponse({
  status: 409,
  description:
    'TRIP_PRICING_LOCKED / TRIP_PRICING_VERSION_CONFLICT / TRIP_PRICING_LOSS_INTERVAL / TRIP_PRICING_STALE',
})
@ApiResponse({
  status: 422,
  description: 'TRIP_PRICING_COST_PLAN_INVALID / TRIP_PRICING_PAX_INVALID / TRIP_PRICING_IMPOSSIBLE',
})
export class TripPricingController {
  constructor(private readonly pricing: TripPricingService) {}

  @Get('pricing-config')
  @ApiOperation({
    summary: 'Đọc cấu hình phí nền tảng, phí thanh toán và bước làm tròn giá vé',
  })
  @ApiResponse({
    status: 200,
    schema: schema(
      z.object({
        policyVersion: z.string(),
        platformFeeBps: z.number().int(),
        paymentFeeBps: z.number().int(),
        totalFeeBps: z.number().int(),
        defaultContingencyBps: z.number().int(),
        defaultTargetMarginBps: z.number().int(),
        roundingStepVnd: z.string(),
        currency: z.string(),
      }),
    ),
  })
  getPricingConfig(@ActiveUser('id') actorId: string) {
    return this.pricing.getPricingConfig(actorId)
  }

  @Get('public-trips/:id/cost-plan')
  @idParam('id')
  @ApiOperation({
    summary: 'Lấy bảng chi phí, kết quả mô phỏng hiện tại và lịch sử các phiên bản giá của chuyến đi',
  })
  @ApiResponse({
    status: 200,
    schema: schema(
      z.object({
        tripId: z.string().uuid(),
        tripVersion: z.number().int(),
        tripStatus: z.string(),
        costPlanStatus: z.string().nullable(),
      }),
    ),
  })
  getCostPlan(
    @ActiveUser('id') actorId: string,
    @Param('id', new ZodValidationPipe(tripIdParamSchema)) tripId: string,
  ) {
    return this.pricing.getCostPlan(actorId, tripId)
  }

  @Put('public-trips/:id/cost-plan')
  @idParam('id')
  @ApiOperation({
    summary: 'Lưu bảng dòng chi phí (FIXED/VARIABLE/STEP) và thông số mô phỏng của chuyến đi',
  })
  @ApiBody({ schema: schema(costPlanSaveSchema) })
  @ApiResponse({
    status: 200,
    schema: schema(
      z.object({
        tripId: z.string().uuid(),
        tripVersion: z.number().int(),
        costPlanStatus: z.string(),
      }),
    ),
  })
  saveCostPlan(
    @ActiveUser('id') actorId: string,
    @Param('id', new ZodValidationPipe(tripIdParamSchema)) tripId: string,
    @Body(new ZodValidationPipe(costPlanSaveSchema)) body: CostPlanSaveInput,
  ) {
    return this.pricing.saveCostPlan(actorId, tripId, body)
  }

  @Post('public-trips/:id/pricing/preview')
  @idParam('id')
  @ApiOperation({
    summary: 'Chạy Trekking Pricing Simulator trên RAM từ danh sách chi phí và thông số thanh trượt (không lưu DB)',
  })
  @ApiBody({ schema: schema(pricingPreviewSchema) })
  @ApiResponse({
    status: 201,
    schema: schema(
      z.object({
        tripId: z.string().uuid(),
        calcVersion: z.string(),
      }),
    ),
  })
  previewPricing(
    @ActiveUser('id') actorId: string,
    @Param('id', new ZodValidationPipe(tripIdParamSchema)) tripId: string,
    @Body(new ZodValidationPipe(pricingPreviewSchema)) body: PricingPreviewInput,
  ) {
    return this.pricing.previewPricing(actorId, tripId, body)
  }

  @Post('public-trips/:id/pricing/confirm')
  @idParam('id')
  @ApiOperation({
    summary:
      'Chốt giá vé (selectedPrice) và số khách tối thiểu (selectedMinPax) vào Trip; nếu Trip đã OPEN/FULL sẽ tạo luôn TripPricingVersion mới',
  })
  @ApiBody({ schema: schema(pricingConfirmSchema) })
  @ApiResponse({
    status: 201,
    schema: schema(
      z.object({
        tripId: z.string().uuid(),
        tripVersion: z.number().int(),
        selectedPrice: z.string(),
        selectedMinPax: z.number().int(),
      }),
    ),
  })
  confirmPricing(
    @ActiveUser('id') actorId: string,
    @Param('id', new ZodValidationPipe(tripIdParamSchema)) tripId: string,
    @Body(new ZodValidationPipe(pricingConfirmSchema)) body: PricingConfirmInput,
  ) {
    return this.pricing.confirmPricing(actorId, tripId, body)
  }
}
