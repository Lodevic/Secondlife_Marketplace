export default function LoadingSpinner({ label = 'Memuat data...' }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 px-4 py-8 text-sm text-slate-500"
    >
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-700 border-r-transparent"
      />
      <span>{label}</span>
    </div>
  )
}
