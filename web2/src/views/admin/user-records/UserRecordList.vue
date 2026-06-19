<template>
  <div class="user-record-list">
    <div class="page-header">
      <h2>{{ recordConfig.title }}</h2>
      <el-tag>共 {{ total }} 条记录</el-tag>
    </div>

    <div class="filter-bar">
      <el-input
        v-model="keyword"
        placeholder="搜索用户名、邮箱或关键词..."
        clearable
        class="search-input"
        @change="loadRecords"
      />
      <el-input
        v-if="recordConfig.hasBookSearch"
        v-model="bookKeyword"
        placeholder="搜索书名、作者或书籍地址..."
        clearable
        class="search-input"
        @change="loadRecords"
      />
      <el-button type="primary" @click="loadRecords">查询</el-button>
    </div>

    <el-table :key="type" :data="records" stripe border v-loading="loading">
      <el-table-column prop="username" label="用户名" min-width="120" />
      <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />

      <template v-if="type === 'reading'">
        <el-table-column prop="book_name" label="书名" min-width="180" show-overflow-tooltip />
        <el-table-column prop="author" label="作者" width="120" show-overflow-tooltip />
        <el-table-column prop="dur_chapter_title" label="最近章节" min-width="180" show-overflow-tooltip />
        <el-table-column prop="dur_chapter_index" label="章节序号" width="100" />
        <el-table-column label="最近阅读" width="180">
          <template #default="{ row }">{{ formatDate(row.dur_chapter_time) }}</template>
        </el-table-column>
      </template>

      <template v-else-if="type === 'favorites'">
        <el-table-column prop="book_name" label="书名" min-width="180" show-overflow-tooltip />
        <el-table-column prop="author" label="作者" width="120" show-overflow-tooltip />
        <el-table-column prop="book_url" label="书籍地址" min-width="220" show-overflow-tooltip />
        <el-table-column label="收藏时间" width="180">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
      </template>

      <template v-else-if="type === 'searches'">
        <el-table-column prop="keyword" label="搜索关键词" min-width="180" />
        <el-table-column prop="result_count" label="结果数" width="90" />
        <el-table-column prop="ip_address" label="IP" width="150" />
        <el-table-column label="搜索时间" width="180">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
      </template>

      <template v-else-if="type === 'comments'">
        <el-table-column prop="book_name" label="书名" min-width="160" show-overflow-tooltip />
        <el-table-column prop="content" label="评论内容" min-width="260" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="Number(row.is_active) === 1 ? 'success' : 'info'">
              {{ Number(row.is_active) === 1 ? '显示' : '隐藏' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="评论时间" width="180">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
      </template>

      <template v-else-if="type === 'likes'">
        <el-table-column prop="target_type" label="点赞类型" width="110" />
        <el-table-column prop="book_name" label="书名" min-width="160" show-overflow-tooltip />
        <el-table-column prop="author" label="作者" width="120" show-overflow-tooltip />
        <el-table-column prop="target_id" label="目标ID" min-width="140" show-overflow-tooltip />
        <el-table-column label="点赞时间" width="180">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
      </template>

      <template v-else-if="type === 'checkins'">
        <el-table-column prop="checkin_date" label="签到日期" width="150" />
        <el-table-column prop="points" label="积分" width="100" />
        <el-table-column label="签到时间" width="180">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
      </template>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @size-change="loadRecords"
        @current-change="loadRecords"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { adminApi, unwrapResponse } from '@/api'

const route = useRoute()
const type = computed(() => String(route.meta.recordType || 'reading'))

const recordConfigs: Record<string, { title: string; hasBookSearch: boolean }> = {
  reading: { title: '阅读记录', hasBookSearch: true },
  searches: { title: '搜索记录', hasBookSearch: false },
  comments: { title: '评论记录', hasBookSearch: true },
  likes: { title: '点赞记录', hasBookSearch: true },
  favorites: { title: '收藏记录', hasBookSearch: true },
  checkins: { title: '签到记录', hasBookSearch: false },
}

const recordConfig = computed(() => recordConfigs[type.value] || recordConfigs.reading)
const records = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const bookKeyword = ref('')
const loading = ref(false)

function formatDate(dateStr?: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return Number.isNaN(d.getTime()) ? String(dateStr) : d.toLocaleString('zh-CN')
}

async function loadRecords() {
  loading.value = true
  try {
    const res = await adminApi.getUserRecords(type.value, {
      page: currentPage.value,
      size: pageSize.value,
      keyword: keyword.value,
      bookKeyword: bookKeyword.value,
    })
    const data = unwrapResponse<{ list: any[]; total: number }>(res)
    records.value = data.list || []
    total.value = data.total || 0
  } catch (e: any) {
    ElMessage.error('加载记录失败: ' + (e.message || ''))
  } finally {
    loading.value = false
  }
}

watch(type, () => {
  currentPage.value = 1
  keyword.value = ''
  bookKeyword.value = ''
  loadRecords()
})

onMounted(loadRecords)
</script>

<style scoped lang="scss">
.user-record-list {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    h2 {
      margin: 0;
      color: var(--el-text-color-primary);
    }
  }

  .filter-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;

    .search-input {
      width: 280px;
    }
  }

  .pagination-wrapper {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
