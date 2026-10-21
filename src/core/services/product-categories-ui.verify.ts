import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runProductCategoriesUiChecks(): void {
  const page = readFileSync(join(root, 'src/app/routes/pages/ProductsPage.tsx'), 'utf8')
  const settings = readFileSync(join(root, 'src/app/routes/pages/SettingsPage.tsx'), 'utf8')
  assert(!page.includes('settings-section'), 'no always-on category block')
  assert(page.includes('setCategoriesOpen'), 'categories action')
  assert(page.includes('ProductCategoryManager'), 'manager reused')
  assert(page.includes("t('nomenclatureAll')"), 'type filters kept')
  assert(settings.includes('ProductCategoryManager'), 'settings categories')
  console.log('product-categories-ui.verify: ok')
}

runProductCategoriesUiChecks()
