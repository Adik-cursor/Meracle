import type { TranslationKey } from '../../../core/localization/translations'
import type { KindergartenJobTitle } from '../../../core/config/kindergarten-job-titles'

export const KINDERGARTEN_JOB_TITLE_LABEL_KEY: Record<
  KindergartenJobTitle,
  TranslationKey
> = {
  Заведующий: 'jobTitleKindergartenDirector',
  Воспитатель: 'jobTitleKindergartenEducator',
  Няня: 'jobTitleKindergartenNanny',
  Повар: 'jobTitleKindergartenCook',
  'Помощник повара': 'jobTitleKindergartenCookHelper',
  Техничка: 'jobTitleKindergartenCleaner',
}
