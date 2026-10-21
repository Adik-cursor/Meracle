import { useMemo, useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useDeals } from '../../context/deal-context'
import { useLocalization } from '../../context/localization-context'
import { useTasks } from '../../context/task-context'
import type { TaskDraft } from '../../context/task-context'
import { useUsers } from '../../context/user-context'
import type { Task } from '../../../core/types'
import { TaskForm } from '../../../modules/crm/tasks/TaskForm'
import { TaskList } from '../../../modules/crm/tasks/TaskList'
import { userDisplayName } from '../../../modules/crm/users/user-name'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { Button, EmptyState, FilterBar, Input, PageHeader } from '../../../shared/ui'

export function TasksPage() {
  const { t } = useLocalization()
  const { currentUser } = useAccess()
  const { deals } = useDeals()
  const { users } = useUsers()
  const { tasks, createTask, updateTask, setTaskStatus, deleteTask } = useTasks()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'all' | 'mine'>('all')
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>(
    'closed',
  )
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const currentUserId = currentUser?.id ?? null
  const canFilterMine = Boolean(currentUser)

  const closeForm = () => {
    setFormMode('closed')
    setEditingTask(null)
  }

  const selectedTask =
    formMode === 'edit' && editingTask
      ? tasks.find((task) => task.id === editingTask.id)
      : undefined

  const dealTitleById = useMemo(
    () => Object.fromEntries(deals.map((deal) => [deal.id, deal.title])),
    [deals],
  )
  const userNameById = useMemo(
    () =>
      Object.fromEntries(users.map((user) => [user.id, userDisplayName(user)])),
    [users],
  )

  const visibleTasks = useMemo(() => {
    const scoped =
      scope === 'mine' && currentUserId
        ? tasks.filter((task) => task.assignedUserId === currentUserId)
        : tasks
    const needle = query.trim().toLowerCase()

    return scoped.filter((task) => {
      if (!needle) {
        return true
      }

      const dealTitle = task.dealId ? (dealTitleById[task.dealId] ?? '') : ''
      const assigneeName = task.assignedUserId
        ? (userNameById[task.assignedUserId] ?? '')
        : ''

      return (
        task.title.toLowerCase().includes(needle) ||
        (task.description ?? '').toLowerCase().includes(needle) ||
        dealTitle.toLowerCase().includes(needle) ||
        assigneeName.toLowerCase().includes(needle)
      )
    })
  }, [currentUserId, dealTitleById, query, scope, tasks, userNameById])

  const handleCreate = (draft: TaskDraft) => createTask(draft)
  const handleUpdate = (draft: TaskDraft) =>
    selectedTask ? updateTask(selectedTask.id, draft) : false

  if (!currentUser) {
    return <AuthRequiredState />
  }

  return (
    <section className="workspace-page">
      <PageHeader
        title={t('navTasks')}
        actions={
          formMode === 'closed' ? (
            <Button variant="primary" onClick={() => setFormMode('create')}>
              {t('newTask')}
            </Button>
          ) : null
        }
      />
      {formMode === 'closed' ? (
        <FilterBar
          search={
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={t('searchTask')}
              placeholder={t('searchPlaceholder')}
            />
          }
          filters={
            <div className="scope-switch" role="group" aria-label={t('navTasks')}>
              <button
                type="button"
                className={
                  scope === 'all'
                    ? 'scope-switch__btn scope-switch__btn--active'
                    : 'scope-switch__btn'
                }
                onClick={() => setScope('all')}
              >
                {t('allTasks')}
              </button>
              <button
                type="button"
                className={
                  scope === 'mine'
                    ? 'scope-switch__btn scope-switch__btn--active'
                    : 'scope-switch__btn'
                }
                disabled={!canFilterMine}
                title={!canFilterMine ? t('myTasksNeedsAuth') : undefined}
                onClick={() => {
                  if (canFilterMine) {
                    setScope('mine')
                  }
                }}
              >
                {t('myTasksFilter')}
              </button>
            </div>
          }
        />
      ) : null}

      {formMode === 'create' ? (
        <TaskForm
          deals={deals}
          users={users}
          onSubmit={handleCreate}
          onCancel={closeForm}
        />
      ) : null}

      {formMode === 'edit' && selectedTask ? (
        <TaskForm
          key={`${selectedTask.id}-${selectedTask.updatedAt}`}
          task={selectedTask}
          deals={deals}
          users={users}
          onSubmit={handleUpdate}
          onCancel={closeForm}
        />
      ) : null}

      {visibleTasks.length === 0 && formMode === 'closed' ? (
        <EmptyState
          title={t('noTasks')}
          action={
            <Button variant="primary" onClick={() => setFormMode('create')}>
              {t('newTask')}
            </Button>
          }
        />
      ) : null}

      {visibleTasks.length > 0 ? (
        <TaskList
          tasks={visibleTasks}
          dealTitleById={dealTitleById}
          userNameById={userNameById}
          onEdit={(task) => {
            setEditingTask(task)
            setFormMode('edit')
          }}
          onStatusChange={(task, status) => setTaskStatus(task.id, status)}
          onDelete={(task) => deleteTask(task.id)}
        />
      ) : null}
    </section>
  )
}
