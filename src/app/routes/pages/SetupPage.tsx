import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../context/auth-context'
import { useLocalization } from '../../context/localization-context'
import { useUsers } from '../../context/user-context'
import { useAppPath } from '../useAppPath'
import { Button, EmptyState } from '../../../shared/ui'

export function SetupPage() {
  const { t } = useLocalization()
  const { currentUser, login, isInitializing } = useAuth()
  const { hasOrganizationUsers, createFirstOwner } = useUsers()
  const { navigate } = useAppPath()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [firstNameError, setFirstNameError] = useState(false)
  const [lastNameError, setLastNameError] = useState(false)
  const [emailError, setEmailError] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  useEffect(() => {
    if (currentUser) {
      navigate('/')
    }
  }, [currentUser, navigate])

  if (isInitializing || currentUser) {
    return null
  }

  if (hasOrganizationUsers) {
    return (
      <section className="workspace-page">
        <EmptyState
          title={t('setupOwnerExists')}
          action={
            <Button variant="primary" onClick={() => navigate('/login')}>
              {t('setupGoToLogin')}
            </Button>
          }
        />
      </section>
    )
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nextFirstNameError = !firstName.trim()
    const nextLastNameError = !lastName.trim()
    const nextEmailError = !email.trim() || !email.includes('@')
    setFirstNameError(nextFirstNameError)
    setLastNameError(nextLastNameError)
    setEmailError(nextEmailError)
    setSubmitError(false)

    if (nextFirstNameError || nextLastNameError || nextEmailError) {
      return
    }

    const created = createFirstOwner({ firstName, lastName, email })
    if (!created.ok) {
      setSubmitError(true)
      return
    }

    const signedIn = login(created.value.id)
    if (!signedIn.ok) {
      setSubmitError(true)
      return
    }

    navigate('/')
  }

  return (
    <section className="workspace-page">
      <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
        <h2>{t('setupTitle')}</h2>
        <p className="empty-state__text">{t('setupDescription')}</p>

        <label className="warehouse-field">
          <span className="settings-field__label">{t('setupOwnerName')}</span>
          <input
            className="warehouse-input"
            type="text"
            name="firstName"
            value={firstName}
            onChange={(event) => {
              setFirstName(event.target.value)
              if (firstNameError) {
                setFirstNameError(false)
              }
            }}
            aria-invalid={firstNameError ? true : undefined}
          />
          {firstNameError ? (
            <span className="warehouse-field__error">{t('firstNameRequired')}</span>
          ) : null}
        </label>

        <label className="warehouse-field">
          <span className="settings-field__label">{t('setupOwnerLastName')}</span>
          <input
            className="warehouse-input"
            type="text"
            name="lastName"
            value={lastName}
            onChange={(event) => {
              setLastName(event.target.value)
              if (lastNameError) {
                setLastNameError(false)
              }
            }}
            aria-invalid={lastNameError ? true : undefined}
          />
          {lastNameError ? (
            <span className="warehouse-field__error">{t('lastNameRequired')}</span>
          ) : null}
        </label>

        <label className="warehouse-field">
          <span className="settings-field__label">{t('setupOwnerEmail')}</span>
          <input
            className="warehouse-input"
            type="email"
            name="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (emailError) {
                setEmailError(false)
              }
            }}
            aria-invalid={emailError ? true : undefined}
          />
          {emailError ? (
            <span className="warehouse-field__error">{t('emailRequired')}</span>
          ) : null}
        </label>

        {submitError ? (
          <p className="warehouse-field__error">{t('loginFailed')}</p>
        ) : null}

        <div className="warehouse-form__actions">
          <Button variant="primary" type="submit">
            {t('setupCreateOwner')}
          </Button>
        </div>
      </form>
    </section>
  )
}
