import type { TranslationKey } from '../../../core/localization/translations'

export const KINDERGARTEN_INQUIRY_TITLE_KEYS = [
  'inquiryEnrollment',
  'inquiryGroupQuestion',
  'inquiryPlaces',
  'inquiryPrice',
  'inquiryDocuments',
  'inquiryTransfer',
  'inquiryOther',
] as const

export type KindergartenInquiryTitleKey = (typeof KINDERGARTEN_INQUIRY_TITLE_KEYS)[number]

export const KINDERGARTEN_TASK_TITLE_KEYS = [
  'taskCallParent',
  'taskClarifyDocs',
  'taskCheckPlace',
  'taskContactPayment',
  'taskInformDirector',
] as const

const INQUIRY_KEY_SET = new Set<string>(KINDERGARTEN_INQUIRY_TITLE_KEYS)

export function isInquiryTitleKey(value: string): value is KindergartenInquiryTitleKey {
  return INQUIRY_KEY_SET.has(value)
}

export function inquiryDisplayTitle(
  title: string,
  t: (key: TranslationKey) => string,
): string {
  return isInquiryTitleKey(title) ? t(title) : title
}
