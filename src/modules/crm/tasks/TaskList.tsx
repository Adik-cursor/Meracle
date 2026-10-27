import type { Task, TaskPriority, TaskStatus } from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'
import { useLocalization } from '../../../app/context/localization-context'
import { ActionRow, Button, Select, StatusBadge, Table } from '../../../shared/ui'

type TaskListProps = {
  tasks: Task[]
  dealTitleById: Record<string, string>
  userNameById: Record<string, string>
  onEdit: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
  onDelete: (task: Task) => void
}

const STATUS_LABEL: Record<TaskStatus, TranslationKey> = {
  todo: 'taskStatusTodo',
  in_progress: 'taskStatusInProgress',
  completed: 'taskStatusCompleted',
  cancelled: 'taskStatusCancelled',
}

const PRIORITY_LABEL: Record<TaskPriority, TranslationKey> = {
  low: 'taskPriorityLow',
  medium: 'taskPriorityMedium',
  high: 'taskPriorityHigh',
}

const PRIORITY_TONE: Record<TaskPriority, 'neutral' | 'info' | 'warning'> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
}

const STATUS_TONE: Record<TaskStatus, 'info' | 'warning' | 'success' | 'neutral'> =
  {
    todo: 'info',
    in_progress: 'warning',
    completed: 'success',
    cancelled: 'neutral',
  }

const ACTIVE_STATUSES: TaskStatus[] = ['todo', 'in_progress']
const ALL_STATUSES: TaskStatus[] = [
  'todo',
  'in_progress',
  'completed',
  'cancelled',
]

export function TaskList({
  tasks,
  dealTitleById,
  userNameById,
  onEdit,
  onStatusChange,
  onDelete,
}: TaskListProps) {
  const { t, locale } = useLocalization()
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'

  return (
    <Table mobileLayout="cards">
      <thead>
        <tr>
          <th>{t('navTasks')}</th>
          <th>{t('navDeals')}</th>
          <th>{t('dealAssignee')}</th>
          <th>{t('taskPriority')}</th>
          <th>{t('taskDueDate')}</th>
          <th>{t('status')}</th>
          <th>{t('transferActions')}</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => {
          const isTerminal =
            task.status === 'completed' || task.status === 'cancelled'
          const statusOptions = isTerminal
            ? ALL_STATUSES.filter(
                (status) =>
                  status === 'completed' || status === 'cancelled',
              )
            : ALL_STATUSES

          return (
            <tr key={task.id}>
              <td>
                <span className="entity-cell__title">{task.title}</span>
              </td>
              <td>
                {task.dealId
                  ? (dealTitleById[task.dealId] ?? t('dealPartyNone'))
                  : t('dealPartyNone')}
              </td>
              <td>
                {task.assignedUserId
                  ? (userNameById[task.assignedUserId] ?? t('dealUnassigned'))
                  : t('dealUnassigned')}
              </td>
              <td>
                <StatusBadge tone={PRIORITY_TONE[task.priority]}>
                  {t(PRIORITY_LABEL[task.priority])}
                </StatusBadge>
              </td>
              <td>
                {task.dueDate
                  ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(
                      numberLocale,
                    )
                  : t('dealPartyNone')}
              </td>
              <td>
                <StatusBadge tone={STATUS_TONE[task.status]}>
                  {t(STATUS_LABEL[task.status])}
                </StatusBadge>
              </td>
              <td>
                <ActionRow>
                  <Button onClick={() => onEdit(task)}>{t('edit')}</Button>
                  <Select
                    aria-label={t('changeTaskStatus')}
                    value={task.status}
                    onChange={(event) =>
                      onStatusChange(task, event.target.value as TaskStatus)
                    }
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {t(STATUS_LABEL[status])}
                      </option>
                    ))}
                  </Select>
                  {ACTIVE_STATUSES.includes(task.status) ? (
                    <>
                      <Button
                        onClick={() => onStatusChange(task, 'completed')}
                      >
                        {t('completeTask')}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => onStatusChange(task, 'cancelled')}
                      >
                        {t('cancelTask')}
                      </Button>
                    </>
                  ) : null}
                  <Button variant="danger" onClick={() => onDelete(task)}>
                    {t('delete')}
                  </Button>
                </ActionRow>
              </td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}
