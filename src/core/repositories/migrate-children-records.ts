import type { Child, ChildStatus } from '../types/child'

export function migrateChildStatus(status: string | undefined): ChildStatus {
  if (status === 'inactive' || status === 'withdrawn') {
    return 'withdrawn'
  }
  if (status === 'temporarily_absent') {
    return 'temporarily_absent'
  }
  return 'attending'
}

export function migrateChildrenRecords(records: Child[]): Child[] {
  return records.map((child) => ({
    ...child,
    status: migrateChildStatus(child.status),
    groupId: child.groupId || undefined,
    parentContactId: child.parentContactId || undefined,
    parentCustomerId: child.parentCustomerId || undefined,
    notes: child.notes || undefined,
  }))
}
