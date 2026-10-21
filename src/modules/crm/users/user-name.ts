import type { User } from '../../../core/types'

export function userDisplayName(user: User): string {
  return `${user.firstName} ${user.lastName}`.trim()
}
