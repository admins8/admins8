import { describe, expect, it } from 'vitest'
import { buildCollectorPluginRows } from './collectorPluginTable'

describe('buildCollectorPluginRows', () => {
  it('把采集规则和日志映射为截图式表格行', () => {
    const rows = buildCollectorPluginRows(
      [
        {
          id: 11,
          name: 'ALEXA世界排名网塔',
          entryUrl: 'http://example.com/Shtml11.html',
          enabled: true,
          rule: {
            name: 'ALEXA世界排名网塔',
            entryUrl: 'http://example.com/Shtml11.html',
            detailRules: { name: '', author: '', coverUrl: '', intro: '', tocUrl: '' },
            tocRules: { chapterList: '', chapterTitle: '', chapterUrl: '' },
            contentRule: '',
          },
          createdAt: '2025-05-05T05:38:00.000Z',
          updatedAt: '2025-05-06T00:00:00.000Z',
        },
      ],
      [
        {
          id: 1,
          ruleId: 11,
          status: 'success',
          message: '单本采集完成',
          bookName: '测试书',
          chapterCount: 20,
          contentCount: 20,
          createdAt: '2022-09-21T08:30:00.000Z',
        },
      ],
    )

    expect(rows).toEqual([
      expect.objectContaining({
        id: 11,
        collectName: 'ALEXA世界排名网塔',
        collectType: '小说',
        addedAt: '2025-05-05 05:38',
        collectedAt: '2022-09-21 08:30',
      }),
    ])
  })
})
