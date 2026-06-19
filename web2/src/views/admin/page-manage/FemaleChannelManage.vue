<template>
  <div class="female-channel-manage">
    <div class="page-header">
      <div>
        <h2>女生频道</h2>
        <p>管理前台 `/girls` 与 `/home/girls.html` 频道页的推荐区块、幻灯片和分类内容。</p>
      </div>
      <div>
        <el-button @click="loadChannel">刷新</el-button>
        <el-button type="primary" :loading="seeding" @click="seed">初始化女生频道</el-button>
      </div>
    </div>

    <el-empty v-if="!loading && !channel" description="女生频道尚未初始化">
      <el-button type="primary" :loading="seeding" @click="seed">初始化女生频道</el-button>
    </el-empty>

    <el-tabs v-else v-model="activeTab" v-loading="loading" type="border-card">
      <el-tab-pane label="页面设置" name="settings">
        <el-form v-if="channel" :model="channelForm" label-width="110px" class="settings-form">
          <el-form-item label="频道名称">
            <el-input v-model="channelForm.name" />
          </el-form-item>
          <el-form-item label="页面路径">
            <el-input v-model="channelForm.path" />
          </el-form-item>
          <el-form-item label="兼容路径">
            <el-input v-model="channelForm.compat_path" />
          </el-form-item>
          <el-form-item label="SEO标题">
            <el-input v-model="channelForm.seo_title" />
          </el-form-item>
          <el-form-item label="SEO关键词">
            <el-input v-model="channelForm.seo_keywords" />
          </el-form-item>
          <el-form-item label="SEO描述">
            <el-input v-model="channelForm.seo_description" type="textarea" :rows="4" />
          </el-form-item>
          <el-form-item label="启用状态">
            <el-switch v-model="channelForm.is_active" active-text="启用" inactive-text="停用" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="savingChannel" @click="saveChannel">保存页面设置</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane v-for="group in groups" :key="group.name" :label="group.label" :name="group.name">
        <div v-for="section in group.sections" :key="section.id" class="section-card">
          <div class="section-head">
            <div>
              <strong>{{ section.title }}</strong>
              <span>{{ section.section_code }} · {{ section.display_type }}</span>
            </div>
            <div>
              <el-button size="small" @click="openSectionDialog(section)">编辑区块</el-button>
              <el-button size="small" type="primary" @click="openItemDialog(section)">添加条目</el-button>
            </div>
          </div>

          <el-table :data="section.items" border>
            <el-table-column prop="sort_order" label="排序" width="70" />
            <el-table-column label="封面" width="82">
              <template #default="{ row }">
                <el-image v-if="row.cover_url" :src="row.cover_url" fit="cover" style="width:46px;height:62px;border-radius:4px" />
                <span v-else class="muted">无</span>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="160" />
            <el-table-column prop="author" label="作者" width="120" />
            <el-table-column prop="category" label="分类" width="100" />
            <el-table-column prop="link_url" label="链接" min-width="180" show-overflow-tooltip />
            <el-table-column prop="is_active" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.is_active ? 'success' : 'info'">{{ row.is_active ? '启用' : '停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="openItemDialog(section, row)">编辑</el-button>
                <el-button size="small" type="danger" @click="removeItem(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="sectionDialog.visible" title="编辑区块" width="520px">
      <el-form :model="sectionDialog.form" label-width="90px">
        <el-form-item label="标题"><el-input v-model="sectionDialog.form.title" /></el-form-item>
        <el-form-item label="更多链接"><el-input v-model="sectionDialog.form.more_link" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="sectionDialog.form.sort_order" :min="0" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="sectionDialog.form.is_active" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sectionDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="savingSection" @click="saveSection">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="itemDialog.visible" :title="itemDialog.form.id ? '编辑条目' : '添加条目'" width="680px">
      <el-form :model="itemDialog.form" label-width="100px">
        <el-form-item label="标题"><el-input v-model="itemDialog.form.title" /></el-form-item>
        <el-form-item label="作者"><el-input v-model="itemDialog.form.author" /></el-form-item>
        <el-form-item label="封面图">
          <AdminImageUploadInput
            v-model="itemDialog.form.cover_url"
            placeholder="图片 URL，可留空，或上传本地图片"
            preview-height="120px"
          />
        </el-form-item>
        <el-form-item label="简介"><el-input v-model="itemDialog.form.intro" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="分类">
          <el-select
            v-model="itemDialog.form.category"
            placeholder="请选择后台分类管理中的分类"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="category in activeCategories"
              :key="category.id"
              :label="category.name"
              :value="category.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="字数"><el-input v-model="itemDialog.form.word_count" /></el-form-item>
        <el-form-item label="最新章节"><el-input v-model="itemDialog.form.latest_chapter" /></el-form-item>
        <el-form-item label="跳转链接"><el-input v-model="itemDialog.form.link_url" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="itemDialog.form.sort_order" :min="0" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="itemDialog.form.is_active" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="savingItem" @click="saveItem">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminApi, pageAdminApi, unwrapResponse, type BookCategory, type PageChannel, type PageChannelItem, type PageChannelSection } from '@/api'
import AdminImageUploadInput from '@/components/admin/AdminImageUploadInput.vue'

const loading = ref(false)
const seeding = ref(false)
const savingChannel = ref(false)
const savingSection = ref(false)
const savingItem = ref(false)
const activeTab = ref('settings')
const channel = ref<PageChannel | null>(null)
const categories = ref<BookCategory[]>([])

const channelForm = reactive({
  name: '',
  path: '/girls',
  compat_path: '/home/girls.html',
  seo_title: '',
  seo_keywords: '',
  seo_description: '',
  is_active: true,
})

const sectionDialog = reactive({
  visible: false,
  form: {} as Partial<PageChannelSection>,
})

const itemDialog = reactive({
  visible: false,
  sectionId: 0,
  form: {} as Partial<PageChannelItem>,
})

const groupConfig = [
  { name: 'editor', label: '编辑推荐', codes: ['editor_recommend'] },
  { name: 'slider', label: '幻灯片', codes: ['hero_slider'] },
  { name: 'chief', label: '主编推荐', codes: ['chief_recommend'] },
  { name: 'force', label: '小编力荐', codes: ['editor_force'] },
  { name: 'rising', label: '晋级新书', codes: ['rising_new'] },
  { name: 'debut', label: '新书首秀', codes: ['new_debut'] },
  { name: 'category', label: '分类推荐', codes: ['ancient_romance', 'modern_romance', 'fantasy_romance', 'xianxia', 'youth', 'game', 'sci_fi', 'mystery'] },
  { name: 'updates', label: '更新列表', codes: ['latest_updates', 'latest_added', 'most_updated'] },
]

const groups = computed(() => groupConfig.map((g) => ({
  ...g,
  sections: (channel.value?.sections || []).filter((s) => g.codes.includes(s.section_code)),
})))

const activeCategories = computed(() => categories.value.filter((item) => item.isActive !== false))

function fillForm(data: PageChannel) {
  channelForm.name = data.name || '女生频道'
  channelForm.path = data.path || '/girls'
  channelForm.compat_path = data.compat_path || '/home/girls.html'
  channelForm.seo_title = data.seo_title || ''
  channelForm.seo_keywords = data.seo_keywords || ''
  channelForm.seo_description = data.seo_description || ''
  channelForm.is_active = !!data.is_active
}

async function loadChannel() {
  loading.value = true
  try {
    const data = await pageAdminApi.getChannel('female')
    channel.value = data
    if (data) fillForm(data)
  } catch (e: any) {
    ElMessage.error(e?.message || '读取女生频道失败')
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    categories.value = unwrapResponse<BookCategory[]>(await adminApi.getBookCategories()) || []
  } catch {
    ElMessage.error('加载分类失败')
  }
}

async function seed() {
  seeding.value = true
  try {
    const data = await pageAdminApi.seedChannel('female')
    channel.value = data
    fillForm(data)
    ElMessage.success('女生频道已初始化')
  } catch (e: any) {
    ElMessage.error(e?.message || '初始化失败')
  } finally {
    seeding.value = false
  }
}

async function saveChannel() {
  savingChannel.value = true
  try {
    const data = await pageAdminApi.updateChannel('female', channelForm as any)
    channel.value = data
    fillForm(data)
    ElMessage.success('页面设置已保存')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingChannel.value = false
  }
}

function openSectionDialog(section: PageChannelSection) {
  sectionDialog.form = { ...section, is_active: !!section.is_active }
  sectionDialog.visible = true
}

async function saveSection() {
  if (!sectionDialog.form.id) return
  savingSection.value = true
  try {
    await pageAdminApi.updateSection(sectionDialog.form.id, sectionDialog.form)
    sectionDialog.visible = false
    await loadChannel()
    ElMessage.success('区块已保存')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存区块失败')
  } finally {
    savingSection.value = false
  }
}

function openItemDialog(section: PageChannelSection, item?: PageChannelItem) {
  itemDialog.sectionId = section.id
  itemDialog.form = item ? { ...item, is_active: !!item.is_active } : {
    title: '',
    author: '',
    cover_url: '',
    intro: '',
    category: section.title,
    word_count: '',
    latest_chapter: '',
    link_url: '',
    sort_order: (section.items?.length || 0) + 1,
    is_active: true,
  }
  itemDialog.visible = true
}

async function saveItem() {
  savingItem.value = true
  try {
    if (itemDialog.form.id) {
      await pageAdminApi.updateItem(itemDialog.form.id, itemDialog.form)
    } else {
      await pageAdminApi.createItem(itemDialog.sectionId, itemDialog.form)
    }
    itemDialog.visible = false
    await loadChannel()
    ElMessage.success('条目已保存')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存条目失败')
  } finally {
    savingItem.value = false
  }
}

async function removeItem(id: number) {
  await ElMessageBox.confirm('确认删除这个条目吗？', '删除确认', { type: 'warning' })
  try {
    await pageAdminApi.deleteItem(id)
    await loadChannel()
    ElMessage.success('条目已删除')
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(() => {
  loadChannel()
  loadCategories()
})
</script>

<style scoped lang="scss">
.female-channel-manage {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;

    h2 {
      margin: 0 0 8px;
      font-size: 22px;
    }

    p {
      margin: 0;
      color: var(--el-text-color-secondary);
    }
  }

  .settings-form {
    max-width: 760px;
  }

  .section-card {
    margin-bottom: 18px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    overflow: hidden;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    background: var(--el-fill-color-light);

    strong {
      display: block;
      margin-bottom: 4px;
    }

    span {
      color: var(--el-text-color-secondary);
      font-size: 12px;
    }
  }

  .muted {
    color: var(--el-text-color-secondary);
  }
}
</style>
