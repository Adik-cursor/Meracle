export function printInternalReceipt(): void {
  const root = document.documentElement
  root.classList.add('print-receipt')

  const cleanup = () => {
    root.classList.remove('print-receipt')
    window.removeEventListener('afterprint', cleanup)
  }

  window.addEventListener('afterprint', cleanup)
  window.print()
}
