import { downloadExcelFile } from '../../core/utils/excel-workbook'
import {
  exportExcelSheetsForUser,
} from '../../core/services'
import type { ExcelSheet } from '../../core/utils/excel-workbook'
import { useAccess } from '../../app/context/access-context'
import { useLocalization } from '../../app/context/localization-context'
import { usePersistence } from '../../app/context/persistence-context'
import { Button } from '../ui'

type WorkbookExportButtonProps = {
  filename: string
  sheets: ExcelSheet[]
}

export function WorkbookExportButton({ filename, sheets }: WorkbookExportButtonProps) {
  const { t } = useLocalization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()

  return (
    <Button
      onClick={() => {
        const result = exportExcelSheetsForUser(persistence, currentUser, filename, sheets)
        if (!result.ok) {
          return
        }
        downloadExcelFile(result.value.filename, result.value.bytes)
      }}
    >
      {t('exportExcel')}
    </Button>
  )
}
