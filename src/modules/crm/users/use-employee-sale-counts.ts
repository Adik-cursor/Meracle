import { countSalesByCashierForUser } from '../../../core/services'
import { useAccess } from '../../../app/context/access-context'
import { usePersistence, usePersistenceVersion } from '../../../app/context/persistence-context'

export function useEmployeeSaleCounts() {
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  void version
  const result = countSalesByCashierForUser(persistence, currentUser)
  return result.ok ? result.value : {}
}
