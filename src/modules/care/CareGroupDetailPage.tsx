import { useState } from 'react'
import { useAccess } from '../../app/context/access-context'
import { useCare } from '../../app/context/care-context'
import { useLocalization } from '../../app/context/localization-context'
import { AuthRequiredState } from '../../app/components/AuthRequiredState'
import { useAppPath } from '../../app/routes/useAppPath'
import {
  childAgeYears,
  childDisplayName,
  childOccupiesPlace,
  isChildAttendance,
  todayExpenseDateInput,
} from '../../core/services'
import { Button, EmptyState } from '../../shared/ui'
import { ChildForm } from './ChildForm'
import { childStatusLabelKey } from './child-status-label'
import { GroupForm } from './GroupForm'

export function CareGroupDetailPage({ groupId }: { groupId: string }) {
  const { t } = useLocalization()
  const { navigate } = useAppPath()
  const { currentUser, hasCareAccess } = useAccess()
  const { getGroup, groups, createChild, updateGroup, listAttendance, listGroupChildren } = useCare()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)

  if (!currentUser) {
    return <AuthRequiredState />
  }

  const group = getGroup(groupId)
  if (!group) {
    return <EmptyState title={t('CARE_GROUP_NOT_FOUND')} />
  }

  const members = listGroupChildren(group.id)
  const occupying = members.filter((child) => childOccupiesPlace(child)).length
  const free = Math.max(0, group.capacity - occupying)
  const percent = group.capacity > 0 ? Math.round((occupying / group.capacity) * 100) : 0
  const today = todayExpenseDateInput()
  const byChild = new Map(
    listAttendance(today)
      .filter(isChildAttendance)
      .map((item) => [item.childId as string, item.status]),
  )
  const canManage = hasCareAccess('children.manage')

  return (
    <section className="workspace-page care-page">
      <Button onClick={() => navigate('/children?tab=groups')}>{t('careBack')}</Button>
      <header className="care-page__header">
        <div>
          <h2 className="care-page__title">{group.name}</h2>
          <p className="care-page__meta">
            {occupying} / {group.capacity} · {t('careGroupFill')}: {percent}% ·{' '}
            {t('careFreePlaces')}: {free}
          </p>
        </div>
        <div className="care-page__actions">
          {canManage ? (
            <>
              <Button onClick={() => setEditing(true)}>{t('edit')}</Button>
              <Button variant="primary" onClick={() => setAdding(true)}>
                {t('careQuickAddChild')}
              </Button>
            </>
          ) : null}
        </div>
      </header>
      {members.length === 0 ? (
        <div className="care-empty">
          <p className="care-dashboard__empty">{t('careChildrenEmpty')}</p>
          <p className="care-dashboard__muted">{t('careChildrenEmptyHint')}</p>
        </div>
      ) : (
        <ul className="care-cards care-cards--visible">
          {members.map((child) => {
            const mark = byChild.get(child.id)
            const age = childAgeYears(child.birthDate)
            return (
              <li key={child.id}>
                <button type="button" onClick={() => navigate(`/children/${child.id}`)}>
                  <strong>{childDisplayName(child)}</strong>
                  <span>
                    {child.birthDate}
                    {age !== undefined ? ` · ${age}` : ''} · {t(childStatusLabelKey(child.status))}
                  </span>
                  <span>
                    {mark === 'present'
                      ? t('carePresent')
                      : mark === 'absent'
                        ? t('careAbsent')
                        : t('careUnmarked')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {adding ? (
        <ChildForm
          groups={groups}
          defaultGroupId={group.id}
          onClose={() => setAdding(false)}
          onSave={(draft) => createChild({ ...draft, groupId: draft.groupId ?? group.id })}
        />
      ) : null}
      {editing ? (
        <GroupForm
          initial={group}
          onClose={() => setEditing(false)}
          onSave={(draft) => updateGroup(group.id, draft)}
        />
      ) : null}
    </section>
  )
}
