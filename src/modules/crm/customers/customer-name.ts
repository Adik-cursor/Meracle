import type { Company, Contact, Customer } from '../../../core/types'

export function contactDisplayName(contact: Contact): string {
  return `${contact.firstName} ${contact.lastName}`.trim()
}

export function getCustomerDisplayName(
  customer: Customer,
  contacts: Contact[],
  companies: Company[],
): string {
  if (customer.type === 'contact' && customer.contactId) {
    const contact = contacts.find((item) => item.id === customer.contactId)
    return contact ? contactDisplayName(contact) : customer.contactId
  }

  if (customer.type === 'company' && customer.companyId) {
    const company = companies.find((item) => item.id === customer.companyId)
    return company ? company.name : customer.companyId
  }

  return customer.id
}
