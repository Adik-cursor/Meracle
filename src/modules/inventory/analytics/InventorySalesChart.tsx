import { useLocalization } from '../../../app/context/localization-context'
import type { RevenuePoint } from './inventory-analytics'

type InventorySalesChartProps = {
  points: RevenuePoint[]
}

function formatDay(day: string, locale: string): string {
  const [year, month, date] = day.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, date))

  return parsed.toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  })
}

export function InventorySalesChart({ points }: InventorySalesChartProps) {
  const { locale, t } = useLocalization()
  const maxRevenue = Math.max(0, ...points.map((point) => point.revenue))

  return (
    <section className="settings-section analytics-block">
      <h2>{t('analyticsChart')}</h2>
      {points.length === 0 || maxRevenue === 0 ? (
        <p className="analytics-empty">{t('analyticsNoPeriodData')}</p>
      ) : (
        <div className="analytics-chart" role="img" aria-label={t('analyticsChart')}>
          {points.map((point) => {
            const height = Math.max(
              4,
              Math.round((point.revenue / maxRevenue) * 160),
            )

            return (
              <div key={point.day} className="analytics-chart__col">
                <span className="analytics-chart__value">
                  {point.revenue > 0 ? point.revenue : ''}
                </span>
                <div
                  className="analytics-chart__bar"
                  style={{ height: `${height}px` }}
                />
                <span className="analytics-chart__label">
                  {formatDay(point.day, locale)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
