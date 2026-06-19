import type { CollectorLogRow, CollectorRuleRow } from '@/api'

export interface CollectorPluginTableRow {
  id: number
  collectName: string
  collectType: string
  addedAt: string
  collectedAt: string
  entryUrl: string
  enabled: boolean
  raw: CollectorRuleRow
}

export function formatCollectorDate(value?: string) {
  if (!value) return '-'
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/)
  return match ? `${match[1]} ${match[2]}` : String(value)
}

export function buildCollectorPluginRows(rules: CollectorRuleRow[], logs: CollectorLogRow[]): CollectorPluginTableRow[] {
  return rules.map((rule) => {
    const latestLog = logs
      .filter((log) => log.ruleId === rule.id && log.status === 'success')
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0]

    return {
      id: rule.id,
      collectName: rule.name,
      collectType: '小说',
      addedAt: formatCollectorDate(rule.createdAt),
      collectedAt: formatCollectorDate(latestLog?.createdAt),
      entryUrl: rule.entryUrl,
      enabled: rule.enabled,
      raw: rule,
    }
  })
}
