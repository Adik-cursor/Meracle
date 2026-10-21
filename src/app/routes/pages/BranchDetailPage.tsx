import { useAccess } from '../../context/access-context'
import { useBranches } from '../../context/branch-context'
import { useDepartments } from '../../context/department-context'
import { useLocalization } from '../../context/localization-context'
import { useUsers } from '../../context/user-context'
import { useAppPath } from '../useAppPath'
import { getBranchIdFromPath } from '../app.routes'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'
import { Badge, Button, PageHeader } from '../../../shared/ui'

export function BranchDetailPage() {
  const { t } = useLocalization()
  const { pathname, navigate } = useAppPath()
  const { currentUser } = useAccess()
  const { getBranchAccess } = useBranches()
  const { departments } = useDepartments()
  const { users } = useUsers()
  const branchId = getBranchIdFromPath(pathname)

  if (!currentUser) {
    return <AuthRequiredState />
  }

  if (!branchId) {
    return (
      <PagePlaceholder
        title={t('pageNotFound')}
        description={t('pageNotFoundDescription')}
      />
    )
  }

  const access = getBranchAccess(branchId)
  if (!access.ok) {
    if (access.code === 'BRANCH_NOT_FOUND') {
      return (
        <PagePlaceholder
          title={t('pageNotFound')}
          description={t('pageNotFoundDescription')}
        />
      )
    }

    return (
      <PagePlaceholder title={t('ACCESS_DENIED')} description={t('ACCESS_DENIED')} />
    )
  }

  const branch = access.branch
  const employeeCount = users.filter((user) => user.branchId === branch.id).length
  const departmentCount = departments.filter((department) => department.branchId === branch.id).length
  const director = users.find(
    (user) => user.branchId === branch.id && user.role === 'branch_director',
  )

  return (
    <section className="workspace-page branch-detail-page">
      <PageHeader
        eyebrow={t('navBranches')}
        title={branch.name}
        actions={<Button onClick={() => navigate('/company/branches')}>{t('navBranches')}</Button>}
      />
      <section className="branch-detail-card" aria-label={branch.name}>
        <dl className="branch-detail-grid">
          <div className="branch-detail-fact">
            <dt>{t('code')}</dt>
            <dd>{branch.code ?? '—'}</dd>
          </div>
          <div className="branch-detail-fact">
            <dt>{t('branchAddress')}</dt>
            <dd>—</dd>
          </div>
          <div className="branch-detail-fact branch-detail-fact--wide">
            <dt>{t('branchManager')}</dt>
            <dd>{director ? `${director.firstName} ${director.lastName}` : '—'}</dd>
          </div>
          <div className="branch-detail-fact branch-detail-fact--count">
            <dt>{t('navEmployees')}</dt>
            <dd>{employeeCount}</dd>
          </div>
          <div className="branch-detail-fact branch-detail-fact--count">
            <dt>{t('navDepartments')}</dt>
            <dd>{departmentCount}</dd>
          </div>
          <div className="branch-detail-fact">
            <dt>{t('status')}</dt>
            <dd>
              <Badge tone={branch.status === 'active' ? 'success' : 'neutral'}>
                {t(branch.status === 'active' ? 'active' : 'inactive')}
              </Badge>
            </dd>
          </div>
        </dl>
      </section>
    </section>
  )
}
