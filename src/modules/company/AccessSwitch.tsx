import { useLocalization } from '../../app/context/localization-context'

type AccessSwitchProps = {
  on: boolean
  disabled?: boolean
  label: string
  onToggle?: (next: boolean) => void
}

export function AccessSwitch({ on, disabled, label, onToggle }: AccessSwitchProps) {
  const { t } = useLocalization()
  const text = on ? t('permissionOn') : t('permissionOff')

  return (
    <button
      type="button"
      className={
        on
          ? 'module-switch module-switch--on access-switch'
          : 'module-switch access-switch'
      }
      role="switch"
      aria-checked={on}
      aria-label={`${label}: ${text}`}
      disabled={disabled}
      onClick={() => {
        if (disabled || !onToggle) {
          return
        }
        onToggle(!on)
      }}
    >
      {text}
    </button>
  )
}
