export type PermissionOverrideDomain = 'financial' | 'warehouse'

export type PermissionOverrideEffect = 'allow' | 'deny'

export type PermissionOverride = {
  domain: PermissionOverrideDomain
  permission: string
  effect: PermissionOverrideEffect
}
