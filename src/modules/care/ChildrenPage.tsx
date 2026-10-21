import { useEffect, useMemo, useState } from 'react'
import { useAccess } from '../../app/context/access-context'
import { useCare } from '../../app/context/care-context'
import { useContacts } from '../../app/context/contact-context'
import { useLocalization } from '../../app/context/localization-context'
import { AuthRequiredState } from '../../app/components/AuthRequiredState'
import { useAppPath } from '../../app/routes/useAppPath'
import {
  childDisplayName,
  childOccupiesPlace,
  isChildAttendance,
  todayExpenseDateInput,
} from '../../core/services'
import { contactDisplayName } from '../crm/customers/customer-name'
import { Button, Input, Select, Table } from '../../shared/ui'
import { ChildForm } from './ChildForm'
import { childStatusLabelKey } from './child-status-label'
import { GroupForm } from './GroupForm'

function todayStatusLabel(
  status: 'present' | 'absent' | undefined,
  t: (key: 'carePresent' | 'careAbsent' | 'careUnmarked') => string,
) {
  if (status === 'present') return t('carePresent')
  if (status === 'absent') return t('careAbsent')
  return t('careUnmarked')
}

export function ChildrenPage() {
  const { t } = useLocalization()
  const { navigate, search } = useAppPath()
  const { currentUser, hasCareAccess } = useAccess()
  const { groups, childrenList, createChild, createGroup, listAttendance } = useCare()
  const { contacts } = useContacts()
  const params = new URLSearchParams(search)
  const canManage = hasCareAccess('children.manage')
  const [tab, setTab] = useState<'children' | 'groups'>(
    params.get('tab') === 'groups' ? 'groups' : 'children',
  )
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState(params.get('group') ?? '')
  const [statusFilter, setStatusFilter] = useState('')
  const [childForm, setChildForm] = useState(canManage && params.get('new') === '1')
  const [groupForm, setGroupForm] = useState<'new' | null>(null)
  const today = todayExpenseDateInput()
  const todayRecords = listAttendance(today)
  const byChild = useMemo(
    () =>
      new Map(
        todayRecords.filter(isChildAttendance).map((item) => [item.childId as string, item.status]),
      ),
    [todayRecords],
  )

  useEffect(() => {
    const next = new URLSearchParams(search)
    if (canManage && next.get('new') === '1') {
      setChildForm(true)
    }
    if (next.get('tab') === 'groups') {
      setTab('groups')
    }
    const group = next.get('group')
    if (group) {
      setGroupFilter(group)
    }
  }, [canManage, search])
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return childrenList.filter((child) => {
      if (groupFilter && child.groupId !== groupFilter) {
        return false
      }
      if (statusFilter && child.status !== statusFilter) {
        return false
      }
      if (!needle) {
        return true
      }
      const parent = child.parentContactId
        ? contacts.find((item) => item.id === child.parentContactId)
        : undefined
      const haystack =
        `${child.firstName} ${child.lastName} ${parent ? contactDisplayName(parent) : ''} ${parent?.phone ?? ''}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [childrenList, contacts, groupFilter, query, statusFilter])

  if (!currentUser) {
    return <AuthRequiredState />
  }

  return (
    <section className="workspace-page care-page">
      <header className="care-page__header">
        <div>
          <h2 className="care-page__title">{t('navChildren')}</h2>
        </div>
        <div className="care-page__actions">
          {canManage && tab === 'children' ? (
            <Button variant="primary" onClick={() => setChildForm(true)}>
              {t('careQuickAddChild')}
            </Button>
          ) : null}
          {canManage && tab === 'groups' ? (
            <Button variant="primary" onClick={() => setGroupForm('new')}>
              {t('careQuickCreateGroup')}
            </Button>
          ) : null}
        </div>
      </header>

      <div className="care-tabs">
        <button
          type="button"
          className={tab === 'children' ? 'care-tabs__btn care-tabs__btn--active' : 'care-tabs__btn'}
          onClick={() => setTab('children')}
        >
          {t('navChildren')}
        </button>
        <button
          type="button"
          className={tab === 'groups' ? 'care-tabs__btn care-tabs__btn--active' : 'care-tabs__btn'}
          onClick={() => setTab('groups')}
        >
          {t('careGroups')}
        </button>
      </div>

      {tab === 'children' ? (
        <>
          <div className="care-filters">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('careSearchChild')}
            />
            <Select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
              <option value="">{t('careAllGroups')}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">{t('careAllStatuses')}</option>
              <option value="attending">{t('careStatusAttending')}</option>
              <option value="temporarily_absent">{t('careStatusTemporarilyAbsent')}</option>
              <option value="withdrawn">{t('careStatusWithdrawn')}</option>
            </Select>
          </div>
          {filtered.length === 0 ? (
            <div className="care-empty">
              <p className="care-dashboard__empty">{t('careChildrenEmpty')}</p>
              <p className="care-dashboard__muted">{t('careChildrenEmptyHint')}</p>
              {canManage ? (
                <Button variant="primary" onClick={() => setChildForm(true)}>
                  {t('careQuickAddChild')}
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="care-table">
                <Table>
                  <thead>
                    <tr>
                      <th>{t('careChildName')}</th>
                      <th>{t('careGroup')}</th>
                      <th>{t('careBirthDate')}</th>
                      <th>{t('careParent')}</th>
                      <th>{t('phone')}</th>
                      <th>{t('status')}</th>
                      <th>{t('careTodayAttendance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((child) => {
                      const group = groups.find((item) => item.id === child.groupId)
                      const parent = child.parentContactId
                        ? contacts.find((item) => item.id === child.parentContactId)
                        : undefined
                      return (
                        <tr
                          key={child.id}
                          onClick={() => navigate(`/children/${child.id}`)}
                        >
                          <td>{childDisplayName(child)}</td>
                          <td>{group?.name ?? t('careNoGroup')}</td>
                          <td>{child.birthDate}</td>
                          <td>{parent ? contactDisplayName(parent) : '—'}</td>
                          <td>{parent?.phone ?? '—'}</td>
                          <td>{t(childStatusLabelKey(child.status))}</td>
                          <td>{todayStatusLabel(byChild.get(child.id), t)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </Table>
              </div>
              <ul className="care-cards">
                {filtered.map((child) => {
                  const group = groups.find((item) => item.id === child.groupId)
                  const parent = child.parentContactId
                    ? contacts.find((item) => item.id === child.parentContactId)
                    : undefined
                  return (
                    <li key={child.id}>
                      <button type="button" onClick={() => navigate(`/children/${child.id}`)}>
                        <strong>{childDisplayName(child)}</strong>
                        <span>
                          {group?.name ?? t('careNoGroup')} · {t(childStatusLabelKey(child.status))}
                        </span>
                        <span>
                          {parent ? contactDisplayName(parent) : t('careParentUnset')}
                          {parent?.phone ? ` · ${parent.phone}` : ''}
                        </span>
                        <span>{todayStatusLabel(byChild.get(child.id), t)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      ) : groups.length === 0 ? (
        <div className="care-empty">
          <p className="care-dashboard__empty">{t('careGroupsEmpty')}</p>
          <p className="care-dashboard__muted">{t('careGroupsEmptyHint')}</p>
          {canManage ? (
            <Button variant="primary" onClick={() => setGroupForm('new')}>
              {t('careQuickCreateGroup')}
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="care-group-board">
          {groups.map((group) => {
            const count = childrenList.filter(
              (child) => child.groupId === group.id && childOccupiesPlace(child),
            ).length
            const free = Math.max(0, group.capacity - count)
            const percent = group.capacity > 0 ? Math.round((count / group.capacity) * 100) : 0
            return (
              <li key={group.id}>
                <div>
                  <h3>{group.name}</h3>
                  <p>
                    {count} / {group.capacity} · {t('careFreePlaces')}: {free}
                  </p>
                  <div className="care-occupancy">
                    <span
                      style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                      data-tone={percent >= 100 ? 'danger' : percent >= 90 ? 'warn' : 'ok'}
                    />
                  </div>
                </div>
                <Button onClick={() => navigate(`/children/groups/${group.id}`)}>
                  {t('careOpen')}
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {childForm && canManage ? (
        <ChildForm
          groups={groups}
          defaultGroupId={groupFilter || undefined}
          onClose={() => setChildForm(false)}
          onSave={(draft) => createChild(draft)}
        />
      ) : null}
      {groupForm === 'new' ? (
        <GroupForm onClose={() => setGroupForm(null)} onSave={(draft) => createGroup(draft)} />
      ) : null}
    </section>
  )
}
