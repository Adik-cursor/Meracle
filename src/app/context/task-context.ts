import { createContext, useContext } from 'react'
import type { Id, Task, TaskPriority, TaskStatus } from '../../core/types'

export type TaskDraft = {
  title: string
  description?: string
  status?: TaskStatus
  priority: TaskPriority
  assignedUserId?: Id
  dealId?: Id
  dueDate?: string
}

export type TaskContextValue = {
  tasks: Task[]
  getTask: (id: Id) => Task | undefined
  getTasksByUser: (userId: Id) => Task[]
  getTasksByDeal: (dealId: Id) => Task[]
  createTask: (draft: TaskDraft) => boolean
  updateTask: (id: Id, draft: TaskDraft) => boolean
  setTaskStatus: (id: Id, status: TaskStatus) => void
  deleteTask: (id: Id) => boolean
}

export const TaskContext = createContext<TaskContextValue | null>(null)

export function useTasks(): TaskContextValue {
  const context = useContext(TaskContext)

  if (!context) {
    throw new Error('useTasks must be used within TaskProvider')
  }

  return context
}
