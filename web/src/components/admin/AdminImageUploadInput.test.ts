import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const currentDir = dirname(fileURLToPath(import.meta.url))
const componentSource = readFileSync(resolve(currentDir, 'AdminImageUploadInput.vue'), 'utf-8')
const femaleSource = readFileSync(resolve(currentDir, '../../views/admin/page-manage/FemaleChannelManage.vue'), 'utf-8')
const basicDataSource = readFileSync(resolve(currentDir, '../../views/admin/BasicData.vue'), 'utf-8')
const siteConfigSource = readFileSync(resolve(currentDir, '../../views/admin/SiteConfig.vue'), 'utf-8')
const adSource = readFileSync(resolve(currentDir, '../../views/admin/AdManage.vue'), 'utf-8')

describe('后台全局图片上传输入框', () => {
  it('提供 URL 输入、本地上传和预览能力', () => {
    expect(componentSource).toContain('action="/api/upload"')
    expect(componentSource).toContain('accept="image/*"')
    expect(componentSource).toContain('上传图片')
    expect(componentSource).toContain('el-image')
    expect(componentSource).toContain('Authorization')
  })

  it('接入女生频道条目封面、基础数据封面和站点图片配置', () => {
    expect(femaleSource).toContain('<AdminImageUploadInput')
    expect(basicDataSource).toContain('<AdminImageUploadInput')
    expect(siteConfigSource).toContain('<AdminImageUploadInput')
    expect(adSource).toContain('<AdminImageUploadInput')
  })
})
