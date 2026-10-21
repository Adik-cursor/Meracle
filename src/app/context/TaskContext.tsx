import { useMemo, type ReactNode } from 'react'
import type { Id, TaskStatus } from '../../core/types'
import {
  canAccessTask,
  createTaskForUser,
  deleteTaskForUser,
  listTasksForUser,
  setTaskStatusForUser,
  updateTaskForUser,
} from '../../core/services'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import { TaskContext, type TaskContextValue, type TaskDraft } from './task-context'

type TaskProviderProps = {
  children: ReactNode
}

export function TaskProvider({ children }: TaskProviderProps) {
  const { organization } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<TaskContextValue>(() => {
    void version
    const listed = listTasksForUser(persistence, currentUser)
    const tasks = listed.ok ? listed.value : []

    return {
      tasks,
      getTask: (id: Id) => {
        const task = persistence.tasks.getById(id)
        return task && canAccessTask(persistence, currentUser, task)
          ? task
          : undefined
      },
      getTasksByUser: (userId: Id) =>
        tasks.filter((task) => task.assignedUserId === userId),
      getTasksByDeal: (dealId: Id) =>
        tasks.filter((task) => task.dealId === dealId),
      createTask: (draft: TaskDraft) =>
        createTaskForUser(persistence, currentUser, organization.id, draft).ok,
      updateTask: (id: Id, draft: TaskDraft) =>
        updateTaskForUser(persistence, currentUser, organization.id, id, draft)
          .ok,
      setTaskStatus: (id: Id, status: TaskStatus) => {
        setTaskStatusForUser(
          persistence,
          currentUser,
          organization.id,
          id,
          status,
        )
      },
      deleteTask: (id: Id) =>
        deleteTaskForUser(persistence, currentUser, organization.id, id).ok,
    }
  }, [currentUser, organization.id, persistence, version])

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>
}
