export function Spinner() {
  return <span className="spinner" aria-hidden="true" />
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="table-wrap" aria-hidden="true">
      <div className="skeleton" style={{ padding: 12 }}>
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="skeleton__row" />
        ))}
      </div>
    </div>
  )
}
