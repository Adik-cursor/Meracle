import { useState, type FormEvent } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import { useOrganization } from '../../../app/context/organization-context'
import { usesCareCrmComposition } from '../../../app/routes/app.routes'
import { inquiryDisplayTitle, KINDERGARTEN_TASK_TITLE_KEYS } from '../deals/inquiry-types'
import type { TaskDraft } from '../../../app/context/task-context'
import type {
  Deal,
  Task,
  TaskPriority,
  User,
} from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'
import { userDisplayName } from '../users/user-name'

const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high']

const PRIORITY_LABEL: Record<TaskPriority, TranslationKey> = {
  low: 'taskPriorityLow',
  medium: 'taskPriorityMedium',
  high: 'taskPriorityHigh',
}

type TaskFormProps = {
  task?: Task
  deals: Deal[]
  users: User[]
  onSubmit: (draft: TaskDraft) => boolean
  onCancel: () => void
}

export function TaskForm({
  task,
  deals,
  users,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const { t } = useLocalization()
  const { modules } = useOrganization()
  const inquiryMode = usesCareCrmComposition(modules)
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [dealId, setDealId] = useState(task?.dealId ?? '')
  const [assignedUserId, setAssignedUserId] = useState(task?.assignedUserId ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [titleError, setTitleError] = useState(false)

  const assigneeOptions = users.filter(
    (user) => user.status === 'active' || user.id === assignedUserId,
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextTitleError = !title.trim()
    setTitleError(nextTitleError)

    if (nextTitleError) {
      return
    }

    const saved = onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      assignedUserId: assignedUserId || undefined,
      dealId: dealId || undefined,
      dueDate: dueDate || undefined,
    })

    if (saved) {
      onCancel()
    }
  }

  return (
    <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
      <h2>{task ? t('editTask') : t('newTask')}</h2>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('name')}</span>
        <input
          className="warehouse-input"
          type="text"
          name="title"
          list={inquiryMode ? 'kindergarten-task-titles' : undefined}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            if (titleError) {
              setTitleError(false)
            }
          }}
          aria-invalid={titleError ? true : undefined}
        />
        {inquiryMode ? (
          <datalist id="kindergarten-task-titles">
            {KINDERGARTEN_TASK_TITLE_KEYS.map((key) => (
              <option key={key} value={t(key)} />
            ))}
          </datalist>
        ) : null}
        {titleError ? (
          <span className="warehouse-field__error">{t('titleRequired')}</span>
        ) : null}
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('description')}</span>
        <textarea
          className="warehouse-input"
          name="description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">
          {inquiryMode ? t('crmInquiries') : t('navDeals')}
        </span>
        {deals.length === 0 ? (
          <p className="workspace-muted">{inquiryMode ? t('noInquiries') : t('noDeals')}</p>
        ) : (
          <select
            className="warehouse-input"
            name="dealId"
            value={dealId}
            onChange={(event) => setDealId(event.target.value)}
          >
            <option value="">{t('dealPartyNone')}</option>
            {deals.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {inquiryDisplayTitle(deal.title, t)}
              </option>
            ))}
          </select>
        )}
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('dealAssignee')}</span>
        {users.length === 0 ? (
          <p className="workspace-muted">{t('noUsers')}</p>
        ) : (
          <select
            className="warehouse-input"
            name="assignedUserId"
            value={assignedUserId}
            onChange={(event) => setAssignedUserId(event.target.value)}
          >
            <option value="">{t('dealUnassigned')}</option>
            {assigneeOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {userDisplayName(user)}
              </option>
            ))}
          </select>
        )}
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('taskPriority')}</span>
        <select
          className="warehouse-input"
          name="priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value as TaskPriority)}
        >
          {TASK_PRIORITIES.map((item) => (
            <option key={item} value={item}>
              {t(PRIORITY_LABEL[item])}
            </option>
          ))}
        </select>
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('taskDueDate')}</span>
        <input
          className="warehouse-input"
          type="date"
          name="dueDate"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </label>

      <div className="warehouse-form__actions">
        <button type="submit" className="module-switch module-switch--on">
          {t('save')}
        </button>
        <button type="button" className="module-switch" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
