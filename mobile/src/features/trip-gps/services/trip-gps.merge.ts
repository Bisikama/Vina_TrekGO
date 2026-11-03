import type { GpsStateResponse, MemberStateDto, LocationUpdated, PresenceUpdated } from '../types';

export function mergeMember(old: MemberStateDto | undefined, member: MemberStateDto): MemberStateDto {
  if (!old) return member;
  const result = old.memberVersion > member.memberVersion ? { ...old } : { ...member };
  if ((old.locationVersion ?? 0) > (member.locationVersion ?? 0)) {
    result.lastLocation = old.lastLocation; result.locationVersion = old.locationVersion; result.locationFreshness = old.locationFreshness;
  }
  if ((old.presenceVersion ?? 0) > (member.presenceVersion ?? 0)) {
    result.connectionStatus = old.connectionStatus; result.presenceVersion = old.presenceVersion;
  }
  return result;
}
export function mergeState(old: GpsStateResponse | null, state: GpsStateResponse): GpsStateResponse {
  if (!old || old.tripId !== state.tripId || old.selfUserId !== state.selfUserId) return state;
  const members = state.members.map(m => mergeMember(old.members.find(o => o.userId === m.userId), m));
  if (old.rosterVersion > state.rosterVersion) members.push(...old.members.filter(o => !members.some(m => m.userId === o.userId)));
  return { ...state, rosterVersion: Math.max(state.rosterVersion, old.rosterVersion), members };
}
export function patchLocation(member: MemberStateDto, event: LocationUpdated): MemberStateDto {
  return member.userId === event.userId && event.locationVersion > (member.locationVersion ?? 0)
    ? { ...member, lastLocation: event.location, locationVersion: event.locationVersion, locationFreshness: 'FRESH' } : member;
}
export function patchPresence(member: MemberStateDto, event: PresenceUpdated): MemberStateDto {
  return member.userId === event.userId && event.presenceVersion > (member.presenceVersion ?? 0)
    ? { ...member, connectionStatus: event.connectionStatus, presenceVersion: event.presenceVersion } : member;
}
