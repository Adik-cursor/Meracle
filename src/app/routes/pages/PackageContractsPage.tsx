import { useMemo } from 'react'
import { useAccess } from '../../context/access-context'
import { useLocalization } from '../../context/localization-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { Badge, Button, EmptyState } from '../../../shared/ui'
import { ExcelExportButton } from '../../../shared/components/ExcelExportButton'
import { listPackageContractsForUser } from '../../../core/services'
import { useAppPath } from '../useAppPath'

export function PackageContractsPage() {
  const { t } = useLocalization()
  const { navigate } = useAppPath()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const rows = useMemo(() => {
    void version
    const listed = listPackageContractsForUser(persistence, currentUser)
    return listed.ok ? listed.value : []
  }, [currentUser, persistence, version])

  if (!currentUser) {
    return <AuthRequiredState />
  }

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">{t('packagesContracts')}</h2>
        <Button onClick={() => navigate('/packages')}>{t('packagesAll')}</Button>
        <ExcelExportButton dataset="package_contracts" />
      </div>
      <div className="inline-notice">{t('contractTemplatePlaceholder')}</div>
      {rows.length === 0 ? (
        <EmptyState title={t('noContracts')} />
      ) : (
        <table className="inventory-table">
          <thead>
            <tr>
              <th>{t('contractNumber')}</th>
              <th>{t('contractDate')}</th>
              <th>{t('status')}</th>
              <th>{t('packageName')}</th>
              <th>{t('customer')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.contract.id}>
                <td>{row.contract.contractNumber}</td>
                <td>{row.contract.contractDate}</td>
                <td>
                  <Badge
                    tone={
                      row.contract.status === 'signed'
                        ? 'success'
                        : row.contract.status === 'cancelled'
                          ? 'danger'
                          : row.contract.status === 'issued'
                            ? 'info'
                            : 'neutral'
                    }
                  >
                    {t(
                      row.contract.status === 'signed'
                        ? 'contractStatusSigned'
                        : row.contract.status === 'issued'
                          ? 'invoiceStatusIssued'
                          : row.contract.status === 'cancelled'
                            ? 'transferStatusCancelled'
                            : 'transferStatusDraft',
                    )}
                  </Badge>
                </td>
                <td>{row.packageName}</td>
                <td>{row.customerName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
