<template>
  <section class="not-found-page">
    <div class="not-found-shell">
      <div class="book-mark" aria-hidden="true">
        <span class="book-mark__code">404</span>
      </div>

      <div class="not-found-content">
        <p class="eyebrow">页面走丢了</p>
        <h1>没有找到这本书页</h1>
        <p class="description">
          你访问的地址不存在、已被移动，或链接里包含了错误的路径。
          可以返回首页重新搜索，也可以回到上一页继续阅读。
        </p>

        <div class="actions">
          <el-button type="primary" size="large" @click="router.push('/')">
            返回首页
          </el-button>
          <el-button size="large" @click="goBack">
            返回上一页
          </el-button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push('/')
}
</script>

<style scoped lang="scss">
.not-found-page {
  min-height: calc(100vh - 148px);
  display: grid;
  place-items: center;
  padding: 48px 16px;
  overflow: hidden;
}

.not-found-shell {
  width: min(920px, 100%);
  min-height: 420px;
  display: grid;
  grid-template-columns: 320px 1fr;
  align-items: center;
  gap: 48px;
  padding: 56px;
  position: relative;
  border-radius: 28px;
  background:
    radial-gradient(circle at 18% 20%, rgba(64, 158, 255, 0.18), transparent 32%),
    linear-gradient(135deg, var(--el-bg-color), var(--el-fill-color-light));
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.10);
}

.not-found-shell::before {
  content: '';
  position: absolute;
  inset: 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 22px;
  pointer-events: none;
}

.book-mark {
  width: 260px;
  height: 330px;
  position: relative;
  justify-self: center;
  border-radius: 18px 10px 10px 18px;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.32), transparent 22%),
    linear-gradient(145deg, var(--el-color-primary), #67c23a);
  box-shadow:
    20px 22px 50px rgba(64, 158, 255, 0.22),
    inset 12px 0 18px rgba(255, 255, 255, 0.18);
  transform: rotate(-5deg);
}

.book-mark::before,
.book-mark::after {
  content: '';
  position: absolute;
  background: rgba(255, 255, 255, 0.86);
  border-radius: 999px;
}

.book-mark::before {
  width: 150px;
  height: 10px;
  top: 72px;
  left: 54px;
}

.book-mark::after {
  width: 104px;
  height: 10px;
  top: 106px;
  left: 54px;
}

.book-mark__code {
  position: absolute;
  left: 44px;
  bottom: 52px;
  font-size: 64px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: -0.08em;
  color: rgba(255, 255, 255, 0.92);
}

.not-found-content {
  position: relative;
  z-index: 1;
}

.eyebrow {
  margin-bottom: 12px;
  color: var(--el-color-primary);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

h1 {
  margin: 0 0 18px;
  color: var(--el-text-color-primary);
  font-size: clamp(34px, 5vw, 56px);
  line-height: 1.08;
  letter-spacing: -0.04em;
}

.description {
  max-width: 520px;
  color: var(--el-text-color-secondary);
  font-size: 16px;
  line-height: 1.9;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 32px;
}

@media (max-width: 768px) {
  .not-found-page {
    padding: 28px 0;
  }

  .not-found-shell {
    grid-template-columns: 1fr;
    gap: 30px;
    padding: 36px 24px;
    text-align: center;
  }

  .book-mark {
    width: 190px;
    height: 242px;
  }

  .book-mark__code {
    left: 34px;
    bottom: 38px;
    font-size: 48px;
  }

  .actions {
    justify-content: center;
  }
}
</style>
