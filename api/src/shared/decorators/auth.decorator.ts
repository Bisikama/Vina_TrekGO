import { SetMetadata } from '@nestjs/common'
import { AuthTypeType, ConditonGuardType, ConditonGuardTypeType } from '../constants/auth.constant'

export const META_AUTH_KEY = 'META_AUTH_KEY'
export type AuthTypeDecorator = {
  authTypes: AuthTypeType[]
  options?: { condition: ConditonGuardTypeType }
}
export const Auth = (authTypes: AuthTypeType[], options?: { condition: ConditonGuardTypeType | undefined }) => {
  return SetMetadata(META_AUTH_KEY, { authTypes, options: options ?? { condition: ConditonGuardType.And } })
}
