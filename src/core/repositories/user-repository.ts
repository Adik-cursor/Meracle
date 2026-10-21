import type { User } from '../types'
import type { EntityRepository } from './entity-repository'

export type UserRepository = EntityRepository<User>
