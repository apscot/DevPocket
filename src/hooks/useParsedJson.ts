import { useMemo } from 'react'
import { parseJson } from '@/lib/json'

export function useParsedJson(text: string) {
  return useMemo(() => {
    if (!text.trim()) return { data: undefined as unknown, error: null as string | null, empty: true }
    try { return { data: parseJson(text), error: null, empty: false } } catch (e) { return { data: undefined, error: (e as Error).message, empty: false } }
  }, [text])
}
