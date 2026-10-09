import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthType } from 'src/shared/constants/auth.constant';
import { UserRole } from 'src/shared/constants';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { AppError } from 'src/shared/errors/app-error';
import { RentalExtensionService } from './rental-extension.service';
const Params = z.object({ id: z.string().uuid() });
const Quote = z.object({ requestedReturnAt: z.string().datetime({ offset: true }), returnOptionId: z.string().min(1) }).strict();
const Confirm = z.object({ extensionQuoteId: z.string().uuid(), expectedVersion: z.number().int().positive(), acceptedTermsVersion: z.string().min(1).max(40) }).strict();
function key(value?: string) { if (!value?.trim()) throw AppError.fromCode('IDEMPOTENCY_KEY_REQUIRED'); return value; }
@ApiTags('Rental Extensions v1.2.2')
@ApiBearerAuth('bearer')
@Controller('rental-orders')
export class RentalExtensionController {
  constructor(private readonly service: RentalExtensionService) {}
  @Post(':id/extension-quotes') @Auth([AuthType.Bearer]) @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Quote extension: validates policy/logistics, no capacity hold' })
  quote(@Param(new ZodValidationPipe(Params)) params: z.infer<typeof Params>, @Body(new ZodValidationPipe(Quote)) body: z.infer<typeof Quote>, @ActiveUser('id') userId: string) {
    return this.service.quote(userId, params.id, new Date(body.requestedReturnAt), body.returnOptionId);
  }
  @Post(':id/extensions') @Auth([AuthType.Bearer]) @Roles(UserRole.USER)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Hold delta capacity atomically, apply immediately only when additionalFee = 0' })
  confirm(@Param(new ZodValidationPipe(Params)) params: z.infer<typeof Params>, @Body(new ZodValidationPipe(Confirm)) body: z.infer<typeof Confirm>,
    @Headers('idempotency-key') rawKey: string | undefined, @ActiveUser('id') userId: string) {
    return this.service.confirm(userId, params.id, body.extensionQuoteId, body.expectedVersion, key(rawKey));
  }
  @Get(':id/extensions') @Auth([AuthType.Bearer]) @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Current/past extension requests' })
  list(@Param(new ZodValidationPipe(Params)) params: z.infer<typeof Params>, @ActiveUser('id') userId: string) {
    return this.service.list(userId, params.id);
  }
}
