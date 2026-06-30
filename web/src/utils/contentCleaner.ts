function decodeHtmlEntities(input: string): string {
  return String(input || '')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => {
      const value = Number(code)
      return Number.isFinite(value) ? String.fromCharCode(value) : ''
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => {
      const value = parseInt(code, 16)
      return Number.isFinite(value) ? String.fromCharCode(value) : ''
    })
}

const readerNoisePatterns = [
  /^\s*window\.[A-Za-z_$][\w$]*\s*=\s*["'][A-Za-z0-9+/=\s]{40,}["'];?\s*$/gim,
]

export function cleanReaderContent(content: string): string {
  let text = String(content || '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n')
    .replace(/<\s*p\b[^>]*>/gi, '\n')
    .replace(/<\/\s*div\s*>/gi, '\n')
    .replace(/<\s*div\b[^>]*>/gi, '\n')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')

  text = decodeHtmlEntities(text)

  for (const pattern of readerNoisePatterns) {
    text = text.replace(pattern, '')
  }

  return text
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
