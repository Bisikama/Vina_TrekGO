export const MEDIA_REFERENCE_PORT = Symbol('MEDIA_REFERENCE_PORT');

export interface MediaReferencePort {
  hasActiveReferences(mediaId: string): Promise<boolean>;
}
