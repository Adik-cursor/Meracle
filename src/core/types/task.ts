import type { BaseEntity, Id, IsoDateTime } from './common'

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled'

export type TaskPriority = 'low' | 'medium' | 'high'

export type Task = BaseEntity & {
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assignedUserId?: Id
  dealId?: Id
  dueDate?: IsoDateTime
}
