import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  X, Send, ChevronRight, FileText, Users, BarChart2,
  ExternalLink, Loader2, MessageSquare, Bot
} from 'lucide-react'
import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Types ───────────────────────────────────────────────────────────────────

interface Citation {
  type: 'contract' | 'vendor' | 'page'
  id?: string
  title: string
  url: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  loading?: boolean
}

interface ChatSidebarProps {
  open: boolean
  onClose: () => void
  pendingQuestion?: string
  onPendingConsumed?: () => void
}

// ─── Lightweight Markdown Renderer ───────────────────────────────────────────

function renderMarkdown(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-sm font-mono">$1</code>')
    // Bullet list items
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Numbered list items
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Headers h2/h3
    .replace(/^## (.+)$/gm, '<h2 class="font-bold text-base mt-3 mb-1">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold mt-2 mb-1">$1</h3>')
    // Newlines
    .replace(/\n/g, '<br/>')
}

// ─── Citation Card ────────────────────────────────────────────────────────────

function CitationCard({ citation }: { citation: Citation }) {
  const iconMap = {
    contract: <FileText className="w-3.5 h-3.5 text-blue-500" />,
    vendor: <Users className="w-3.5 h-3.5 text-green-500" />,
    page: <BarChart2 className="w-3.5 h-3.5 text-purple-500" />,
  }
  const colorMap = {
    contract: 'border-blue-200 bg-blue-50 hover:bg-blue-100',
    vendor: 'border-green-200 bg-green-50 hover:bg-green-100',
    page: 'border-purple-200 bg-purple-50 hover:bg-purple-100',
  }

  const type = (citation.type as 'contract' | 'vendor' | 'page') || 'page'

  return (
    <Link
      to={citation.url}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs
                  transition-colors duration-150 ${colorMap[type]}`}
    >
      {iconMap[type]}
      <span className="max-w-[160px] truncate text-gray-700">{citation.title}</span>
      <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
    </Link>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  if (message.loading) {
    return (
      <div className="flex gap-2 items-start">
        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-blue-600" />
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3">
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
        </div>
      </div>
    )
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-tr-none px-4 py-2.5">
          <p className="text-sm">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 items-start">
      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="w-4 h-4 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3">
          <div
            className="text-sm text-gray-800 leading-relaxed prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        </div>
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
            {message.citations.map((c, i) => (
              <CitationCard key={i} citation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatSidebar({ open, onClose, pendingQuestion, onPendingConsumed }: ChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'สวัสดีครับ! ผมช่วยค้นหาและตอบคำถามเกี่ยวกับสัญญา ผู้รับจ้าง และข้อมูลในระบบได้เลยครับ\n\nลองถามเช่น:\n- **"มีสัญญาใกล้หมดอายุไหม?"**\n- **"สรุปภาพรวมสัญญาทั้งหมด"**\n- **"ผู้รับจ้างที่มีสัญญามากที่สุด"**',
    }
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when sidebar opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 350)
    }
  }, [open])

  // Handle pending question from Dashboard search bar
  useEffect(() => {
    if (pendingQuestion && pendingQuestion.trim() && open) {
      sendMessage(pendingQuestion.trim())
      onPendingConsumed?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion, open])

  const getHistory = () =>
    messages
      .filter((m) => !m.loading)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }))

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return

    const userMsg: Message = { role: 'user', content: text }
    const loadingMsg: Message = { role: 'assistant', content: '', loading: true }

    setMessages((prev) => [...prev, userMsg, loadingMsg])
    setInput('')
    setSending(true)

    try {
      const resp = await api.post('/chat/query', {
        question: text,
        history: getHistory(),
      })
      const data = resp.data?.data || {}
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.answer || 'ขออภัย ไม่สามารถตอบได้ในขณะนี้',
        citations: data.citations || [],
      }
      setMessages((prev) => [...prev.slice(0, -1), assistantMsg])
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'เกิดข้อผิดพลาด กรุณาลองใหม่'
      const errorMsg: Message = {
        role: 'assistant',
        content: `⚠️ ${detail}`,
        citations: [],
      }
      setMessages((prev) => [...prev.slice(0, -1), errorMsg])
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <>
      {/* Backdrop - click to close */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Pull Tab - visible when sidebar is closed */}
      {!open && (
        <button
          onClick={onClose}
          aria-label="เปิดแชท"
          className="fixed bottom-24 right-0 z-50 bg-blue-600 text-white
                     rounded-l-xl px-2 py-4 shadow-lg hover:bg-blue-700
                     transition-colors duration-200 flex flex-col items-center gap-1.5"
        >
          <MessageSquare className="w-5 h-5" />
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Sidebar Panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 w-[420px] max-w-[100vw]
                    bg-gray-50 shadow-2xl flex flex-col
                    transition-transform duration-300 ease-in-out
                    ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-blue-900 text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <div>
              <p className="font-semibold text-sm">AI ผู้ช่วย</p>
              <p className="text-xs text-blue-300">ค้นหาและตอบคำถามจากข้อมูลในระบบ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-blue-800 rounded-lg transition"
            aria-label="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex-shrink-0 px-4 py-3 bg-white border-t border-gray-200 flex gap-2 items-center"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="พิมพ์คำถาม..."
            disabled={sending}
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400
                       disabled:opacity-60 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300
                       text-white rounded-full flex items-center justify-center
                       transition-colors duration-150 flex-shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </>
  )
}
