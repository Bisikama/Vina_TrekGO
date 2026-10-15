import {watchTransfer, verifiedEvidenceAccessibleAt, adminDeadline} from './operational-deadlines';
describe('BA-XFER, BA-ADMIN, BA-ACCESS',()=>{
 const t=new Date('2026-10-10T00:00:00Z');
 it('8h is an alert; it never acknowledges custody or starts FINAL clock',()=>{
  expect(watchTransfer(t,8,new Date('2026-10-10T08:01:00Z'),false).delayed).toBe(true);
  expect(watchTransfer(t,8,new Date('2026-10-10T09:00:00Z'),true).delayed).toBe(false);
 });
 it('admin 24h deadline derives only from complete evidence',()=>{
  expect(adminDeadline(null,1440)).toBeNull();
  expect(adminDeadline(t,1440)?.toISOString()).toBe('2026-10-11T00:00:00.000Z');
 });
 it('access clock never starts on email/queued notice or broken media',()=>{
  expect(verifiedEvidenceAccessibleAt({evidencePublishedAt:t,inAppNoticePublishedAt:null,mediaReadableByOwner:true,noticePersisted:false})).toBeNull();
  expect(verifiedEvidenceAccessibleAt({evidencePublishedAt:t,inAppNoticePublishedAt:t,mediaReadableByOwner:false,noticePersisted:true})).toBeNull();
 });
 it('evidenceAccessibleAt takes later publication time',()=>{
  expect(verifiedEvidenceAccessibleAt({evidencePublishedAt:t,inAppNoticePublishedAt:new Date('2026-10-10T02:00:00Z'),mediaReadableByOwner:true,noticePersisted:true})?.toISOString()).toBe('2026-10-10T02:00:00.000Z');
 });
});
