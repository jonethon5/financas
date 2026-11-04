import { Fragment, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUp, Sparkles, SquarePen } from 'lucide-react'
import { IconButton, IconTile, List, NavBar, Row } from '../components/ui'
import { useHousehold } from '../household/HouseholdProvider'
import { askQuestion, askUsage, parseAnswer, type ChatTurn } from '../lib/ask'

const SUGGESTIONS = [
  'Quanto cada um paga este mês?',
  'Quem deve para quem?',
  'Quanto gastamos de luz nos últimos 3 meses?',
  'Qual conta subiu mais em relação ao mês passado?',
  'Quais contas ainda faltam pagar?',
]

const STORAGE_KEY = 'financas:conversa'

function loadChat(): ChatTurn[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function saveChat(chat: ChatTurn[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chat.slice(-30)))
  } catch {
    /* sem armazenamento: a conversa só não sobrevive a recarregar */
  }
}

function Answer({ text }: { text: string }) {
  const blocks = parseAnswer(text)
  return (
    <div className="flex flex-col gap-1.5">
      {blocks.map((b, i) => {
        const content = b.parts.map((p, j) => (p.bold ? <strong key={j}>{p.text}</strong> : <Fragment key={j}>{p.text}</Fragment>))
        return b.kind === 'li' ? (
          <p key={i} className="flex gap-2">
            <span className="text-muted">•</span>
            <span>{content}</span>
          </p>
        ) : (
          <p key={i}>{content}</p>
        )
      })}
    </div>
  )
}

function Typing() {
  return (
    <div className="flex w-fit gap-1 rounded-[1.25rem] rounded-bl-md bg-surface px-4 py-3.5 shadow-soft" aria-label="Pensando">
      {[0, 150, 300].map((d) => (
        <span key={d} className="size-2 animate-bounce rounded-full bg-faint" style={{ animationDelay: `${d}ms` }} />
      ))}
    </div>
  )
}

/** Assistente: perguntas sobre as contas da casa (só leitura, 20 por dia). */
export function AskPage() {
  const { demo } = useHousehold()
  const [chat, setChat] = useState<ChatTurn[]>(loadChat)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const usage = useQuery({ queryKey: ['ask-usage'], queryFn: askUsage, enabled: !demo, staleTime: 60_000 })
  const [used, setUsed] = useState<number | null>(null)
  const limit = usage.data?.limit ?? 20
  const left = limit - (used ?? usage.data?.used ?? 0)
  const unavailable = demo || usage.data?.configured === false

  useEffect(() => {
    saveChat(chat)
  }, [chat])
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chat, busy, error])

  async function send(question: string) {
    const q = question.trim()
    if (!q || busy || unavailable) return
    const history = chat
    setChat([...history, { role: 'user', text: q }])
    setInput('')
    setError(null)
    setBusy(true)
    try {
      const res = await askQuestion(q, history)
      setChat((c) => [...c, { role: 'model', text: res.answer }])
      setUsed(res.used)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    send(input)
  }

  return (
    <>
      <NavBar
        title="Perguntar"
        subtitle="Assistente das contas da casa"
        right={
          chat.length > 0 && (
            <IconButton
              label="Nova conversa"
              onClick={() => {
                setChat([])
                setError(null)
              }}
            >
              <SquarePen className="size-[1.125rem]" strokeWidth={1.8} aria-hidden />
            </IconButton>
          )
        }
      />

      {chat.length === 0 ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center px-4 pt-2 text-center">
            <IconTile size="lg">
              <Sparkles strokeWidth={1.8} />
            </IconTile>
            <p className="mt-3 text-[1.0625rem] font-semibold">Pergunte sobre as contas</p>
            <p className="mt-1 max-w-xs text-[0.9375rem] text-muted">
              {unavailable
                ? demo
                  ? 'O assistente funciona quando o app estiver ligado ao Supabase, com a chave do Gemini.'
                  : 'O assistente ainda não foi ligado: falta a chave do Gemini.'
                : 'Ele lê os valores, vencimentos e a divisão de cada mês. Só consulta: não muda nada.'}
            </p>
          </div>
          <div>
            <p className="mb-2 px-1 text-[0.8125rem] font-medium tracking-wide text-muted uppercase">Experimente</p>
            <List>
              {SUGGESTIONS.map((s) => (
                <Row key={s} title={<span className="whitespace-normal">{s}</span>} onClick={() => send(s)} chevron className={unavailable ? 'pointer-events-none opacity-50' : ''} />
              ))}
            </List>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pt-1">
          {chat.map((t, i) =>
            t.role === 'user' ? (
              <div key={i} className="ml-10 self-end rounded-[1.25rem] rounded-br-md bg-primary px-4 py-2.5 text-[1.0625rem] text-white">
                {t.text}
              </div>
            ) : (
              <div key={i} className="mr-6 self-start rounded-[1.25rem] rounded-bl-md bg-surface px-4 py-3 text-[1.0625rem] leading-snug shadow-soft">
                <Answer text={t.text} />
              </div>
            ),
          )}
          {busy && <Typing />}
          {error && <p className="mr-6 self-start rounded-[1.25rem] rounded-bl-md bg-danger-soft px-4 py-3 text-[0.9375rem] text-danger">{error}</p>}
        </div>
      )}

      <div ref={end} className="h-24" />

      {/* Campo de pergunta, logo acima da barra de abas */}
      <form
        onSubmit={onSubmit}
        className="fixed bottom-[calc(3.3rem+env(safe-area-inset-bottom))] left-1/2 z-20 w-full max-w-[30rem] -translate-x-1/2 border-t border-black/[0.06] bg-bg/85 px-3 pt-2 pb-2 backdrop-blur-xl"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 500))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            rows={1}
            disabled={unavailable}
            placeholder={unavailable ? 'Assistente desligado' : 'Pergunte algo…'}
            aria-label="Sua pergunta"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-[1.375rem] border border-line bg-surface px-4 py-2.5 text-[1.0625rem] leading-snug outline-none placeholder:text-faint focus:border-primary disabled:opacity-60"
            style={{ fieldSizing: 'content' } as CSSProperties}
          />
          <button
            type="submit"
            disabled={!input.trim() || busy || unavailable || left <= 0}
            aria-label="Enviar"
            className="mb-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white transition active:scale-95 disabled:bg-[#cfd5db]"
          >
            <ArrowUp className="size-5" strokeWidth={2.4} aria-hidden />
          </button>
        </div>
        {!unavailable && (usage.data || used != null) && (
          <p className="mt-1 text-center text-[0.75rem] text-muted">
            {left > 0 ? `${left} de ${limit} perguntas restantes hoje` : 'Você já usou as perguntas de hoje. Amanhã libera de novo.'}
          </p>
        )}
      </form>
    </>
  )
}
