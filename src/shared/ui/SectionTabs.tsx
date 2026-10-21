type SectionTab = {
  id: string
  label: string
  groupLabel?: string
}

type SectionTabsProps = {
  label: string
  tabs: SectionTab[]
  activeId: string
  onSelect: (id: string) => void
}

export function SectionTabs({ label, tabs, activeId, onSelect }: SectionTabsProps) {
  return (
    <nav className="workspace-tabs section-tabs" aria-label={label}>
      {tabs.map((tab) => (
        <div key={tab.id} className="workspace-tabs__cluster">
          {tab.groupLabel ? (
            <span className="workspace-tabs__group">{tab.groupLabel}</span>
          ) : null}
          <button
            type="button"
            className={
              tab.id === activeId ? 'workspace-tab workspace-tab--active' : 'workspace-tab'
            }
            aria-current={tab.id === activeId ? 'page' : undefined}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </button>
        </div>
      ))}
    </nav>
  )
}
