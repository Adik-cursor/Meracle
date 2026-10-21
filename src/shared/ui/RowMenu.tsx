import { useEffect, useId, useRef, useState } from 'react'

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
  const menuId = useId()

  useEffect(() => {
    if (!open) {
      return
    }
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
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
      {open ? (
        <div className="row-menu__panel" id={menuId} role="menu">
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
        </div>
      ) : null}
    </div>
  )
}
