export const REQUEST_USER_KEY = 'user'

export const AuthType = {
    Bearer: 'Bearer',
    None: 'None',
    ApiKey: 'ApiKey',
} as const

export type AuthTypeType = (typeof AuthType)[keyof typeof AuthType]
export const ConditonGuardType = {
    And: 'And',
    Or: 'Or',
} as const
export type ConditonGuardTypeType = (typeof ConditonGuardType)[keyof typeof ConditonGuardType]