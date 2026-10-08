import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import LoadingSpinner from '../../components/LoadingSpinner'

function requestErrorMessage(error, scope) {
  if (error.response?.status === 403) {
    return scope === 'list'
      ? 'Anda tidak memiliki izin untuk melihat daftar chat.'
      : 'Anda bukan peserta chat ini sehingga tidak dapat membuka percakapan.'
  }
  if (error.response?.status === 404) {
    return scope === 'list'
      ? 'Endpoint daftar chat tidak ditemukan.'
      : 'Chat ini tidak ditemukan atau sudah tidak tersedia.'
  }
  return error.response?.data?.error || (
    scope === 'list' ? 'Gagal memuat daftar chat.' : 'Gagal memuat pesan chat.'
  )
}

function formatChatTime(value, includeDate = false) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('id-ID', includeDate
    ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { hour: '2-digit', minute: '2-digit' },
  ).format(date)
}

function chatPartner(chat, user) {
  if (Number(chat.buyer_id) === Number(user?.id)) {
    return `Penjual #${chat.seller_id}`
  }
  if (Number(chat.seller_id) === Number(user?.id)) {
    return `Pembeli #${chat.buyer_id}`
  }
  return `Percakapan #${chat.id}`
}

function chatProduct(chat) {
  return chat.product_id ? `Produk #${chat.product_id}` : 'Chat umum'
}

export default function BuyerChatPage() {
  const { id: chatId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [chats, setChats] = useState([])
  const [chatsLoading, setChatsLoading] = useState(true)
  const [chatsError, setChatsError] = useState('')
  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(Boolean(chatId))
  const [messagesError, setMessagesError] = useState('')
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [listRefreshKey, setListRefreshKey] = useState(0)
  const [messageRetryKey, setMessageRetryKey] = useState(0)
  const bottomRef = useRef(null)

  const loadChats = useCallback(async () => {
    setChatsLoading(true)
    setChatsError('')
    try {
      const response = await api.get('/api/chats')
      setChats(response.data.chats ?? [])
    } catch (error) {
      setChatsError(requestErrorMessage(error, 'list'))
      setChats([])
    } finally {
      setChatsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadChats()
  }, [loadChats, listRefreshKey])

  useEffect(() => {
    setMessages([])
    if (!chatId) {
      setMessagesLoading(false)
      setMessagesError('')
      return undefined
    }

    let active = true
    let inFlight = false
    let stopPolling = false
    setMessagesLoading(true)
    setMessagesError('')

    const fetchMessages = async (initial = false) => {
      if (!active || inFlight || stopPolling) return
      inFlight = true
      if (initial) setMessagesLoading(true)
      try {
        const response = await api.get(`/api/chats/${chatId}/messages`)
        if (active) {
          const incomingMessages = response.data.messages ?? []
          setMessages((current) => {
            const currentLastId = current[current.length - 1]?.id
            const incomingLastId = incomingMessages[incomingMessages.length - 1]?.id
            return current.length === incomingMessages.length && currentLastId === incomingLastId
              ? current
              : incomingMessages
          })
          setMessagesError('')
        }
      } catch (error) {
        if (active) {
          setMessagesError(requestErrorMessage(error, 'messages'))
          if ([403, 404].includes(error.response?.status)) stopPolling = true
        }
      } finally {
        inFlight = false
        if (active && initial) setMessagesLoading(false)
      }
    }

    fetchMessages(true)
    const intervalId = window.setInterval(() => fetchMessages(false), 5000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [chatId, messageRetryKey])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const handleSend = async (event) => {
    event.preventDefault()
    const message = messageText.trim()
    if (!message || !chatId || sending) return

    setSending(true)
    setSendError('')
    try {
      const response = await api.post(`/api/chats/${chatId}/messages`, { message })
      const createdMessage = response.data.message
      setMessages((current) => (
        current.some((item) => item.id === createdMessage.id)
          ? current
          : [...current, createdMessage]
      ))
      setMessageText('')
      setListRefreshKey((current) => current + 1)
    } catch (error) {
      setSendError(requestErrorMessage(error, 'messages'))
    } finally {
      setSending(false)
    }
  }

  const selectedChat = chats.find((chat) => String(chat.id) === String(chatId))
  const showList = !chatId
  const showRoom = Boolean(chatId)

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Chat</h1>
        <p className="mt-1 text-sm text-slate-500">Percakapan Anda dengan pembeli dan penjual.</p>
      </header>

      <div className="grid h-[min(72vh,780px)] min-h-[30rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className={`${showList ? 'flex' : 'hidden'} min-h-0 flex-col border-r border-slate-200 md:flex`}>
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold text-slate-900">Percakapan</h2>
          </div>
          {chatsLoading ? (
            <LoadingSpinner label="Memuat chat..." />
          ) : chatsError ? (
            <div className="p-3">
              <ErrorMessage message={chatsError} onRetry={loadChats} />
            </div>
          ) : chats.length === 0 ? (
            <div className="flex-1 p-3">
              <EmptyState
                message="Belum ada chat"
                description="Chat penjual dari halaman produk untuk memulai percakapan."
                compact
              />
              <div className="text-center">
                <Link to="/buyer/products" className="text-sm font-medium text-emerald-700 hover:underline">
                  Jelajahi produk
                </Link>
              </div>
            </div>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {chats.map((chat) => {
                const lastMessage = chat.last_message
                const unreadCount = Number(chat.unread_count || 0)
                const isSelected = String(chat.id) === String(chatId)
                return (
                  <li key={chat.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/buyer/chats/${chat.id}`)}
                      aria-current={isSelected ? 'page' : undefined}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${
                        isSelected ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {chatPartner(chat, user)}
                        </span>
                        <span className="shrink-0 text-[11px] text-slate-500">
                          {formatChatTime(lastMessage?.created_at || chat.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-emerald-700">{chatProduct(chat)}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="truncate text-sm text-slate-600">
                          {lastMessage?.message || 'Belum ada pesan'}
                        </p>
                        {unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 px-1.5 text-[11px] font-semibold text-white">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        <div className={`${showRoom ? 'flex' : 'hidden'} min-h-0 flex-col md:flex`}>
          {!chatId ? (
            <div className="hidden flex-1 items-center justify-center md:flex">
              <EmptyState message="Pilih percakapan" description="Pesan akan tampil di sini." />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => navigate('/buyer/chats')}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 md:hidden"
                  aria-label="Kembali ke daftar chat"
                >
                  ←
                </button>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-slate-900">
                    {selectedChat ? chatPartner(selectedChat, user) : `Chat #${chatId}`}
                  </h2>
                  <p className="truncate text-xs text-slate-500">
                    {selectedChat ? chatProduct(selectedChat) : 'Percakapan'}
                  </p>
                </div>
              </div>

              {messagesLoading ? (
                <div className="flex-1">
                  <LoadingSpinner label="Memuat pesan..." />
                </div>
              ) : messagesError ? (
                <div className="m-4">
                  <ErrorMessage
                    message={messagesError}
                    onRetry={() => setMessageRetryKey((current) => current + 1)}
                  />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1">
                  <EmptyState message="Belum ada pesan" description="Kirim pesan untuk memulai percakapan." />
                </div>
              ) : (
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
                  {messages.map((message) => {
                    const ownMessage = Number(message.sender_id) === Number(user?.id)
                    return (
                      <div
                        key={message.id}
                        className={`flex ${ownMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
                            ownMessage
                              ? 'rounded-br-sm bg-emerald-700 text-white'
                              : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm">{message.message}</p>
                          {message.attachment_url && (
                            <a
                              href={message.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              className={`mt-2 block text-xs underline ${
                                ownMessage ? 'text-emerald-100' : 'text-emerald-700'
                              }`}
                            >
                              Buka lampiran
                            </a>
                          )}
                          <p className={`mt-1 text-right text-[10px] ${
                            ownMessage ? 'text-emerald-100' : 'text-slate-400'
                          }`}>
                            {formatChatTime(message.created_at, true)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>
              )}

              {sendError && <div className="px-4 pt-3"><ErrorMessage message={sendError} /></div>}
              <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-slate-200 p-3">
                <label htmlFor="chat-message" className="sr-only">Tulis pesan</label>
                <textarea
                  id="chat-message"
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      event.currentTarget.form.requestSubmit()
                    }
                  }}
                  maxLength={5000}
                  rows={1}
                  placeholder="Tulis pesan..."
                  disabled={Boolean(messagesError)}
                  className="max-h-32 min-h-11 flex-1 resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim() || sending || Boolean(messagesError)}
                  className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {sending ? 'Mengirim...' : 'Kirim'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
