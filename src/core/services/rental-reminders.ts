import type { Id, IsoDateTime, User } from '../types'
import { ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { nowIso } from './primitives'
import type { RentalBookingRead } from './rental-bookings'
import { listRentalBookingsForUser } from './rental-bookings'

export type RentalReminderKind =
  | 'issue_today'
  | 'return_today'
  | 'issue_tomorrow'
  | 'return_tomorrow'
  | 'overdue'

export type RentalReminder = {
  kind: RentalReminderKind
  booking: RentalBookingRead
}

function dayKey(iso: IsoDateTime, timeZone?: string): string {
  if (!timeZone) {
    return iso.slice(0, 10)
  }

  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

function addUtcDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function listRentalRemindersForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  at: IsoDateTime = nowIso(),
  timeZone?: string,
): ServiceResult<RentalReminder[]> {
  const listed = listRentalBookingsForUser(
    persistence,
    currentUser,
    organizationId,
    at,
  )
  if (!listed.ok) {
    return listed
  }

  const today = dayKey(at, timeZone)
  const tomorrow = addUtcDays(today, 1)
  const reminders: RentalReminder[] = []

  for (const booking of listed.value) {
    const startDay = dayKey(booking.startAt, timeZone)
    const endDay = dayKey(booking.endAt, timeZone)

    if (booking.status === 'reserved' && startDay === today) {
      reminders.push({ kind: 'issue_today', booking })
    }
    if (booking.status === 'issued' && endDay === today) {
      reminders.push({ kind: 'return_today', booking })
    }
    if (booking.status === 'reserved' && startDay === tomorrow) {
      reminders.push({ kind: 'issue_tomorrow', booking })
    }
    if (booking.status === 'issued' && endDay === tomorrow) {
      reminders.push({ kind: 'return_tomorrow', booking })
    }
    if (booking.viewStatus === 'overdue') {
      reminders.push({ kind: 'overdue', booking })
    }
  }

  return ok(reminders)
}
