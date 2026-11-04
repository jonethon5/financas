import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type ChatTurn = { role: 'user' | 'model'; text: string }
export type AskUsage = { used: number; limit: number; configured?: boolean }

/** Chamada à Edge Function "ask", com a mensagem de erro em português. */
async function callAsk<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ask', { body })
  if (error) {
    const detail = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null
    throw new Error(detail?.error ?? 'Não foi possível falar com o assistente. Confira a internet.')
  }
  return data as T
}

export function askUsage(): Promise<AskUsage> {
  return callAsk({ action: 'usage' })
}

export function askQuestion(question: string, history: ChatTurn[]): Promise<{ answer: string } & AskUsage> {
  return callAsk({ action: 'ask', question, history: history.slice(-6) })
}

/**
 * Formatação simples da resposta (o modelo escreve em Markdown): parágrafos, listas com "-"/"*"/"1." e **negrito**.
 * Devolve blocos para o React montar, sem HTML.
 */
export type AnswerBlock = { kind: 'p'; parts: AnswerPart[] } | { kind: 'li'; parts: AnswerPart[] }
export type AnswerPart = { text: string; bold: boolean }

export function parseAnswer(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = []
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/)
    const content = (item ? item[1] : line).replace(/^#+\s*/, '')
    const parts = content
      .split(/(\*\*[^*]+\*\*)/g)
      .filter(Boolean)
      .map((p) => (p.startsWith('**') && p.endsWith('**') ? { text: p.slice(2, -2), bold: true } : { text: p, bold: false }))
    blocks.push({ kind: item ? 'li' : 'p', parts })
  }
  return blocks
}
