import type { ReactNode } from 'react'
import type { RentalBookingRead } from '../../core/services'
import {
  addDays,
  bookingTouchesDay,
  dayKey,
  daysInMonth,
  startOfMonth,
  startOfWeek,
} from './rental-datetime'

type CalendarMode = 'day' | 'week' | 'month'

type RentalCalendarProps = {
  mode: CalendarMode
  cursorDay: string
  bookings: RentalBookingRead[]
  onSelect: (bookingId: string) => void
  labelFor: (booking: RentalBookingRead) => ReactNode
  locale: 'ru' | 'kk'
  timeZone?: string
}

function tone(booking: RentalBookingRead): string {
  if (booking.status === 'cancelled') {
    return 'rental-cal__event rental-cal__event--cancelled'
  }
  if (booking.viewStatus === 'overdue') {
    return 'rental-cal__event rental-cal__event--overdue'
  }
  if (booking.status === 'issued' || booking.viewStatus === 'active') {
    return 'rental-cal__event rental-cal__event--issued'
  }
  if (booking.status === 'reserved') {
    return 'rental-cal__event rental-cal__event--reserved'
  }
  if (booking.status === 'returned') {
    return 'rental-cal__event rental-cal__event--returned'
  }
  return 'rental-cal__event'
}

function weekdayLabel(day: string, locale: 'ru' | 'kk'): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(
    locale === 'kk' ? 'kk-KZ' : 'ru-RU',
    { weekday: 'short' },
  )
}

export function RentalCalendar({
  mode,
  cursorDay,
  bookings,
  onSelect,
  labelFor,
  locale,
  timeZone,
}: RentalCalendarProps) {
  const days: string[] = []

  if (mode === 'day') {
    days.push(cursorDay)
  } else if (mode === 'week') {
    const start = startOfWeek(cursorDay)
    for (let index = 0; index < 7; index += 1) {
      days.push(addDays(start, index))
    }
  } else {
    const monthStart = startOfMonth(cursorDay)
    const lead = new Date(`${monthStart}T00:00:00`).getDay()
    const mondayLead = lead === 0 ? 6 : lead - 1
    const gridStart = addDays(monthStart, -mondayLead)
    const count = Math.ceil((mondayLead + daysInMonth(cursorDay)) / 7) * 7
    for (let index = 0; index < count; index += 1) {
      days.push(addDays(gridStart, index))
    }
  }

  const weekdays = mode === 'day' ? [] : days.slice(0, 7)

  return (
    <div className={`rental-cal rental-cal--${mode}`}>
      {weekdays.map((day) => (
        <p key={`wd-${day}`} className="rental-cal__weekday">
          {weekdayLabel(day, locale)}
        </p>
      ))}
      {days.map((day) => {
        const items = bookings.filter(
          (booking) =>
            booking.status !== 'draft' &&
            bookingTouchesDay(booking.startAt, booking.endAt, day, timeZone),
        )
        return (
          <div
            key={day}
            className={[
              'rental-cal__day',
              dayKey(day) === cursorDay ? 'rental-cal__day--on' : '',
              mode === 'month' && day.slice(0, 7) !== cursorDay.slice(0, 7)
                ? 'rental-cal__day--outside'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <p className="rental-cal__date">{day.slice(8, 10)}</p>
            {items.map((booking) => (
              <button
                key={booking.id}
                type="button"
                className={tone(booking)}
                onClick={() => onSelect(booking.id)}
              >
                {labelFor(booking)}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}
