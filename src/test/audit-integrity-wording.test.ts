import { describe, expect, it } from 'vitest'

const SOURCES = import.meta.glob([
  '/src/components/audit/**/*.{ts,tsx}',
  '/src/pages/AuditEventsPage.tsx',
], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Negative fixtures may quote the wording they reject; only runtime audit
// sources participate in MISLEADING_INTEGRITY_LABELS=0.
const runtimeSources = Object.entries(SOURCES).filter(([file]) =>
  !/\.(?:test|spec)\.[tj]sx?$|\/(?:tests?|__tests__|fixtures|__fixtures__)\//.test(file),
)

const misleadingLabels = [
  /\binmutab(?:le|les|ilidad)\b/i,
  /\binalterables?\b/i,
  /\btamper[-\s]?proof\b/i,
  /\bSIGNATURE_VALID\b/i,
  /\bregistro\s+intacto\b/i,
  /(?:comprueba|garantiza|asegura)[^.]*\b(?:alteraci[oó]n(?:es)?|manipulaci[oó]n(?:es)?)\b[^.]*\b(?:base\s+de\s+datos|postgresql)\b/i,
  /(?:registro|evento)[^.!?]{0,60}(?:fue|ha sido)\s+(?:hackead[oa]|manipulad[oa])/i,
]

describe('audit integrity wording guard', () => {
  it('includes the audit page and the real event detail component', () => {
    expect(runtimeSources.map(([file]) => file)).toEqual(expect.arrayContaining([
      '/src/pages/AuditEventsPage.tsx',
      '/src/components/audit/AuditEventDetailModal.tsx',
    ]))
  })

  it('keeps MISLEADING_INTEGRITY_LABELS=0 in runtime audit sources', () => {
    const offenders = runtimeSources.flatMap(([file, source]) => {
      const normalized = source.replace(/\s+/g, ' ')
      return misleadingLabels
        .filter((pattern) => pattern.test(normalized))
        .map((pattern) => `${file}: ${pattern.source}`)
    })

    expect(offenders, `Misleading integrity labels:\n${offenders.join('\n')}`).toEqual([])
  })
})
