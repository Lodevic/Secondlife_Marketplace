const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const statusLabels = {
  pending_payment: 'Menunggu pembayaran',
  paid: 'Dibayar',
  processing: 'Diproses',
  shipped: 'Dikirim',
  delivered: 'Diterima',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  draft: 'Draf',
  pending: 'Menunggu peninjauan',
  active: 'Aktif',
  sold: 'Terjual',
  archived: 'Diarsipkan',
  rejected: 'Ditolak',
  buyer: 'Pembeli',
  seller: 'Penjual',
  admin: 'Admin',
  suspended: 'Ditangguhkan',
  blocked: 'Diblokir',
  investigating: 'Sedang ditinjau',
  resolved: 'Selesai ditinjau',
  product: 'Produk',
  store: 'Toko',
  user: 'Pengguna',
  order: 'Pesanan',
  review: 'Ulasan',
}

function rupiahInteger(value) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value))
  if (!match) throw new TypeError('Nilai uang dari API bukan angka Decimal yang valid.')

  let integer = BigInt(match[2])
  if (match[3]?.[0] >= '5') integer += 1n
  return match[1] === '-' ? -integer : integer
}

export function formatRupiah(value) {
  return rupiahFormatter.format(rupiahInteger(value))
}

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
  if (!match) throw new TypeError('Tanggal dashboard harus berformat YYYY-MM-DD.')
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

export function formatTanggalIndonesia(value) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseIsoDate(value))
}

export function formatPeriode(value, period) {
  const options =
    period === 'month'
      ? { month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'short' }

  return new Intl.DateTimeFormat('id-ID', {
    ...options,
    timeZone: 'UTC',
  }).format(parseIsoDate(value))
}

export function labelStatus(status) {
  return statusLabels[status] || status
}
