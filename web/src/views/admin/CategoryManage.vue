<template>
  <div class="category-manage">
    <el-card>
      <template #header>
        <div class="card-header">
          <div>
            <h2>分类管理</h2>
            <p>手动维护书籍分类，后续可用于书籍选择和内容归类。</p>
          </div>
          <el-button type="primary" @click="openCreateDialog">新增分类</el-button>
        </div>
      </template>

      <el-table :data="categories" stripe v-loading="loading">
        <el-table-column prop="name" label="分类名称" min-width="180" />
        <el-table-column prop="sortOrder" label="排序" width="100" align="center" />
        <el-table-column prop="isActive" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'">
              {{ row.isActive ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="deleteCategory(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑分类' : '新增分类'" width="420px">
      <el-form label-position="top">
        <el-form-item label="分类名称" required>
          <el-input v-model="form.name" placeholder="例如：玄幻、都市、历史" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :max="999999" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.isActive" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveCategory">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminApi, unwrapResponse, type BookCategory } from '@/api'

const categories = ref<BookCategory[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({
  name: '',
  sortOrder: 0,
  isActive: true,
})

function formatDate(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN')
}

async function loadCategories() {
  loading.value = true
  try {
    categories.value = unwrapResponse<BookCategory[]>(await adminApi.getBookCategories()) || []
  } catch {
    ElMessage.error('加载分类失败')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.sortOrder = 0
  form.isActive = true
}

function openCreateDialog() {
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row: BookCategory) {
  editingId.value = row.id
  form.name = row.name
  form.sortOrder = row.sortOrder || 0
  form.isActive = Boolean(row.isActive)
  dialogVisible.value = true
}

async function saveCategory() {
  const name = form.name.trim()
  if (!name) {
    ElMessage.warning('请输入分类名称')
    return
  }

  saving.value = true
  try {
    if (editingId.value) {
      await adminApi.updateBookCategory({
        id: editingId.value,
        name,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      })
    } else {
      await adminApi.createBookCategory({
        name,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      })
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await loadCategories()
  } catch {
    ElMessage.error('保存失败，可能分类名称已存在')
  } finally {
    saving.value = false
  }
}

function deleteCategory(row: BookCategory) {
  ElMessageBox.confirm(`确定删除分类「${row.name}」？`, '确认删除', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
    confirmButtonClass: 'el-button--danger',
  }).then(async () => {
    try {
      await adminApi.deleteBookCategory(row.id)
      ElMessage.success('删除成功')
      await loadCategories()
    } catch {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

onMounted(loadCategories)
</script>

<style scoped lang="scss">
.category-manage {
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;

    h2 {
      margin: 0 0 6px;
      font-size: 20px;
    }

    p {
      margin: 0;
      color: var(--el-text-color-secondary);
    }
  }
}
</style>
