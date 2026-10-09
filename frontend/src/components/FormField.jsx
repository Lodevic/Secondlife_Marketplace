const controlClassName =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100'

export default function FormField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  as = 'input',
  options = [],
  required = false,
  disabled = false,
  placeholder,
  min,
  step,
  rows = 4,
  error,
  hint,
}) {
  const controlProps = {
    id: name,
    name,
    value,
    onChange,
    required,
    disabled,
    placeholder,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${name}-error` : hint ? `${name}-hint` : undefined,
    className: controlClassName,
  }

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}
      </label>
      {as === 'select' ? (
        <select {...controlProps}>
          <option value="">Pilih {label.toLowerCase()}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : as === 'textarea' ? (
        <textarea {...controlProps} rows={rows} />
      ) : (
        <input {...controlProps} type={type} min={min} step={step} />
      )}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  )
}
