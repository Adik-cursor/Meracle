import { useOrganization } from '../../context/organization-context'
import { useLocalization } from '../../context/localization-context'
import { ProductCategoryManager } from '../../../modules/inventory/components/ProductCategoryManager'
import { getRouteByPath, isRouteEnabled } from '../app.routes'

type SettingsPageProps = {
  pathname: string
  onNavigate: (path: string) => void
}

export function SettingsPage(_props: SettingsPageProps) {
  const { modules, settings } = useOrganization()
  const { locale, setLocale, t } = useLocalization()
  const productsRoute = getRouteByPath('/products')
  const showProductCategories = productsRoute
    ? isRouteEnabled(productsRoute, modules)
    : false

  return (
    <section className="workspace-page settings-page">
      <section className="settings-section">
        <h2>{t('settingsGeneral')}</h2>
        <div className="settings-fields">
          <label className="settings-field">
            <span className="settings-field__label">{t('interfaceLanguage')}</span>
            <select
              className="warehouse-input settings-field__control"
              value={locale}
              onChange={(event) =>
                setLocale(event.target.value === 'kk' ? 'kk' : 'ru')
              }
            >
              <option value="ru">{t('languageRussian')}</option>
              <option value="kk">{t('languageKazakh')}</option>
            </select>
          </label>
          <div className="settings-field">
            <span className="settings-field__label">{t('timezone')}</span>
            <span className="settings-field__value">{settings.timezone}</span>
          </div>
          <div className="settings-field">
            <span className="settings-field__label">{t('currency')}</span>
            <span className="settings-field__value">{settings.currency}</span>
          </div>
        </div>
      </section>
      {showProductCategories ? (
        <section className="settings-section">
          <h2>{t('productCategories')}</h2>
          <ProductCategoryManager />
        </section>
      ) : null}
    </section>
  )
}
