import { createContext, useContext } from 'react'
import type { Locale } from '../../core/types'
import type { TranslationKey } from '../../core/localization/translations'

export type LocalizationContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey) => string
}

export const LocalizationContext =
  createContext<LocalizationContextValue | null>(null)

export function useLocalization(): LocalizationContextValue {
  const context = useContext(LocalizationContext)

  if (!context) {
    throw new Error('useLocalization must be used within LocalizationProvider')
  }

  return context
}
