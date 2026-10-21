import {
  downloadExcelFile,
} from '../../core/utils/excel-workbook'
import {
  exportExcelDatasetForUser,
  type ExcelDataset,
} from '../../core/services'
import { useAccess } from '../../app/context/access-context'
import { useLocalization } from '../../app/context/localization-context'
import { usePersistence } from '../../app/context/persistence-context'
import { Button } from '../ui'

type ExcelExportButtonProps = {
  dataset: ExcelDataset
  filename?: string
}

export function ExcelExportButton({ dataset, filename }: ExcelExportButtonProps) {
  const { t } = useLocalization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()

  const handleClick = () => {
    const result = exportExcelDatasetForUser(persistence, currentUser, dataset)
    if (!result.ok) {
      return
    }
    downloadExcelFile(filename ?? result.value.filename, result.value.bytes)
  }

  return (
    <Button onClick={handleClick}>{t('exportExcel')}</Button>
  )
}
