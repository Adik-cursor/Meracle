export const KINDERGARTEN_JOB_TITLES = [
  'Заведующий',
  'Воспитатель',
  'Няня',
  'Повар',
  'Помощник повара',
  'Техничка',
] as const

export type KindergartenJobTitle = (typeof KINDERGARTEN_JOB_TITLES)[number]

const CARE_GROUP_REQUIRED_TITLES = new Set<string>(['Воспитатель', 'Няня'])

export function isKindergartenJobTitle(value: string): value is KindergartenJobTitle {
  return (KINDERGARTEN_JOB_TITLES as readonly string[]).includes(value)
}

export function kindergartenJobRequiresCareGroup(
  jobTitle: string | undefined,
): boolean {
  return Boolean(jobTitle && CARE_GROUP_REQUIRED_TITLES.has(jobTitle))
}

export function kindergartenJobHasAccount(jobTitle: string | undefined): boolean {
  return jobTitle === 'Заведующий'
}
