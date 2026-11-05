import { Controller, Get, Header, Param, Query, Redirect } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { GetRentalDocumentUseCase } from '../../application/use-cases/get-rental-document.use-case';
import { RentalDocumentService } from '../../../documents/application/rental-document.service';
import { RentalDocumentIdParamSchema, type RentalDocumentIdParamDto } from '../dtos/rental-return.dto';

const EvidenceLinkParamsSchema = z.object({ documentId: z.string().uuid(), mediaId: z.string().uuid() });
type EvidenceLinkParams = z.infer<typeof EvidenceLinkParamsSchema>;

@ApiTags('Rental Documents')
@ApiBearerAuth('bearer')
@Controller('rental-documents')
@Auth([AuthType.Bearer])
export class RentalDocumentController {
  constructor(private readonly getRentalDocumentUseCase: GetRentalDocumentUseCase,
    private readonly documents: RentalDocumentService) {}

  @Get(':documentId/download')
  @Roles(UserRole.USER, UserRole.LEADER, UserRole.STAFF_DELIVERY, UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'RB-API-1003 — Tải chứng từ PDF bằng đường dẫn có chữ ký (hiệu lực 10 phút)',
    description: 'Trả về đường dẫn tải PDF đã ký, thời điểm hết hạn, tên tệp, MIME và mã băm SHA-256 của chứng từ.',
  })
  @ApiParam({ name: 'documentId', type: String, format: 'uuid', description: 'UUID chứng từ' })
  @ApiResponse({ status: 200, description: 'Đường dẫn tải đã ký, thời hạn, tên tệp, MIME và SHA-256' })
  @ApiResponse({ status: 409, description: 'Chứng từ chưa sẵn sàng hoặc lỗi toàn vẹn dữ liệu' })
  async download(@Param(new ZodValidationPipe(RentalDocumentIdParamSchema)) params: RentalDocumentIdParamDto,
    @ActiveUser('id') actorUserId: string, @ActiveUser('role') actorRole: string) {
    return { data: await this.documents.download(params.documentId, actorUserId, actorRole) };
  }

  @Get(':documentId/verification')
  @Roles(UserRole.USER, UserRole.LEADER, UserRole.STAFF_DELIVERY, UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'RB-API-1005 — Xác minh snapshot bất biến và mã băm PDF đã lưu',
    description: 'Đối chiếu mã băm snapshot và tệp PDF đã lưu để kiểm tra chứng từ có bị thay đổi hay không.',
  })
  @ApiParam({ name: 'documentId', type: String, format: 'uuid', description: 'UUID chứng từ' })
  @ApiResponse({ status: 200, description: 'Mã băm chứng từ và kết quả xác minh được tính toán' })
  async verification(@Param(new ZodValidationPipe(RentalDocumentIdParamSchema)) params: RentalDocumentIdParamDto,
    @ActiveUser('id') actorUserId: string, @ActiveUser('role') actorRole: string) {
    return { data: await this.documents.verify(params.documentId, actorUserId, actorRole) };
  }

  @Get(':documentId/evidence/:mediaId')
  @Auth([AuthType.None])
  @Redirect()
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @ApiOperation({
    summary: 'Mở ảnh bằng chứng từ link in trong PDF chứng từ',
    description:
      'Link có chữ ký HMAC theo (chứng từ, ảnh), không cần đăng nhập. Ảnh phải nằm trong snapshot của chứng từ và còn READY; ' +
      'hợp lệ thì chuyển hướng 302 sang ảnh. Mọi trường hợp không hợp lệ trả 404.',
  })
  @ApiParam({ name: 'documentId', type: String, format: 'uuid' })
  @ApiParam({ name: 'mediaId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'sig', type: String, required: true, description: 'Chữ ký HMAC in sẵn trong PDF' })
  @ApiResponse({ status: 302, description: 'Chuyển hướng tới ảnh bằng chứng' })
  @ApiResponse({ status: 404, description: 'Link không hợp lệ, ảnh không thuộc chứng từ hoặc không còn tồn tại' })
  async openEvidence(
    @Param(new ZodValidationPipe(EvidenceLinkParamsSchema)) params: EvidenceLinkParams,
    @Query('sig') signature: string,
  ) {
    return { url: await this.documents.resolveEvidenceLink(params.documentId, params.mediaId, signature), statusCode: 302 };
  }

  @Get(':documentId')
  @Roles(UserRole.USER, UserRole.LEADER, UserRole.STAFF_DELIVERY, UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'RB-API-1002 — Xem chi tiết chứng từ (Rental Document direct URL)',
    description: 'Truy vấn chi tiết chứng từ và snapshot bất biến theo documentId.',
  })
  @ApiParam({ name: 'documentId', type: String, format: 'uuid', description: 'UUID chứng từ' })
  @ApiResponse({ status: 200, description: 'Chi tiết chứng từ' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập chứng từ này' })
  @ApiResponse({ status: 404, description: 'Chứng từ không tồn tại' })
  async getDocument(
    @Param(new ZodValidationPipe(RentalDocumentIdParamSchema)) params: RentalDocumentIdParamDto,
    @ActiveUser('id') actorUserId: string,
    @ActiveUser('role') actorRole: string,
  ) {
    return this.getRentalDocumentUseCase.execute({ documentId: params.documentId, actorUserId, actorRole });
  }
}
