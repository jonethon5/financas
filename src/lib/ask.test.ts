import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))

const { parseAnswer } = await import('./ask')

describe('resposta do assistente', () => {
  it('separa parágrafos e listas', () => {
    const blocks = parseAnswer('Neste mês:\n\n- Luz: **R$ 210,34**\n* Água: R$ 87,90\n1. Total')
    expect(blocks.map((b) => b.kind)).toEqual(['p', 'li', 'li', 'li'])
    expect(blocks[1].parts).toEqual([
      { text: 'Luz: ', bold: false },
      { text: 'R$ 210,34', bold: true },
    ])
    expect(blocks[3].parts[0].text).toBe('Total')
  })

  it('tira marcação de título', () => {
    expect(parseAnswer('## Resumo')[0]).toEqual({ kind: 'p', parts: [{ text: 'Resumo', bold: false }] })
  })
})
