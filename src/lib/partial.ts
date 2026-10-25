/* Reading JSON that is still being written.
 *
 * The engine streams the answer token by token. That text is a JSON document
 * that only becomes valid at the very last character, which is why a plain
 * `JSON.parse` is useless while streaming. What we want is "show the user the
 * prompt as it is typed", and for that we only need the fields that have
 * already arrived.
 *
 * `salvage` closes any half-written string/array/object so the fragment parses,
 * then hands back whatever fields are complete enough to display. It never
 * throws: a partially written value is simply missing.
 */

function closeFragment(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null

  const body = text.slice(start)
  const stack: string[] = []
  let inString = false
  let escaped = false

  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') stack.pop()
  }

  // A dangling escape or an open string would swallow our closing quote.
  let out = body
  if (escaped) out = out.slice(0, -1)
  if (inString) out += '"'

  // A trailing comma or a key with no value cannot be repaired reliably —
  // trim back to the last complete member instead of guessing.
  out = out.replace(/,\s*$/, '')
  return out + stack.reverse().join('')
}

export interface PartialFields {
  title?: string
  category?: string
  objective?: string
  brief?: string
  prompt?: string
  assumptions?: string[]
  tips?: string[]
  quality?: { clarity?: number; completeness?: number; specificity?: number }
}

/**
 * Best-effort view of a half-finished answer. Returns null until there is at
 * least one field worth showing.
 */
export function salvage(text: string): PartialFields | null {
  if (!text || text.length < 8) return null

  const candidate = closeFragment(text)
  if (!candidate) return null

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(candidate) as Record<string, unknown>
  } catch {
    // Trim one truncated member and try once more — streams usually break in
    // the middle of the field we are currently writing.
    const trimmed = candidate.slice(0, Math.max(0, candidate.lastIndexOf(',')))
    if (!trimmed) return null
    try {
      parsed = JSON.parse(closeFragment(trimmed) || '') as Record<string, unknown>
    } catch {
      return null
    }
  }

  const str = (v: unknown, max = 4000) =>
    typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 8) : undefined

  const out: PartialFields = {
    title: str(parsed.title, 160),
    category: str(parsed.category, 60),
    objective: str(parsed.objective, 700),
    brief: str(parsed.brief, 700),
    prompt: str(parsed.prompt, 8000),
    assumptions: arr(parsed.assumptions),
    tips: arr(parsed.tips),
  }

  const q = parsed.quality as Record<string, unknown> | undefined
  if (q && typeof q === 'object') {
    out.quality = {
      clarity: typeof q.clarity === 'number' ? q.clarity : undefined,
      completeness: typeof q.completeness === 'number' ? q.completeness : undefined,
      specificity: typeof q.specificity === 'number' ? q.specificity : undefined,
    }
  }

  const hasContent = out.title || out.objective || out.prompt || out.brief
  return hasContent ? out : null
}
