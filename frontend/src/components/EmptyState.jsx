export default function EmptyState({
  message = 'Data belum tersedia',
  description,
  compact = false,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center text-slate-500 ${
        compact ? 'px-3 py-5' : 'px-5 py-8'
      }`}
    >
      <span
        aria-hidden="true"
        className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400"
      >
        —
      </span>
      <p className="text-sm font-medium text-slate-700">{message}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-5">{description}</p>
      )}
    </div>
  )
}
