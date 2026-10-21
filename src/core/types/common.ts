export type Id = string

export type IsoDateTime = string

export type Nullable<T> = T | null

export type PageMeta = {
  title: string
  description?: string
}

export type BaseEntity = {
  id: Id
  organizationId: Id
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}
