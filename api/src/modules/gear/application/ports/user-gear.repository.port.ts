import { GearCategory, GearCondition, UserGearItemDomain, UserGearItemPhotoDomain } from '../../domain/gear.types';

export const USER_GEAR_REPOSITORY_PORT = Symbol('USER_GEAR_REPOSITORY_PORT');

export interface UserGearPatchInput {
  name?: string;
  brand?: string | null;
  condition?: GearCondition;
  attributes?: Record<string, unknown>;
  photoRef?: string | null;
  category?: GearCategory;
}

export interface CreateUserGearItemRepoInput
  extends Omit<UserGearItemDomain, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'photos'> {
  acknowledgeDuplicate?: boolean;
}

export interface UserGearRepositoryPort {
  findByIdAndUser(id: string, userId: string): Promise<UserGearItemDomain | null>;
  findByIdsAndUser(ids: string[], userId: string): Promise<UserGearItemDomain[]>;
  findAllByUser(userId: string, category?: GearCategory): Promise<UserGearItemDomain[]>;
  countByUser(userId: string): Promise<number>;
  create(
    item: CreateUserGearItemRepoInput,
    photos?: Array<{ storageRef: string; position: number }>,
    maxLimit?: number,
  ): Promise<UserGearItemDomain>;
  patch(id: string, userId: string, patch: UserGearPatchInput, expectedVersion?: number): Promise<UserGearItemDomain>;
  delete(id: string, userId: string): Promise<boolean>;
  addPhoto(itemId: string, userId: string, storageRef: string, position?: number): Promise<UserGearItemPhotoDomain>;
  deletePhoto(itemId: string, photoId: string, userId: string): Promise<boolean>;
  reorderPhotos(itemId: string, userId: string, photoOrders: Array<{ photoId: string; position: number }>): Promise<UserGearItemPhotoDomain[]>;
}
