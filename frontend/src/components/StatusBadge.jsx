import { labelStatus } from '../utils/dashboard'

const statusStyles = {
  active: 'bg-emerald-100 text-emerald-800',
  paid: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-emerald-100 text-emerald-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-blue-100 text-blue-800',
  pending: 'bg-amber-100 text-amber-800',
  pending_payment: 'bg-amber-100 text-amber-800',
  draft: 'bg-slate-100 text-slate-700',
  archived: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-slate-100 text-slate-700',
  sold: 'bg-violet-100 text-violet-800',
  rejected: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
  picked_up: 'bg-cyan-100 text-cyan-800',
  in_transit: 'bg-blue-100 text-blue-800',
}

const shipmentStatusLabels = {
  picked_up: 'Diambil kurir',
  in_transit: 'Dalam perjalanan',
  failed: 'Gagal',
}

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        statusStyles[status] || 'bg-slate-100 text-slate-700'
      }`}
    >
      {shipmentStatusLabels[status] || labelStatus(status)}
    </span>
  )
}
