import { useEffect, useMemo, type ReactNode } from 'react'
import { translate } from '../../core/localization/translations'
import { useOrganization } from './organization-context'
import {
  LocalizationContext,
  type LocalizationContextValue,
} from './localization-context'

type LocalizationProviderProps = {
  children: ReactNode
}

export function LocalizationProvider({ children }: LocalizationProviderProps) {
  const { locale, setLocale } = useOrganization()

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<LocalizationContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => translate(locale, key),
    }),
    [locale, setLocale],
  )

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  )
}
