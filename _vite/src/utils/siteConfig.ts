export type SiteConfigItem = {
  config_key: string
  config_value: string
  description?: string
}

export type SiteConfigMap = Record<string, string>

export function configsToMap(configs: SiteConfigItem[] = []): SiteConfigMap {
  return configs.reduce<SiteConfigMap>((map, item) => {
    map[item.config_key] = item.config_value || ''
    return map
  }, {})
}

export function setMetaTag(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', name)
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', content || '')
}

export function setAnalyticsCode(code: string) {
  const old = document.getElementById('site-analytics-code')
  if (old) old.remove()

  if (!code?.trim()) return

  const container = document.createElement('div')
  container.id = 'site-analytics-code'
  container.style.display = 'none'
  container.innerHTML = code
  document.body.appendChild(container)

  container.querySelectorAll('script').forEach((script) => {
    const fresh = document.createElement('script')
    Array.from(script.attributes).forEach((attr) => {
      fresh.setAttribute(attr.name, attr.value)
    })
    fresh.text = script.text || script.textContent || ''
    script.replaceWith(fresh)
  })
}
