const sourceJsEnabled = process.env.ENABLE_SOURCE_JS === 'true'

try {
  require('isolated-vm')
  console.log('[Native] isolated-vm 可用')
  process.exit(0)
} catch (err) {
  const message = [
    '[Native] isolated-vm 不可用',
    `原因: ${err && err.message ? err.message : String(err)}`,
    '修复: 在 server 目录执行 npm rebuild isolated-vm，或重新 npm install',
  ].join('\n')

  if (sourceJsEnabled) {
    console.error(message)
    process.exit(1)
  }

  console.warn(`${message}\n当前 ENABLE_SOURCE_JS=false，不阻塞启动。`)
  process.exit(0)
}
