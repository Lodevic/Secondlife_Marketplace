export default function StatCard({
  title,
  value,
  detail,
  highlighted = false,
}) {
  return (
    <section
      className={`rounded-xl border p-5 shadow-sm ${
        highlighted
          ? 'border-emerald-900 bg-emerald-900 text-white'
          : 'border-slate-200 bg-white text-slate-900'
      }`}
    >
      <h2
        className={`text-sm font-medium ${
          highlighted ? 'text-emerald-50' : 'text-slate-600'
        }`}
      >
        {title}
      </h2>
      <p className="mt-2 break-words text-2xl font-semibold tracking-tight">
        {value}
      </p>
      {detail && (
        <p
          className={`mt-2 text-xs leading-5 ${
            highlighted ? 'text-emerald-100' : 'text-slate-500'
          }`}
        >
          {detail}
        </p>
      )}
    </section>
  )
}
