export function isUserAccountEnabled(user: {
  accountEnabled?: boolean
}): boolean {
  return user.accountEnabled !== false
}
