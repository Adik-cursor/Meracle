export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? 'logo-lockup logo-lockup--compact' : 'logo-lockup'}>
      <span className="logo" aria-hidden="true">
        <svg className="logo__symbol" viewBox="0 0 40 40" fill="none">
          <path
            d="M11 27 20 13l9 14"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="11" cy="27" r="4.5" fill="currentColor" />
          <circle cx="20" cy="13" r="4.5" fill="currentColor" />
          <circle cx="29" cy="27" r="4.5" fill="#d1f27a" />
        </svg>
      </span>
      {compact ? null : <span className="logo-wordmark">Meracle</span>}
    </span>
  )
}
