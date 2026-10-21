import type { Expense } from '../types'
import type { EntityRepository } from './entity-repository'

export type ExpenseRepository = EntityRepository<Expense>
