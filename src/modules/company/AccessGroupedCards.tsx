import { useLocalization } from '../../app/context/localization-context'
import { AccessSwitch } from './AccessSwitch'
import {
  ACCESS_GROUP_LABEL,
  ACCESS_GROUP_ORDER,
  type AccessUiGroup,
} from './permission-ui'

export type AccessRow = {
  id: string
  group: AccessUiGroup
  label: string
  description?: string
  on: boolean
  disabled?: boolean
  mark?: 'on' | 'off'
  onToggle?: (next: boolean) => void
}

type AccessGroupedCardsProps = {
  rows: readonly AccessRow[]
  mode?: 'switch' | 'marks'
  compact?: boolean
}

export function AccessGroupedCards({
  rows,
  mode = 'switch',
  compact = false,
}: AccessGroupedCardsProps) {
  const { t } = useLocalization()
  const groups = ACCESS_GROUP_ORDER.filter((group) =>
    rows.some((row) => row.group === group),
  )

  if (groups.length === 0) {
    return <p>—</p>
  }

  return (
    <div className={compact ? 'access-grid access-grid--compact' : 'access-grid'}>
      {groups.map((group) => (
        <section className="settings-section access-card" key={group}>
          <h3 className="access-card__title">{t(ACCESS_GROUP_LABEL[group])}</h3>
          <div className="module-list">
            {rows
              .filter((row) => row.group === group)
              .map((row) => (
                <div className="module-row access-row" key={row.id}>
                  <div className="module-row__info">
                    <p className="module-row__title">{row.label}</p>
                    {row.description ? (
                      <p className="module-row__description">{row.description}</p>
                    ) : null}
                  </div>
                  {mode === 'marks' ? (
                    <span
                      className={
                        row.mark === 'on' || row.on
                          ? 'access-mark access-mark--on'
                          : 'access-mark access-mark--off'
                      }
                    >
                      {row.mark === 'on' || row.on ? '✓' : '✗'}
                    </span>
                  ) : (
                    <AccessSwitch
                      on={row.on}
                      disabled={row.disabled}
                      label={row.label}
                      onToggle={row.onToggle}
                    />
                  )}
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
