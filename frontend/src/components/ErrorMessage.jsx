export default function ErrorMessage({ message, onRetry }) {
  if (!message) return null

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100"
        >
          Coba lagi
        </button>
      )}
    </div>
  )
}
