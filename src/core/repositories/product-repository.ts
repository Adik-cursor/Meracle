import type { Product } from '../types'
import type { EntityRepository } from './entity-repository'

export type ProductRepository = EntityRepository<Product>
