import type { Expense } from '../types'
import type { ListedEntityRepository } from './entity-repository'

export type ExpenseRepository = ListedEntityRepository<Expense>
