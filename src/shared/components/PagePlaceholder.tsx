import type { PageMeta } from '../../core/types/common'

type PagePlaceholderProps = PageMeta

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">{title}</h2>
      </div>
      {description ? <p className="workspace-muted">{description}</p> : null}
    </section>
  )
}
