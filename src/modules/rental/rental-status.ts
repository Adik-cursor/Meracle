import type { TranslationKey } from '../../core/localization/translations'
import type { RentalBookingRead } from '../../core/services'

export function rentalStatusLabelKey(
  booking: Pick<RentalBookingRead, 'status' | 'viewStatus'>,
): TranslationKey {
  if (booking.viewStatus === 'overdue') {
    return 'rentalOverdue'
  }
  if (booking.viewStatus === 'active') {
    return 'rentalInUse'
  }
  if (booking.status === 'draft') {
    return 'rentalStatusDraft'
  }
  if (booking.status === 'reserved') {
    return 'rentalStatusReserved'
  }
  if (booking.status === 'issued') {
    return 'rentalIssued'
  }
  if (booking.status === 'returned') {
    return 'rentalReturned'
  }
  if (booking.status === 'cancelled') {
    return 'rentalStatusCancelled'
  }
  return 'rentalStatus'
}

export function rentalWhatsAppHref(phone: string): string | undefined {
  let digits = phone.replace(/\D/g, '')
  if (!digits) {
    return undefined
  }
  if (digits.length === 11 && digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`
  }
  return `https://wa.me/${digits}`
}
