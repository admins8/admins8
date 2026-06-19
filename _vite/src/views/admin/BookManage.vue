<template>
  <div class="book-manage">
    <div class="page-header">
      <h2>书籍管理</h2>
      <div class="header-info">
        <el-tag>共 {{ total }} 本书籍</el-tag>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="filter-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索书名或作者..."
        prefix-icon="Search"
        clearable
        class="search-input"
      />
      <el-button type="warning" :loading="deduping" @click="dedupeBooks">
        <el-icon><Delete /></el-icon>书籍去重
      </el-button>
      <div class="auto-dedupe-setting">
        <span class="setting-label">自动去重：</span>
        <el-input-number
          v-model="autoDedupeDays"
          :min="0"
          :max="365"
          :step="1"
          size="small"
          controls-position="right"
          style="width: 120px"
        />
        <span class="setting-unit">天/次</span>
        <el-button type="primary" size="small" :loading="savingInterval" @click="saveAutoDedupeInterval">
          保存
        </el-button>
        <el-tag v-if="autoDedupeDays > 0" type="success" size="small" class="status-tag">
          已启用
        </el-tag>
        <el-tag v-else type="info" size="small" class="status-tag">
          未启用
        </el-tag>
      </div>
    </div>

    <!-- 书籍表格 -->
    <el-table :data="filteredBooks" stripe class="book-table">
      <el-table-column prop="name" label="书名" min-width="180">
        <template #default="{ row }">
          <div class="book-cell">
            <el-image
              :src="row.coverUrl || defaultCover"
              fit="cover"
              class="book-thumb"
            >
              <template #error>
                <div class="thumb-placeholder">{{ row.name?.charAt(0) }}</div>
              </template>
            </el-image>
            <span class="book-name">{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="author" label="作者" width="120" show-overflow-tooltip />
      <el-table-column prop="sourceName" label="来源" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.sourceName || row.sourceUrl || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="totalChapterNum" label="章节数" width="80" align="center">
        <template #default="{ row }">
          {{ row.totalChapterNum ?? '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="lastReadTime" label="最后阅读" width="160">
        <template #default="{ row }">
          {{ formatDate(row.lastReadTime) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <el-button type="danger" link size="small" @click="deleteBook(row)">
            <el-icon><Delete /></el-icon>删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @size-change="loadBooks"
        @current-change="loadBooks"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { adminApi, configApi, unwrapResponse, type Book } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'

const books = ref<Book[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const searchKeyword = ref('')
const deduping = ref(false)
const autoDedupeDays = ref(0)
const savingInterval = ref(false)

const defaultCover = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNTQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjU0IiBmaWxsPSIjNDA5RUZGIi8+PC9zdmc+'

const filteredBooks = computed(() => {
  if (!searchKeyword.value) return books.value
  const kw = searchKeyword.value.toLowerCase()
  return books.value.filter(
    (b) =>
      b.name?.toLowerCase().includes(kw) ||
      b.author?.toLowerCase().includes(kw)
  )
})

function formatDate(dateStr?: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

async function loadBooks() {
  try {
    const res = unwrapResponse<{ list: Book[]; total: number }>(
      await adminApi.getAllBooks(currentPage.value, pageSize.value, searchKeyword.value)
    )
    books.value = res.list
    total.value = res.total
  } catch {
    ElMessage.error('加载书籍列表失败')
  }
}

function deleteBook(book: Book) {
  ElMessageBox.confirm(`确定删除书籍「${book.name}」？此操作不可撤销。`, '警告', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'warning',
    confirmButtonClass: 'el-button--danger',
  }).then(async () => {
    try {
      await adminApi.deleteBook(book.bookUrl!)
      ElMessage.success('删除成功')
      await loadBooks()
    } catch {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

async function dedupeBooks() {
  try {
    await ElMessageBox.confirm(
      '将按书名+作者去重，每组重复书籍只保留章节最多的那条，其余删除。同时自动净化作者字段。确定执行？',
      '书籍去重',
      { confirmButtonText: '确定去重', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  deduping.value = true
  try {
    const res = unwrapResponse<{ removed: number; groups: number }>(
      await adminApi.dedupeBooks()
    )
    ElMessage.success(res.msg || `去重完成，删除 ${res.removed} 条重复`)
    await loadBooks()
  } catch (e: any) {
    ElMessage.error(e?.message || '去重失败')
  } finally {
    deduping.value = false
  }
}

async function loadAutoDedupeConfig() {
  try {
    const res = unwrapResponse<{ config_key: string; config_value: string }>(
      await configApi.getConfig('auto_dedupe_interval_days')
    )
    autoDedupeDays.value = Number(res?.config_value || 0)
  } catch {
    autoDedupeDays.value = 0
  }
}

async function saveAutoDedupeInterval() {
  savingInterval.value = true
  try {
    await configApi.updateConfig({
      config_key: 'auto_dedupe_interval_days',
      config_value: String(autoDedupeDays.value),
    })
    ElMessage.success(autoDedupeDays.value > 0 ? `已设置每隔 ${autoDedupeDays.value} 天自动去重` : '已关闭自动去重')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingInterval.value = false
  }
}

onMounted(() => {
  loadBooks()
  loadAutoDedupeConfig()
})
</script>

<style scoped lang="scss">
.book-manage {
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
  }

  .filter-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    align-items: center;
    flex-wrap: wrap;

    .search-input {
      width: 280px;
    }

    .auto-dedupe-setting {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--el-text-color-regular);

      .setting-label {
        white-space: nowrap;
      }

      .setting-unit {
        white-space: nowrap;
        color: var(--el-text-color-secondary);
      }

      .status-tag {
        margin-left: 2px;
      }
    }
  }

  .book-table {
    border-radius: 8px;
    overflow: hidden;
  }

  .book-cell {
    display: flex;
    align-items: center;
    gap: 10px;

    .book-thumb {
      width: 36px;
      height: 48px;
      border-radius: 4px;
      flex-shrink: 0;
      overflow: hidden;
    }

    .thumb-placeholder {
      width: 36px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #409eff, #67c23a);
      color: white;
      font-size: 16px;
      font-weight: 700;
      border-radius: 4px;
    }

    .book-name {
      font-weight: 500;
    }
  }

  .pagination-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
}

@media (max-width: 768px) {
  .book-manage {
    .page-header {
      align-items: flex-start;
      flex-direction: column;
      gap: 10px;
    }

    .filter-bar {
      flex-wrap: wrap;

      .search-input {
        width: 100%;
      }
    }

    .pagination-wrapper {
      justify-content: center;
      overflow-x: auto;
    }
  }
}
</style>
