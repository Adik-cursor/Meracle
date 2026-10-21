import type { TranslationKey } from '../../core/localization/translations'

export const BUSINESS_TYPE_LABEL_KEY: Record<string, TranslationKey> = {
  universal: 'businessTypeUniversal',
  dental: 'businessTypeDental',
  costume_rental: 'businessTypeCostumeRental',
  kindergarten: 'businessTypeKindergarten',
  auto_service: 'businessTypeAutoService',
}

export function businessTypeLabelKey(id: string): TranslationKey | undefined {
  return BUSINESS_TYPE_LABEL_KEY[id]
}
