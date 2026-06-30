<template>
  <div class="ad-manage">
    <div class="page-header">
      <h2>广告管理</h2>
      <p class="page-desc">管理首页与阅读页广告位，可控制图片、文字、HTML 三种类型，支持时间段、排序与启用状态。</p>
    </div>

    <el-tabs v-model="activeTab" type="border-card" @tab-change="handleTabChange">
      <el-tab-pane label="首页广告" name="home">
        <component :is="AdTable"
          :positions="HOME_POSITIONS"
          :ads="homeAds"
          @add="openDialog"
          @edit="openDialog"
          @delete="handleDelete"
        />
      </el-tab-pane>
      <el-tab-pane label="阅读页广告" name="reader">
        <component :is="AdTable"
          :positions="READER_POSITIONS"
          :ads="readerAds"
          @add="openDialog"
          @edit="openDialog"
          @delete="handleDelete"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- 新增 / 编辑对话框 -->
    <el-dialog
      v-model="dialog.visible"
      :title="dialog.isEdit ? '编辑广告' : '添加广告'"
      width="640px"
      append-to-body
    >
      <el-form :model="dialog.form" label-width="100px">
        <el-form-item label="广告位置" required>
          <el-select v-model="dialog.form.position" placeholder="请选择广告位置" style="width: 100%">
            <el-option-group label="首页">
              <el-option
                v-for="item in HOME_POSITIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-option-group>
            <el-option-group label="阅读页">
              <el-option
                v-for="item in READER_POSITIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="广告标题">
          <el-input v-model="dialog.form.title" placeholder="可选，便于在后台辨识" />
        </el-form-item>
        <el-form-item label="广告类型">
          <el-radio-group v-model="dialog.form.ad_type">
            <el-radio value="image">图片</el-radio>
            <el-radio value="text">文字</el-radio>
            <el-radio value="html">HTML/代码</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="dialog.form.ad_type === 'image'" label="图片URL">
          <AdminImageUploadInput
            v-model="dialog.form.image_url"
            placeholder="可粘贴图片 URL，或上传本地图片"
            preview-fit="cover"
          />
        </el-form-item>
        <el-form-item v-if="dialog.form.ad_type !== 'image'" label="内容">
          <el-input
            v-model="dialog.form.content"
            type="textarea"
            :rows="5"
            :placeholder="dialog.form.ad_type === 'text' ? '请输入广告文字内容' : '请输入HTML代码（如统计代码、第三方广告联盟代码等）'"
          />
        </el-form-item>
        <el-form-item label="跳转链接">
          <el-input v-model="dialog.form.link_url" placeholder="点击广告跳转的URL（可选）" />
        </el-form-item>
        <el-form-item label="打开方式">
          <el-radio-group v-model="dialog.form.target">
            <el-radio value="_blank">新窗口</el-radio>
            <el-radio value="_self">当前窗口</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="生效时间">
          <el-date-picker
            v-model="dialog.form.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
          <div class="form-tips">留空表示立即生效且永不过期</div>
        </el-form-item>
        <template v-if="dialog.form.position === 'reader_popup'">
          <el-form-item label="弹窗间隔">
            <el-input-number v-model="dialog.form.popup_interval_seconds" :min="1" :step="60" />
            <span class="form-tips" style="margin-left: 12px;">单位：秒，默认 3600 秒</span>
          </el-form-item>
          <el-form-item label="自动关闭">
            <el-input-number v-model="dialog.form.popup_auto_close_seconds" :min="0" :step="1" />
            <span class="form-tips" style="margin-left: 12px;">单位：秒，0 表示不自动关闭</span>
          </el-form-item>
        </template>
        <el-form-item label="排序">
          <el-input-number v-model="dialog.form.sort_order" :min="0" />
          <span class="form-tips" style="margin-left: 12px;">数字越小越靠前</span>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="dialog.form.is_active" active-text="启用" inactive-text="禁用" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="dialog.form.remark" type="textarea" :rows="2" placeholder="后台备注，前台不展示" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.saving" @click="handleSave">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h, defineComponent, type PropType } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ElTable, ElTableColumn, ElTag, ElButton, ElImage, ElEmpty,
} from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { adApi, type Advertisement } from '@/api'
import AdminImageUploadInput from '@/components/admin/AdminImageUploadInput.vue'

interface PositionOption {
  label: string
  value: string
}

const HOME_POSITIONS: PositionOption[] = [
  { label: '首页顶部', value: 'home_top' },
  { label: '首页中部', value: 'home_middle' },
  { label: '首页底部', value: 'home_bottom' },
]

const READER_POSITIONS: PositionOption[] = [
  { label: '阅读页顶部', value: 'reader_top' },
  { label: '阅读页章节中', value: 'reader_middle' },
  { label: '阅读页底部', value: 'reader_bottom' },
  { label: '阅读页弹窗', value: 'reader_popup' },
]

const HOME_SET = new Set(HOME_POSITIONS.map((p) => p.value))
const READER_SET = new Set(READER_POSITIONS.map((p) => p.value))

const activeTab = ref<'home' | 'reader'>('home')
const allAds = ref<Advertisement[]>([])

const homeAds = computed(() => allAds.value.filter((ad) => HOME_SET.has(ad.position)))
const readerAds = computed(() => allAds.value.filter((ad) => READER_SET.has(ad.position)))

interface DialogState {
  visible: boolean
  isEdit: boolean
  saving: boolean
  form: {
    id: number
    position: string
    title: string
    image_url: string
    link_url: string
    content: string
    ad_type: 'image' | 'text' | 'html'
    target: string
    sort_order: number
    popup_interval_seconds: number
    popup_auto_close_seconds: number
    is_active: boolean
    remark: string
    dateRange: [string, string] | null
  }
}

function makeEmptyForm(position = ''): DialogState['form'] {
  return {
    id: 0,
    position,
    title: '',
    image_url: '',
    link_url: '',
    content: '',
    ad_type: 'image',
    target: '_blank',
    sort_order: 0,
    popup_interval_seconds: 3600,
    popup_auto_close_seconds: 10,
    is_active: true,
    remark: '',
    dateRange: null,
  }
}

const dialog = ref<DialogState>({
  visible: false,
  isEdit: false,
  saving: false,
  form: makeEmptyForm(),
})

async function loadData() {
  try {
    const res: any = await adApi.getAllAds()
    const list: Advertisement[] = (res?.data ?? res) || []
    allAds.value = list.map((item) => ({ ...item, is_active: !!item.is_active }))
  } catch (err) {
    ElMessage.error('加载广告列表失败')
  }
}

function handleTabChange() {
  // 切换标签时不需要额外动作，computed 会自动过滤
}

function openDialog(row?: Advertisement, defaultPosition?: string) {
  if (row) {
    dialog.value = {
      visible: true,
      isEdit: true,
      saving: false,
      form: {
        id: row.id,
        position: row.position,
        title: row.title || '',
        image_url: row.image_url || '',
        link_url: row.link_url || '',
        content: row.content || '',
        ad_type: (row.ad_type as any) || 'image',
        target: row.target || '_blank',
        sort_order: row.sort_order || 0,
        popup_interval_seconds: row.popup_interval_seconds || 3600,
        popup_auto_close_seconds: row.popup_auto_close_seconds ?? 10,
        is_active: !!row.is_active,
        remark: row.remark || '',
        dateRange: row.start_time && row.end_time
          ? [formatDateTime(row.start_time), formatDateTime(row.end_time)]
          : null,
      },
    }
  } else {
    const position = defaultPosition || (activeTab.value === 'home' ? 'home_top' : 'reader_top')
    dialog.value = {
      visible: true,
      isEdit: false,
      saving: false,
      form: makeEmptyForm(position),
    }
  }
}

function formatDateTime(value: string): string {
  if (!value) return ''
  // 兼容数据库返回的 ISO 字符串
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function handleSave() {
  const f = dialog.value.form
  if (!f.position) {
    ElMessage.warning('请选择广告位置')
    return
  }
  if (f.ad_type === 'image' && !f.image_url) {
    ElMessage.warning('请填写图片URL或上传图片')
    return
  }
  if (f.ad_type !== 'image' && !f.content) {
    ElMessage.warning('请填写广告内容')
    return
  }

  const payload: any = {
    id: f.id,
    position: f.position,
    title: f.title,
    image_url: f.image_url,
    link_url: f.link_url,
    content: f.content,
    ad_type: f.ad_type,
    target: f.target,
    sort_order: f.sort_order,
    popup_interval_seconds: f.popup_interval_seconds,
    popup_auto_close_seconds: f.popup_auto_close_seconds,
    is_active: f.is_active,
    remark: f.remark,
    start_time: f.dateRange?.[0] || null,
    end_time: f.dateRange?.[1] || null,
  }

  dialog.value.saving = true
  try {
    if (dialog.value.isEdit) {
      await adApi.updateAd(payload)
      ElMessage.success('更新成功')
    } else {
      await adApi.addAd(payload)
      ElMessage.success('添加成功')
    }
    dialog.value.visible = false
    loadData()
  } catch {
    ElMessage.error('保存失败')
  } finally {
    dialog.value.saving = false
  }
}

async function handleDelete(row: Advertisement) {
  try {
    await ElMessageBox.confirm(`确定删除广告"${row.title || row.position}"？`, '提示', { type: 'warning' })
    await adApi.deleteAd(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {
    // 取消
  }
}

// 内嵌的广告表格组件
const AdTable = defineComponent({
  name: 'AdTable',
  props: {
    positions: { type: Array as PropType<PositionOption[]>, required: true },
    ads: { type: Array as PropType<Advertisement[]>, required: true },
  },
  emits: ['add', 'edit', 'delete'],
  setup(props, { emit }) {
    const positionLabel = (value: string) => {
      const all = [...HOME_POSITIONS, ...READER_POSITIONS]
      return all.find((p) => p.value === value)?.label || value
    }

    return () => h('div', { class: 'ad-table-wrapper' }, [
      h('div', { class: 'tab-header' }, [
        h(ElButton, {
          type: 'primary',
          icon: Plus,
          onClick: () => emit('add', undefined, props.positions[0]?.value),
        }, () => '添加广告'),
      ]),
      props.ads.length === 0
        ? h(ElEmpty, { description: '暂无广告，点击上方"添加广告"按钮新建' })
        : h(ElTable, { data: props.ads, stripe: true, style: 'width: 100%' }, () => [
            h(ElTableColumn, { prop: 'id', label: 'ID', width: '60' }),
            h(ElTableColumn, {
              label: '位置', width: '120',
            }, { default: ({ row }: any) => h(ElTag, null, () => positionLabel(row.position)) }),
            h(ElTableColumn, { prop: 'title', label: '标题', minWidth: '140', showOverflowTooltip: true }),
            h(ElTableColumn, {
              label: '类型', width: '90',
            }, { default: ({ row }: any) => {
              const map: Record<string, string> = { image: '图片', text: '文字', html: 'HTML' }
              return h(ElTag, { type: 'info' }, () => map[row.ad_type] || row.ad_type)
            }}),
            h(ElTableColumn, {
              label: '预览', width: '90',
            }, { default: ({ row }: any) => row.ad_type === 'image' && row.image_url
              ? h(ElImage, {
                  src: row.image_url, fit: 'cover',
                  style: 'width: 60px; height: 36px; border-radius: 4px;',
                  previewSrcList: [row.image_url], previewTeleported: true,
                })
              : h('span', { style: 'color:#999;font-size:12px' }, '-')
            }),
            h(ElTableColumn, { prop: 'sort_order', label: '排序', width: '70' }),
            h(ElTableColumn, {
              label: '弹窗设置', width: '150',
            }, { default: ({ row }: any) => row.position === 'reader_popup'
              ? h('span', { style: 'font-size:12px;color:#606266;' }, `间隔 ${row.popup_interval_seconds || 3600}s / 关闭 ${row.popup_auto_close_seconds ?? 10}s`)
              : h('span', { style: 'color:#999;font-size:12px' }, '-')
            }),
            h(ElTableColumn, {
              label: '状态', width: '80',
            }, { default: ({ row }: any) => h(ElTag, {
              type: row.is_active ? 'success' : 'info',
            }, () => row.is_active ? '启用' : '禁用') }),
            h(ElTableColumn, {
              label: '操作', width: '160', fixed: 'right',
            }, { default: ({ row }: any) => [
              h(ElButton, { type: 'primary', size: 'small', onClick: () => emit('edit', row) }, () => '编辑'),
              h(ElButton, { type: 'danger', size: 'small', onClick: () => emit('delete', row) }, () => '删除'),
            ]}),
          ]),
    ])
  },
})

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.ad-manage {
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

  :deep(.tab-header) {
    margin-bottom: 16px;
  }

  :deep(.el-table) {
    min-width: 720px;
  }

  :deep(.el-tabs__content) {
    overflow-x: auto;
  }

  .upload-row {
    display: flex;
    gap: 8px;
    width: 100%;

    .el-input {
      flex: 1;
    }
  }

  .preview {
    margin-top: 8px;

    .el-image {
      max-width: 280px;
      max-height: 140px;
      border-radius: 6px;
      border: 1px solid var(--el-border-color-lighter);
    }
  }

  .form-tips {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

@media (max-width: 768px) {
  .ad-manage {
    :deep(.el-tabs__header) {
      overflow-x: auto;
    }

    :deep(.el-tabs__nav) {
      white-space: nowrap;
    }

    .upload-row {
      flex-direction: column;
    }
  }
}
</style>
