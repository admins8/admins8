import { describe, expect, it } from 'vitest'
import { isMediaLikeSource } from './mediaSourceClassifier'

describe('isMediaLikeSource', () => {
  it('识别漫画、有声、图片和短剧类书源', () => {
    expect(isMediaLikeSource({ bookSourceName: '漫蛙漫画', bookSourceGroup: '', bookSourceComment: '' })).toBe(true)
    expect(isMediaLikeSource({ bookSourceName: '喜马拉雅有声', bookSourceGroup: '', bookSourceComment: '' })).toBe(true)
    expect(isMediaLikeSource({ bookSourceName: '图片写真', bookSourceGroup: '', bookSourceComment: '' })).toBe(true)
    expect(isMediaLikeSource({ bookSourceName: '短剧资源', bookSourceGroup: '', bookSourceComment: '' })).toBe(true)
  })

  it('普通小说源不识别为媒体类书源', () => {
    expect(isMediaLikeSource({ bookSourceName: '笔趣阁小说', bookSourceGroup: '小说', bookSourceComment: '' })).toBe(false)
  })
})
