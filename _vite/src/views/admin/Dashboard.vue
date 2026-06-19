<template>
  <div class="stats-page">
    <h2 class="page-title">仪表盘</h2>

    <!-- 快捷操作 -->
    <div class="quick-actions">
      <h3>快捷操作</h3>
      <div class="action-grid">
        <el-button type="primary" @click="$router.push('/admin/users')">
          <el-icon><User /></el-icon>管理用户
        </el-button>
        <el-button type="success" @click="$router.push('/admin/books')">
          <el-icon><Reading /></el-icon>管理书籍
        </el-button>
        <el-button type="warning" @click="$router.push('/sources')">
          <el-icon><Collection /></el-icon>管理书源
        </el-button>
        <el-button @click="$router.push('/')">
          <el-icon><HomeFilled /></el-icon>返回首页
        </el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card" style="--card-color: #409EFF">
        <div class="stat-icon">
          <el-icon :size="32"><User /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.userCount }}</div>
          <div class="stat-label">用户总数</div>
        </div>
      </div>

      <div class="stat-card" style="--card-color: #67c23a">
        <div class="stat-icon">
          <el-icon :size="32"><Reading /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.bookCount }}</div>
          <div class="stat-label">书籍总数</div>
        </div>
      </div>

      <div class="stat-card" style="--card-color: #e6a23c">
        <div class="stat-icon">
          <el-icon :size="32"><Collection /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.sourceCount }}</div>
          <div class="stat-label">书源总数</div>
        </div>
      </div>

      <div class="stat-card" style="--card-color: #f56c6c">
        <div class="stat-icon">
          <el-icon :size="32"><Document /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.visitorCount }}</div>
          <div class="stat-label">访客数</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import { adminApi, unwrapResponse, type AdminStats } from '@/api'
import { User, Reading, Collection, Document, HomeFilled } from '@element-plus/icons-vue'

const stats = reactive<AdminStats>({
  userCount: 0,
  bookCount: 0,
  sourceCount: 0,
  visitorCount: 0,
})

async function loadStats() {
  try {
    const data = unwrapResponse<AdminStats>(await adminApi.getStats())
    Object.assign(stats, data)
  } catch {
    // ignore
  }
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped lang="scss">
.stats-page {
  .page-title {
    margin: 0 0 24px;
    font-size: 20px;
    font-weight: 600;
  }
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border-left: 4px solid var(--card-color);
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }

  .stat-icon {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--card-color) 12%, transparent);
    color: var(--card-color);
    flex-shrink: 0;
  }

  .stat-info {
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--el-text-color-primary);
      line-height: 1.2;
    }

    .stat-label {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      margin-top: 4px;
    }
  }
}

.quick-actions {
  margin-bottom: 32px;

  h3 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
  }

  .action-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
}

@media (max-width: 768px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-card {
    padding: 16px;

    .stat-icon {
      width: 48px;
      height: 48px;

      .el-icon {
        font-size: 24px !important;
      }
    }

    .stat-info .stat-value {
      font-size: 22px;
    }
  }
}
</style>
