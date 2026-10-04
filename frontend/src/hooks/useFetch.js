import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/axios'

export default function useFetch(url, { params, enabled = true } = {}) {
  const paramsKey = useMemo(() => JSON.stringify(params ?? {}), [params])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestNumber, setRequestNumber] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setData(null)
      setLoading(false)
      setError('')
      return undefined
    }

    const controller = new AbortController()
    setData(null)
    setLoading(true)
    setError('')

    api
      .get(url, { params: JSON.parse(paramsKey), signal: controller.signal })
      .then((response) => setData(response.data))
      .catch((requestError) => {
        if (
          controller.signal.aborted ||
          requestError.name === 'CanceledError' ||
          requestError.name === 'AbortError'
        ) {
          return
        }
        setError(
          requestError.response?.data?.error ||
            requestError.message ||
            'Terjadi kesalahan saat memuat data.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [url, paramsKey, enabled, requestNumber])

  const refetch = useCallback(() => {
    setRequestNumber((current) => current + 1)
  }, [])

  return { data, loading, error, refetch }
}
