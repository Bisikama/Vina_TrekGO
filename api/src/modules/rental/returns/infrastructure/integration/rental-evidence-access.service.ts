import envconfig from 'src/shared/config';
import { createHmac,timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { MediaStatus, RentalExceptionCaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/shared/services/prisma.service';
import { verifiedEvidenceAccessibleAt } from '../../application/operational-deadlines';
export interface MediaAccessAttestation { caseId:string; userId:string; publishedAt:string; mediaIds:string[]; requestId:string; }
/** Called only with a signed attestation from the trusted Shared Media access service.
 * A queued email/event is NOT evidence of in-app publication or media access.
 */
@Injectable()
export class RentalEvidenceAccessService {
 constructor(private readonly db:PrismaService) {}
 async confirm(request:MediaAccessAttestation,signature:string) {
  const secret=envconfig.RENTAL_MEDIA_ACCESS_ATTESTATION_SECRET ?? process.env.RENTAL_MEDIA_ACCESS_ATTESTATION_SECRET;
  if (!secret || !signature || !/^[a-f0-9]{64}$/i.test(signature)) throw new Error('MEDIA_ACCESS_ATTESTATION_NOT_AUTHENTICATED');
  const raw=JSON.stringify([request.caseId,request.userId,request.publishedAt,[...request.mediaIds].sort(),request.requestId]);
  const expected=createHmac('sha256',secret).update(raw).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature,'hex'))) throw new Error('INVALID_MEDIA_ATTESTATION');
  const publishedAt=new Date(request.publishedAt);
  if(Number.isNaN(publishedAt.getTime())||Math.abs(Date.now()-publishedAt.getTime())>15*60_000) throw new Error('EXPIRED_MEDIA_ATTESTATION');
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM rental_exception_cases WHERE id=${request.caseId}::uuid FOR UPDATE`;
   const c=await tx.rentalExceptionCase.findUnique({where:{id:request.caseId},include:{order:{include:{rentalPolicy:true}}}});
   if(!c || c.order.userId!==request.userId || c.status!==RentalExceptionCaseStatus.RESOLVED) throw new Error('CASE_NOT_ACCESSIBLE_TO_OWNER');
   if(c.evidenceAccessibleAt) return {evidenceAccessibleAt:c.evidenceAccessibleAt.toISOString(),unchanged:true};
   const caseMedia=Array.isArray(c.evidenceIds)?c.evidenceIds.filter((x):x is string=>typeof x==='string'):[];
   if(!caseMedia.length || caseMedia.length!==request.mediaIds.length || caseMedia.some(id=>!request.mediaIds.includes(id))) throw new Error('ATTESTED_EVIDENCE_SET_MISMATCH');
   // The Shared Media signature attests to actual successful owner-scoped file access.
   const assets=await tx.mediaAsset.findMany({where:{id:{in:caseMedia},status:MediaStatus.READY,deletedAt:null},select:{id:true}});
   if(assets.length!==caseMedia.length) throw new Error('EVIDENCE_FILES_NOT_READY');
   const notice=await tx.notification.create({data:{userId:request.userId,title:'Đã công bố hồ sơ kiểm tra thiết bị',content:'Chứng cứ và quyết định được công bố trong tài khoản để phản hồi theo chính sách.',notificationType:'RENTAL_DEDUCTION_EVIDENCE_ACCESSIBLE',referenceType:'RentalExceptionCase',referenceId:c.id}});
   const accessibleAt=verifiedEvidenceAccessibleAt({evidencePublishedAt:publishedAt,inAppNoticePublishedAt:notice.createdAt,mediaReadableByOwner:true,noticePersisted:true});
   if(!accessibleAt) throw new Error('EVIDENCE_ACCESS_NOT_VERIFIED');
   const reviewMinutes=c.order.rentalPolicy.userAssessmentReviewMinutes;
   if(!reviewMinutes || reviewMinutes<=0) throw new Error('USER_RESPONSE_POLICY_NOT_CONFIGURED');
   const windowEndsAt=new Date(accessibleAt.getTime()+reviewMinutes*60_000);
   await tx.rentalExceptionCase.update({where:{id:c.id},data:{evidencePublishedAt:publishedAt,inAppNoticePublishedAt:notice.createdAt,evidenceAccessibleAt:accessibleAt,dueAt:windowEndsAt}});
   await tx.auditLog.create({data:{action:'RENTAL_EVIDENCE_ACCESSIBLE',entityType:'RentalExceptionCase',entityId:c.id,newValues:{evidenceAccessibleAt:accessibleAt.toISOString(),mediaAttestationId:request.requestId,ownerUserId:request.userId},requestId:request.requestId}});
   return {evidenceAccessibleAt:accessibleAt.toISOString(),windowEndsAt:windowEndsAt.toISOString()};
  });
 }
}
