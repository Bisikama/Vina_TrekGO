import { GearCategory, GearCondition, UserGearItemDomain } from '../../domain/gear.types';

export const USER_GEAR_REPOSITORY_PORT = Symbol('USER_GEAR_REPOSITORY_PORT');

export interface UserGearPatchInput {
  name?: string;
  brand?: string | null;
  condition?: GearCondition;
  attributes?: Record<string, unknown>;
  photoRef?: string | null;
  category?: GearCategory;
}

export interface UserGearRepositoryPort {
  findByIdAndUser(id: string, userId: string): Promise<UserGearItemDomain | null>;
  findAllByUser(userId: string, category?: GearCategory): Promise<UserGearItemDomain[]>;
  create(item: Omit<UserGearItemDomain, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<UserGearItemDomain>;
  patch(id: string, userId: string, patch: UserGearPatchInput, expectedVersion?: number): Promise<UserGearItemDomain>;
  delete(id: string, userId: string): Promise<boolean>;
}

