export function watchTransfer(startedAt:Date,hours:number,now:Date,acknowledged:boolean) {
 if (hours<=0 || !Number.isFinite(hours)) throw new Error('INVALID_TRANSFER_ALLOWANCE');
 const watchAt=new Date(startedAt.getTime()+hours*3600_000);
 return {watchAt,delayed:!acknowledged && now>watchAt};
}
/** The window starts ONLY after BOTH ownership-scoped media access and persisted in-app notice. */
export function verifiedEvidenceAccessibleAt(input:{evidencePublishedAt:Date|null;inAppNoticePublishedAt:Date|null;mediaReadableByOwner:boolean;noticePersisted:boolean}) : Date|null {
 if (!input.mediaReadableByOwner || !input.noticePersisted || !input.evidencePublishedAt || !input.inAppNoticePublishedAt) return null;
 return new Date(Math.max(input.evidencePublishedAt.getTime(),input.inAppNoticePublishedAt.getTime()));
}
export function adminDeadline(evidenceCompleteAt:Date|null,minutes:number) {
 if (!evidenceCompleteAt || !Number.isFinite(minutes) || minutes<=0) return null;
 return new Date(evidenceCompleteAt.getTime()+minutes*60_000);
}
