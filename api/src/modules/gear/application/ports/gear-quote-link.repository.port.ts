import { GearQuoteLinkDomain } from '../../domain/gear.types';

export const GEAR_QUOTE_LINK_REPOSITORY_PORT = Symbol('GEAR_QUOTE_LINK_REPOSITORY_PORT');

export interface GearQuoteLinkRepositoryPort {
  findByRevisionAndQuote(
    planRevisionId: string,
    quoteId: string,
    userId: string,
  ): Promise<GearQuoteLinkDomain | null>;
  linkQuote(
    planRevisionId: string,
    quoteId: string,
    userId: string,
    intendedOptionRef?: { setId: string; optionId: string },
  ): Promise<GearQuoteLinkDomain>;
}
