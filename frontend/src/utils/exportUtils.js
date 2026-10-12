export function escapeHtml(text) {
  return String(text ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getCellValue(row, accessor) {
  const value =
    typeof accessor === 'function'
      ? accessor(row)
      : accessor.split('.').reduce((current, key) => current?.[key], row)
  return value
}

function escapeCsvCell(value) {
  const isEmpty = value === null || value === undefined || value === ''
  const text = isEmpty ? '-' : String(value)
  const safeValue = !isEmpty && /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safeValue)
    ? `"${safeValue.replace(/"/g, '""')}"`
    : safeValue
}

export function buildCsv(columns, rows) {
  const header = columns.map(({ header }) => escapeCsvCell(String(header)))
  const records = rows.map((row) =>
    columns.map(({ accessor }) => escapeCsvCell(getCellValue(row, accessor))),
  )
  return `\uFEFF${[header, ...records].map((record) => record.join(',')).join('\r\n')}`
}

export function downloadBlob(filename, blob, mime) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('Unduhan hanya tersedia di browser.')
  }
  const typedBlob =
    blob.type === mime ? blob : new Blob([blob], { type: mime })
  const objectUrl = URL.createObjectURL(typedBlob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
  }
}

export function exportCsv(filename, columns, rows) {
  const content = buildCsv(columns, rows)
  downloadBlob(
    filename,
    new Blob([content], { type: 'text/csv;charset=utf-8' }),
    'text/csv;charset=utf-8',
  )
}

export function exportWord(filename, title, htmlBody) {
  const content = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:11pt;line-height:1.5}
h1,h2{color:#111827}
table{width:100%;border-collapse:collapse;margin:12px 0}
th,td{border:1px solid #9ca3af;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
th{background:#f3f4f6}
p,dd{overflow-wrap:anywhere;white-space:pre-wrap}
</style>
</head>
<body>${htmlBody}</body>
</html>`
  downloadBlob(
    filename,
    new Blob([content], { type: 'application/msword;charset=utf-8' }),
    'application/msword;charset=utf-8',
  )
}

export function printDocument() {
  if (typeof window === 'undefined' || typeof window.print !== 'function') {
    throw new Error('Fitur cetak tidak tersedia di browser ini.')
  }
  return new Promise((resolve, reject) => {
    window.requestAnimationFrame(() => {
      try {
        window.print()
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  })
}
