import { useMemo, type ReactNode } from 'react'
import type { Id, ProductStatus } from '../../core/types'
import {
  createProductForUser,
  listProductsForUser,
  setProductStatusForUser,
  updateProductForUser,
} from '../../core/services'
import type { ProductDraft } from '../../modules/inventory/product.types'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import { ProductContext, type ProductContextValue } from './product-context'

type ProductProviderProps = {
  children: ReactNode
}

export function ProductProvider({ children }: ProductProviderProps) {
  const { organization } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<ProductContextValue>(() => {
    void version
    const listed = listProductsForUser(persistence, currentUser)

    return {
      products: listed.ok ? listed.value : [],
      createProduct: (draft: ProductDraft) =>
        createProductForUser(persistence, currentUser, organization.id, draft)
          .ok,
      updateProduct: (id: Id, draft: ProductDraft) =>
        updateProductForUser(
          persistence,
          currentUser,
          organization.id,
          id,
          draft,
        ).ok,
      setProductStatus: (id: Id, status: ProductStatus) => {
        setProductStatusForUser(
          persistence,
          currentUser,
          organization.id,
          id,
          status,
        )
      },
    }
  }, [currentUser, organization.id, persistence, version])

  return (
    <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
  )
}
