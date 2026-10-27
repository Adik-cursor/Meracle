import type { CareGroup, Child, Contact, Customer, Deal } from '../../../core/types'
import { useLocalization } from '../../../app/context/localization-context'
import { Button, Table } from '../../../shared/ui'
import { contactDisplayName, getCustomerDisplayName } from './customer-name'
import { inquiryDisplayTitle } from '../deals/inquiry-types'

type ParentListProps = {
  customers: Customer[]
  contacts: Contact[]
  childrenList: Child[]
  groups: CareGroup[]
  deals: Deal[]
  onEdit: (customer: Customer) => void
  onOpenChild: (childId: string) => void
  onOpenInquiry: (dealId: string) => void
}

function latestDealForContact(deals: Deal[], contactId: string | undefined): Deal | undefined {
  if (!contactId) {
    return undefined
  }
  return deals
    .filter((deal) => deal.contactId === contactId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

export function ParentList({
  customers,
  contacts,
  childrenList,
  groups,
  deals,
  onEdit,
  onOpenChild,
  onOpenInquiry,
}: ParentListProps) {
  const { t, locale } = useLocalization()
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'
  const parents = customers.filter((customer) => customer.type === 'contact')

  return (
    <Table mobileLayout="cards">
      <thead>
        <tr>
          <th>{t('inquiryParent')}</th>
          <th>{t('inquiryPhone')}</th>
          <th>{t('inquiryChild')}</th>
          <th>{t('inquiryGroup')}</th>
          <th>{t('status')}</th>
          <th>{t('lastInquiry')}</th>
          <th>{t('platformActionColumn')}</th>
        </tr>
      </thead>
      <tbody>
        {parents.map((customer) => {
          const contact = customer.contactId
            ? contacts.find((item) => item.id === customer.contactId)
            : undefined
          const linkedChildren = childrenList.filter(
            (child) =>
              child.parentCustomerId === customer.id ||
              (customer.contactId && child.parentContactId === customer.contactId),
          )
          const firstChild = linkedChildren[0]
          const group = firstChild?.groupId
            ? groups.find((item) => item.id === firstChild.groupId)
            : undefined
          const lastDeal = latestDealForContact(deals, customer.contactId)

          return (
            <tr key={customer.id}>
              <td>
                {contact
                  ? contactDisplayName(contact)
                  : getCustomerDisplayName(customer, contacts, [])}
              </td>
              <td>{contact?.phone?.trim() || '—'}</td>
              <td>
                {linkedChildren.length === 0
                  ? '—'
                  : linkedChildren
                      .map((child) => `${child.firstName} ${child.lastName}`.trim())
                      .join(', ')}
              </td>
              <td>{group?.name ?? '—'}</td>
              <td>{customer.status === 'active' ? t('active') : t('inactive')}</td>
              <td>
                {lastDeal
                  ? `${inquiryDisplayTitle(lastDeal.title, t)} · ${new Date(lastDeal.createdAt).toLocaleDateString(numberLocale)}`
                  : '—'}
              </td>
              <td>
                <div className="warehouse-card__actions">
                  <Button onClick={() => onEdit(customer)}>{t('edit')}</Button>
                  {firstChild ? (
                    <Button onClick={() => onOpenChild(firstChild.id)}>{t('openChild')}</Button>
                  ) : null}
                  {lastDeal ? (
                    <Button onClick={() => onOpenInquiry(lastDeal.id)}>{t('openInquiry')}</Button>
                  ) : null}
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}
