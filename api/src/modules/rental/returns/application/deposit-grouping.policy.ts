/** Source of truth: 1.3.2/1.5.2 — pure deterministic item grouping.
 * Calling this helper does NOT issue a refund; actual requests must be made
 * through Shared Payment after transactional checks and allocation locks.
 */
export interface DepositRefundCandidate {
  itemId: string; paymentId: string; currency: string; amount: number;
  isFinalPass: boolean; inventoryCustodyReceived: boolean;
  openCase: boolean; alreadyAllocated: boolean;
}
export interface DepositRefundGroup { paymentId: string; currency: string; totalAmount: number; itemIds: string[] }
export function planDepositRefundGroups(items: DepositRefundCandidate[]): DepositRefundGroup[] {
  const groups = new Map<string, DepositRefundGroup>();
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.itemId)) throw new Error('DUPLICATE_DEPOSIT_ITEM');
    seen.add(item.itemId);
    if (!item.isFinalPass || !item.inventoryCustodyReceived || item.openCase || item.alreadyAllocated) continue;
    if (!Number.isSafeInteger(item.amount) || item.amount <= 0) throw new Error('INVALID_DEPOSIT_AMOUNT');
    const key = `${item.paymentId}|${item.currency}`;
    let group = groups.get(key);
    if (!group) {group = {paymentId:item.paymentId,currency:item.currency,totalAmount:0,itemIds:[]}; groups.set(key,group);}
    group.itemIds.push(item.itemId);group.totalAmount += item.amount;
    if (!Number.isSafeInteger(group.totalAmount)) throw new Error('AMOUNT_OVERFLOW');
  }
  return [...groups.values()].map(g=>({...g,itemIds:g.itemIds.sort()})).sort((a,b)=>
    (a.paymentId+'|'+a.currency).localeCompare(b.paymentId+'|'+b.currency));
}
