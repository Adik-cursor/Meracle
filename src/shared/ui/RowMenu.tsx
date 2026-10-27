import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type RowMenuItem = {
  id: string
  label: string
  onSelect: () => void
  danger?: boolean
}

type RowMenuProps = {
  label: string
  items: RowMenuItem[]
}

export function RowMenu({ label, items }: RowMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const updatePosition = () => {
      const trigger = rootRef.current?.querySelector<HTMLButtonElement>('.row-menu__trigger')
      const panel = panelRef.current
      if (!trigger || !panel) return

      const triggerRect = trigger.getBoundingClientRect()
      const panelWidth = Math.min(panel.offsetWidth, window.innerWidth - 16)
      const left = Math.max(8, Math.min(triggerRect.right - panelWidth, window.innerWidth - panelWidth - 8))
      const below = window.innerHeight - triggerRect.bottom - 8
      const top = panel.offsetHeight <= below
        ? triggerRect.bottom + 4
        : Math.max(8, triggerRect.top - panel.offsetHeight - 4)
      setPosition({ top, left })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (items.length === 0) {
    return null
  }

  return (
    <div className="row-menu" ref={rootRef}>
      <button
        type="button"
        className="btn btn--ghost row-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open ? createPortal(
        <div
          ref={panelRef}
          className="row-menu__panel"
          id={menuId}
          role="menu"
          style={position ? { top: position.top, left: position.left } : { visibility: 'hidden' }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={item.danger ? 'row-menu__item row-menu__item--danger' : 'row-menu__item'}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
