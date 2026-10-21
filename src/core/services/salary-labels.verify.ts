import { translations } from '../localization/translations'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runSalaryLabelsChecks(): void {
  assert(translations.compensationTitle.ru === 'Зарплата', 'ru salary title')
  assert(translations.compensationTitle.kk === 'Жалақы', 'kk salary title')
  assert(translations.compensationPeriodHeading.ru.startsWith('Зарплата'), 'period heading')
  assert(!translations.compensationTitle.ru.includes('Вознаграждение'), 'no old term')
  assert(translations.compensationPayoutSalary.ru === 'Зарплата', 'payout type')
  assert(translations.employeeSalary.ru === 'Оклад', 'oklad kept')
  console.log('salary-labels.verify: ok')
}

runSalaryLabelsChecks()
