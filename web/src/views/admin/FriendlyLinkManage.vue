<template>
  <div class="friendly-link-manage">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <h2>友情链接</h2>
            <p>管理前台底部展示的友情链接，支持启用状态和展示时间范围。</p>
          </div>
          <div class="header-actions">
            <el-switch
              v-model="enabled"
              active-text="显示"
              inactive-text="关闭"
              @change="saveSettings"
            />
            <el-button type="primary" @click="openDialog()">新增链接</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="links" border>
        <el-table-column prop="name" label="站点名称" min-width="140" />
        <el-table-column prop="url" label="链接地址" min-width="220" show-overflow-tooltip />
        <el-table-column prop="sort_order" label="排序" width="80" />
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-tag :type="Number(row.is_active) === 1 ? 'success' : 'info'">
              {{ Number(row.is_active) === 1 ? '启用' : '关闭' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="开始时间" width="180">
          <template #default="{ row }">{{ row.start_at || '不限' }}</template>
        </el-table-column>
        <el-table-column label="结束时间" width="180">
          <template #default="{ row }">{{ row.end_at || '不限' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="deleteLink(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑友情链接' : '新增友情链接'" width="560px">
      <el-form label-position="top">
        <el-form-item label="站点名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="链接地址">
          <el-input v-model="form.url" placeholder="https://example.com" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="排序">
              <el-input-number v-model="form.sort_order" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否启用">
              <el-switch v-model="form.is_active" :active-value="1" :inactive-value="0" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="展示时间范围">
          <el-date-picker
            v-model="timeRange"
            type="datetimerange"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveLink">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { pageAdminApi, type FriendlyLink } from '@/api'

const loading = ref(false)
const saving = ref(false)
const enabled = ref(true)
const links = ref<FriendlyLink[]>([])
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const timeRange = ref<[string, string] | null>(null)

const form = reactive({
  name: '',
  url: '',
  description: '',
  sort_order: 0,
  is_active: 1,
})

async function loadData() {
  loading.value = true
  try {
    const data = await pageAdminApi.listFriendlyLinks()
    links.value = data.links || []
    enabled.value = data.settings?.enabled !== false
  } catch {
    ElMessage.error('加载友情链接失败')
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  try {
    await pageAdminApi.updateFriendlyLinkSettings(enabled.value)
    window.dispatchEvent(new Event('friendly-links-updated'))
    ElMessage.success('设置已保存')
  } catch {
    ElMessage.error('设置保存失败')
  }
}

function openDialog(row?: FriendlyLink) {
  editingId.value = row?.id || null
  Object.assign(form, {
    name: row?.name || '',
    url: row?.url || '',
    description: row?.description || '',
    sort_order: Number(row?.sort_order || 0),
    is_active: Number(row?.is_active ?? 1) === 1 ? 1 : 0,
  })
  timeRange.value = row?.start_at || row?.end_at ? [row.start_at || '', row.end_at || ''] : null
  dialogVisible.value = true
}

async function saveLink() {
  saving.value = true
  try {
    const payload = {
      ...form,
      start_at: timeRange.value?.[0] || null,
      end_at: timeRange.value?.[1] || null,
    }
    if (editingId.value) {
      await pageAdminApi.updateFriendlyLink(editingId.value, payload)
    } else {
      await pageAdminApi.createFriendlyLink(payload)
    }
    dialogVisible.value = false
    window.dispatchEvent(new Event('friendly-links-updated'))
    ElMessage.success('保存成功')
    await loadData()
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function deleteLink(row: FriendlyLink) {
  try {
    await ElMessageBox.confirm(`确认删除友情链接“${row.name}”？`, '删除确认', { type: 'warning' })
    await pageAdminApi.deleteFriendlyLink(row.id!)
    window.dispatchEvent(new Event('friendly-links-updated'))
    ElMessage.success('删除成功')
    await loadData()
  } catch {
    // 用户取消或删除失败均不打断页面
  }
}

onMounted(loadData)
</script>

<style scoped lang="scss">
.friendly-link-manage {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;

    h2 {
      margin: 0 0 6px;
    }

    p {
      margin: 0;
      color: #909399;
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }
}
</style>
