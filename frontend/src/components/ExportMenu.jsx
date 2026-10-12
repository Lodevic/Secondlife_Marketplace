import { useEffect, useRef, useState } from 'react'

export default function ExportMenu({
  onPdf,
  onWord,
  onCsv,
  disabled = false,
  loading = false,
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const entries = [
    { key: 'pdf', label: 'PDF (cetak)', callback: onPdf },
    { key: 'word', label: 'Word (.doc)', callback: onWord },
    { key: 'csv', label: 'CSV', callback: onCsv },
  ].filter((entry) => typeof entry.callback === 'function')

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        menuRef.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  if (entries.length === 0) return null

  const unavailable = disabled || loading

  return (
    <div ref={menuRef} className="relative print:hidden">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={unavailable}
        onClick={() => setOpen((current) => !current)}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Menyiapkan export...' : 'Export'}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Pilihan export"
          className="absolute right-0 z-20 mt-2 min-w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          {entries.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                entry.callback()
              }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
