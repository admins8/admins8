<template>
  <div class="home-content-manage">
    <div class="page-header">
      <h2>基础数据</h2>
      <p class="page-desc">管理首页热门搜索、热门排行榜、热门标签等基础展示数据。</p>
    </div>
    <el-tabs v-model="activeTab" type="border-card">
      <!-- 热门搜索管理 -->
      <el-tab-pane label="热门搜索" name="searches">
        <div class="tab-header">
          <el-button type="primary" :icon="Plus" @click="openSearchDialog()">添加热门搜索</el-button>
        </div>
        <el-table :data="searches" stripe style="width: 100%">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="name" label="名称" />
          <el-table-column prop="count" label="搜索次数" width="100" />
          <el-table-column prop="tag_type" label="标签类型" width="100">
            <template #default="{ row }">
              <el-tag :type="row.tag_type">{{ row.tag_type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="sort_order" label="排序" width="80" />
          <el-table-column prop="is_active" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.is_active ? 'success' : 'info'">{{ row.is_active ? '启用' : '禁用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="openSearchDialog(row)">编辑</el-button>
              <el-button type="danger" size="small" @click="deleteSearch(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 热门排行榜管理 -->
      <el-tab-pane label="热门排行榜" name="rankings">
        <div class="tab-header rank-toolbar">
          <div class="rank-filters">
            <el-select v-model="rankTypeFilter" placeholder="全部类型" clearable style="width: 140px;" @change="loadRankings">
              <el-option v-for="t in rankTypes" :key="t.code" :label="t.label" :value="t.code" />
            </el-select>
            <el-select v-model="rankCategoryFilter" placeholder="全部分类" clearable style="width: 130px;" @change="loadRankings">
              <el-option v-for="c in rankCategories" :key="c" :label="c" :value="c" />
            </el-select>
          </div>
          <div class="rank-actions">
            <el-button type="success" :icon="RefreshRight" :loading="refreshing" @click="autoRefreshRankings">
              一键自动刷新
            </el-button>
            <el-button type="primary" :icon="Plus" @click="openRankingDialog()">添加排行榜</el-button>
          </div>
        </div>
        <el-table :data="rankings" stripe style="width: 100%">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column label="榜单" width="100">
            <template #default="{ row }">
              <el-tag :type="rankTagType(row.rank_type)">{{ rankLabel(row.rank_type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="category" label="分类" width="80" />
          <el-table-column label="封面" width="70">
            <template #default="{ row }">
              <el-image
                v-if="row.cover_url"
                :src="row.cover_url"
                fit="cover"
                style="width: 40px; height: 56px; border-radius: 3px;"
                :preview-src-list="[row.cover_url]"
                preview-teleported
              >
                <template #error>
                  <div style="width: 40px; height: 56px; background: #f0f0f0; border-radius: 3px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 11px;">无</div>
                </template>
              </el-image>
              <span v-else style="color: #999; font-size: 12px;">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="书名" min-width="120" />
          <el-table-column prop="author" label="作者" width="100" />
          <el-table-column prop="download_count" label="人气" width="80" />
          <el-table-column prop="review_count" label="评论" width="70" />
          <el-table-column prop="chapter_count" label="章节" width="70" />
          <el-table-column prop="word_count" label="字数(万)" width="80" />
          <el-table-column prop="sort_order" label="排序" width="70" />
          <el-table-column prop="is_active" label="状态" width="70">
            <template #default="{ row }">
              <el-tag :type="row.is_active ? 'success' : 'info'">{{ row.is_active ? '启用' : '禁用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="openRankingDialog(row)">编辑</el-button>
              <el-button type="danger" size="small" @click="deleteRanking(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 热门标签管理 -->
      <el-tab-pane label="热门标签" name="tags">
        <div class="tab-header">
          <el-button type="primary" :icon="Plus" @click="openTagDialog()">添加标签</el-button>
        </div>
        <el-table :data="tags" stripe style="width: 100%">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="name" label="标签名" />
          <el-table-column prop="sort_order" label="排序" width="80" />
          <el-table-column prop="is_active" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.is_active ? 'success' : 'info'">{{ row.is_active ? '启用' : '禁用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="openTagDialog(row)">编辑</el-button>
              <el-button type="danger" size="small" @click="deleteTag(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 热门搜索对话框 -->
    <el-dialog v-model="searchDialog.visible" :title="searchDialog.isEdit ? '编辑热门搜索' : '添加热门搜索'" width="500px">
      <el-form :model="searchDialog.form" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="searchDialog.form.name" placeholder="请输入名称" />
        </el-form-item>
        <el-form-item label="搜索次数">
          <el-input-number v-model="searchDialog.form.count" :min="0" />
        </el-form-item>
        <el-form-item label="标签类型">
          <el-select v-model="searchDialog.form.tag_type">
            <el-option label="primary（蓝色）" value="primary" />
            <el-option label="success（绿色）" value="success" />
            <el-option label="warning（黄色）" value="warning" />
            <el-option label="danger（红色）" value="danger" />
            <el-option label="info（灰色）" value="info" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="searchDialog.form.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="searchDialog.form.is_active" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="searchDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="saveSearch">确定</el-button>
      </template>
    </el-dialog>

    <!-- 排行榜对话框 -->
    <el-dialog v-model="rankingDialog.visible" :title="rankingDialog.isEdit ? '编辑排行榜' : '添加排行榜'" width="640px">
      <el-form :model="rankingDialog.form" label-width="100px">
        <el-form-item label="榜单类型">
          <el-select v-model="rankingDialog.form.rank_type" style="width: 100%;">
            <el-option v-for="t in rankTypes" :key="t.code" :label="t.label" :value="t.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="rankingDialog.form.category" style="width: 100%;">
            <el-option v-for="c in rankCategories" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="书名">
          <el-input v-model="rankingDialog.form.name" placeholder="请输入书名" />
        </el-form-item>
        <el-form-item label="作者">
          <el-input v-model="rankingDialog.form.author" placeholder="请输入作者" />
        </el-form-item>
        <el-form-item label="封面URL">
          <AdminImageUploadInput
            v-model="rankingDialog.form.cover_url"
            placeholder="请输入封面图片 URL，或上传本地图片（可选）"
            preview-height="120px"
          />
        </el-form-item>
        <el-form-item label="简介">
          <el-input
            v-model="rankingDialog.form.intro"
            type="textarea"
            :rows="3"
            placeholder="请输入书籍简介（可选）"
          />
        </el-form-item>
        <el-form-item label="书籍URL">
          <el-input v-model="rankingDialog.form.book_url" placeholder="请输入书籍URL（可选）" />
        </el-form-item>
        <el-form-item label="人气数">
          <el-input-number v-model="rankingDialog.form.download_count" :min="0" />
        </el-form-item>
        <el-form-item label="评论数">
          <el-input-number v-model="rankingDialog.form.review_count" :min="0" />
        </el-form-item>
        <el-form-item label="章节数">
          <el-input-number v-model="rankingDialog.form.chapter_count" :min="0" />
        </el-form-item>
        <el-form-item label="字数(万)">
          <el-input-number v-model="rankingDialog.form.word_count" :min="0" />
        </el-form-item>
        <el-form-item label="评分">
          <el-input-number v-model="rankingDialog.form.rating" :min="0" :max="5" :precision="1" :step="0.1" />
        </el-form-item>
        <el-form-item label="是否完本">
          <el-switch v-model="rankingDialog.form.is_complete" :active-value="1" :inactive-value="0" active-text="完本" inactive-text="连载" />
        </el-form-item>
        <el-form-item label="附加信息">
          <el-input v-model="rankingDialog.form.extra" placeholder="例如最新章节时间，可空" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="rankingDialog.form.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="rankingDialog.form.is_active" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rankingDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="saveRanking">确定</el-button>
      </template>
    </el-dialog>

    <!-- 标签对话框 -->
    <el-dialog v-model="tagDialog.visible" :title="tagDialog.isEdit ? '编辑标签' : '添加标签'" width="400px">
      <el-form :model="tagDialog.form" label-width="80px">
        <el-form-item label="标签名">
          <el-input v-model="tagDialog.form.name" placeholder="请输入标签名" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="tagDialog.form.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="tagDialog.form.is_active" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tagDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="saveTag">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, RefreshRight } from '@element-plus/icons-vue'
import { homeApi, unwrapResponse } from '@/api'
import type { RankTypeMeta } from '@/api'
import AdminImageUploadInput from '@/components/admin/AdminImageUploadInput.vue'

const activeTab = ref('searches')

const searches = ref<any[]>([])
const rankings = ref<any[]>([])
const tags = ref<any[]>([])

// 榜单类型 / 分类常量（来自后端）
const rankTypes = ref<RankTypeMeta[]>([])
const rankCategories = ref<string[]>(['全部'])
const rankTypeFilter = ref<string>('')
const rankCategoryFilter = ref<string>('')
const refreshing = ref(false)

const searchDialog = ref({
  visible: false,
  isEdit: false,
  form: { id: 0, name: '', count: 0, tag_type: 'primary', sort_order: 0, is_active: true },
})

const defaultRankingForm = () => ({
  id: 0,
  name: '',
  author: '',
  cover_url: '',
  intro: '',
  book_url: '',
  rank_type: 'popularity',
  category: '全部',
  download_count: 0,
  review_count: 0,
  chapter_count: 0,
  word_count: 0,
  rating: 0,
  is_complete: 0,
  extra: '',
  sort_order: 0,
  is_active: true,
})

const rankingDialog = ref({
  visible: false,
  isEdit: false,
  form: defaultRankingForm(),
})

const tagDialog = ref({
  visible: false,
  isEdit: false,
  form: { id: 0, name: '', sort_order: 0, is_active: true },
})

function rankLabel(code: string): string {
  return rankTypes.value.find((r) => r.code === code)?.label || code || '-'
}

function rankTagType(code: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  switch (code) {
    case 'popularity': return 'danger'
    case 'new': return 'success'
    case 'review': return 'warning'
    case 'chapter': return 'primary'
    case 'complete': return 'info'
    case 'wordcount': return 'primary'
    default: return 'info'
  }
}

async function loadMeta() {
  try {
    const res: any = await homeApi.getRankingMeta()
    const meta = unwrapResponse<{ types: RankTypeMeta[]; categories: string[] }>(res)
    rankTypes.value = meta?.types || []
    rankCategories.value = meta?.categories || ['全部']
  } catch {
    // 忽略
  }
}

async function loadRankings() {
  try {
    const res: any = await homeApi.getAllHotRankings({
      type: rankTypeFilter.value || undefined,
      category: rankCategoryFilter.value || undefined,
    })
    rankings.value = (res.data || []).map((item: any) => ({ ...item, is_active: !!item.is_active }))
  } catch {
    ElMessage.error('加载排行榜失败')
  }
}

async function loadData() {
  try {
    const [sRes, tRes]: any[] = await Promise.all([
      homeApi.getAllHotSearches(),
      homeApi.getAllHotTags(),
    ])
    searches.value = (sRes.data || []).map((item: any) => ({ ...item, is_active: !!item.is_active }))
    tags.value = (tRes.data || []).map((item: any) => ({ ...item, is_active: !!item.is_active }))
    await loadRankings()
  } catch (e) {
    ElMessage.error('加载数据失败')
  }
}

async function autoRefreshRankings() {
  try {
    await ElMessageBox.confirm(
      '将根据用户阅读情况自动重新生成 6 类榜单，会覆盖现有自动榜单数据。是否继续？',
      '一键自动刷新',
      { type: 'warning' }
    )
    refreshing.value = true
    const res: any = await homeApi.refreshRankings()
    const data = unwrapResponse<any>(res)
    ElMessage.success(`已根据 ${data?.sourceCount || 0} 本书生成 ${data?.inserted || 0} 条榜单数据`)
    await loadRankings()
  } catch (e: any) {
    if (e === 'cancel') return
    if (e?.message) ElMessage.error(e.message)
  } finally {
    refreshing.value = false
  }
}

// 热门搜索
function openSearchDialog(row?: any) {
  if (row) {
    searchDialog.value = { visible: true, isEdit: true, form: { ...row } }
  } else {
    searchDialog.value = { visible: true, isEdit: false, form: { id: 0, name: '', count: 0, tag_type: 'primary', sort_order: 0, is_active: true } }
  }
}

async function saveSearch() {
  try {
    const form = searchDialog.value.form
    if (!form.name) {
      ElMessage.warning('请输入名称')
      return
    }
    if (searchDialog.value.isEdit) {
      await homeApi.updateHotSearch(form)
      ElMessage.success('更新成功')
    } else {
      await homeApi.addHotSearch(form)
      ElMessage.success('添加成功')
    }
    searchDialog.value.visible = false
    loadData()
  } catch {
    ElMessage.error('操作失败')
  }
}

async function deleteSearch(id: number) {
  try {
    await ElMessageBox.confirm('确定删除该热门搜索？', '提示', { type: 'warning' })
    await homeApi.deleteHotSearch(id)
    ElMessage.success('删除成功')
    loadData()
  } catch {
    // 取消
  }
}

// 排行榜
function openRankingDialog(row?: any) {
  if (row) {
    rankingDialog.value = { visible: true, isEdit: true, form: { ...defaultRankingForm(), ...row, is_active: !!row.is_active } }
  } else {
    rankingDialog.value = { visible: true, isEdit: false, form: defaultRankingForm() }
  }
}

async function saveRanking() {
  try {
    const form = rankingDialog.value.form
    if (!form.name) {
      ElMessage.warning('请输入书名')
      return
    }
    if (rankingDialog.value.isEdit) {
      await homeApi.updateHotRanking(form)
      ElMessage.success('更新成功')
    } else {
      await homeApi.addHotRanking(form)
      ElMessage.success('添加成功')
    }
    rankingDialog.value.visible = false
    loadData()
  } catch {
    ElMessage.error('操作失败')
  }
}

async function deleteRanking(id: number) {
  try {
    await ElMessageBox.confirm('确定删除该排行榜？', '提示', { type: 'warning' })
    await homeApi.deleteHotRanking(id)
    ElMessage.success('删除成功')
    loadData()
  } catch {
    // 取消
  }
}

// 标签
function openTagDialog(row?: any) {
  if (row) {
    tagDialog.value = { visible: true, isEdit: true, form: { ...row } }
  } else {
    tagDialog.value = { visible: true, isEdit: false, form: { id: 0, name: '', sort_order: 0, is_active: true } }
  }
}

async function saveTag() {
  try {
    const form = tagDialog.value.form
    if (!form.name) {
      ElMessage.warning('请输入标签名')
      return
    }
    if (tagDialog.value.isEdit) {
      await homeApi.updateHotTag(form)
      ElMessage.success('更新成功')
    } else {
      await homeApi.addHotTag(form)
      ElMessage.success('添加成功')
    }
    tagDialog.value.visible = false
    loadData()
  } catch {
    ElMessage.error('操作失败')
  }
}

async function deleteTag(id: number) {
  try {
    await ElMessageBox.confirm('确定删除该标签？', '提示', { type: 'warning' })
    await homeApi.deleteHotTag(id)
    ElMessage.success('删除成功')
    loadData()
  } catch {
    // 取消
  }
}

onMounted(async () => {
  await loadMeta()
  await loadData()
})
</script>

<style scoped lang="scss">
.home-content-manage {
  .page-header {
    margin-bottom: 16px;

    h2 {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 600;
    }

    .page-desc {
      margin: 0;
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
  }

  .tab-header {
    margin-bottom: 16px;
  }

  .rank-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;

    .rank-filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .rank-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
  }

  :deep(.el-tabs__content) {
    overflow-x: auto;
  }

  :deep(.el-table) {
    min-width: 720px;
  }
}

@media (max-width: 768px) {
  .home-content-manage {
    :deep(.el-tabs__header) {
      overflow-x: auto;
    }

    :deep(.el-tabs__nav) {
      white-space: nowrap;
    }

    .tab-header .el-button {
      width: 100%;
    }
  }
}
</style>
