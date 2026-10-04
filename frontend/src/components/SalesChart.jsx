import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import EmptyState from './EmptyState'
import { formatPeriode, formatRupiah } from '../utils/dashboard'

export default function SalesChart({ data, period, series }) {
  if (
    !data?.length ||
    data.every((point) =>
      series.every((item) => !Number(point[item.dataKey])),
    )
  ) {
    return (
      <EmptyState
        description="Grafik akan tampil setelah tersedia transaksi pada rentang tanggal ini."
      />
    )
  }

  const chartData = data.map((point) => ({
    ...point,
    ...Object.fromEntries(
      series.map((item) => [item.dataKey, Number(point[item.dataKey])]),
    ),
  }))
  const hasRightAxis = series.some((item) => item.axis === 'right')

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 12, right: hasRightAxis ? 12 : 8, bottom: 4, left: 8 }}
        >
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => formatPeriode(value, period)}
            tick={{ fill: '#64748b', fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={(value) => formatRupiah(value)}
            tick={{ fill: '#64748b', fontSize: 10 }}
            width={82}
          />
          {hasRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              allowDecimals={false}
              tick={{ fill: '#64748b', fontSize: 10 }}
              width={42}
            />
          )}
          <Tooltip
            labelFormatter={(value) => formatPeriode(value, period)}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
                  <p className="mb-2 font-medium text-slate-700">
                    {formatPeriode(label, period)}
                  </p>
                  {payload.map((item) => {
                    const config = series.find(
                      (entry) => entry.dataKey === item.dataKey,
                    )
                    const value =
                      config?.format === 'currency'
                        ? formatRupiah(item.value)
                        : `${item.value} pesanan`
                    return (
                      <p key={item.dataKey} className="mt-1 text-slate-600">
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {config?.name}: {value}
                      </p>
                    )
                  })}
                </div>
              )
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {series.map((item) => (
            <Line
              key={item.dataKey}
              type="monotone"
              dataKey={item.dataKey}
              name={item.name}
              yAxisId={item.axis === 'right' ? 'right' : 'left'}
              stroke={item.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
