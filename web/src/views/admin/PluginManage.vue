<template>
  <div class="collector-plugin-manage">
    <el-card class="table-card" shadow="never">
      <template #header>
        <div class="page-toolbar">
          <div class="title-block">
            <h2>采集插件管理</h2>
            <span>管理小说采集规则，支持采集、采集单本、编辑、导入导出和删除。</span>
          </div>
          <div class="toolbar-actions">
            <span class="plugin-status">插件状态</span>
            <el-switch
              v-if="collectorPlugin"
              v-model="collectorPlugin.enabled"
              active-text="启用"
              inactive-text="停用"
              @change="togglePlugin"
            />
            <el-button :loading="loading" @click="loadAll">刷新</el-button>
            <el-button @click="openImport">导入</el-button>
            <el-button :disabled="!selectedRows.length" @click="exportSelected">导出选中</el-button>
            <el-button type="primary" @click="newRule">新增采集</el-button>
          </div>
        </div>
      </template>

      <div class="table-scroll">
        <el-table
          ref="tableRef"
          v-loading="loading"
          :data="tableRows"
          border
          stripe
          class="collector-table"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="44" />
          <el-table-column prop="id" label="id" :width="isMobile ? 56 : 72" />
          <el-table-column label="采集名称" min-width="230">
            <template #default="{ row }">
              <div class="name-cell">
                <span>{{ row.collectName }}</span>
                <small>{{ row.entryUrl }}</small>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="collectType" label="采集类型" :width="isMobile ? 92 : 110" />
          <el-table-column prop="addedAt" label="添加时间" :width="isMobile ? 132 : 160" />
          <el-table-column prop="collectedAt" label="采集时间" :width="isMobile ? 132 : 160" />
          <el-table-column label="操作" :width="isMobile ? 260 : 380" :fixed="isMobile ? false : 'right'" align="center">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="editRule(row)">
                编辑
              </el-button>
              <el-button size="small" type="success" :loading="runningId === row.id" @click="runCollect(row)">
                采集
              </el-button>
              <el-button size="small" plain :loading="singleForm.id === row.id && runningSingle" @click="openSingle(row)">
                采集单本
              </el-button>
              <el-button size="small" type="info" :loading="testingId === row.id" @click="testRule(row)">
                测试
              </el-button>
              <el-button size="small" type="warning" @click="openSchedule(row)">
                任务
              </el-button>
              <el-button size="small" type="danger" @click="deleteRule(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <el-dialog v-model="ruleDialogVisible" :title="form.id ? '编辑采集规则' : '新增采集规则'" width="920px">
      <el-form label-width="120px" class="rule-form">
        <el-form-item label="规则名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="采集网址" class="entry-urls-item">
          <div v-for="(url, idx) in form.entryUrls" :key="idx" style="width:100%;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:8px">
              <el-input :ref="(el) => { if (el) entryUrlRefs[idx] = el }" v-model="form.entryUrls![idx]" placeholder="https://example.com/list_[page].html" style="flex:1" />
              <el-button type="primary" size="small" :icon="EditPen" @click="focusEntryUrl(idx)" />
              <el-button type="danger" size="small" :icon="Delete" circle @click="removeEntryUrl(idx)" />
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
              <el-button size="small" plain @click="insertPageTagFor(idx)">插入分页符</el-button>
              <template v-if="/\[page\]|\{page\}/.test(url)">
                <span style="color:#606266;font-size:13px">分页配置：</span>
                <span style="color:#909399;font-size:13px">从</span>
                <el-input-number v-model="form.entryUrlConfigs![idx].startPage" :min="1" size="small" style="width:100px" />
                <span style="color:#909399;font-size:13px">至</span>
                <el-input-number v-model="form.entryUrlConfigs![idx].endPage" :min="1" size="small" style="width:100px" />
              </template>
            </div>
          </div>
          <div style="margin-top:6px;width:100%">
            <el-button size="small" plain @click="addEntryUrl">添加网址</el-button>
          </div>
        </el-form-item>
        <el-form-item label="列表页规则" class="list-rule-item">
          <el-input v-model="form.listRules!.bookList" placeholder="ul li / .book-list .item" />
          <el-button type="info" size="small" :loading="testingListPage" @click="testListPage" class="list-test-btn">测试</el-button>
        </el-form-item>
        <!-- 字符集已改为后台自动检测，从 HTTP 响应头和 HTML meta 标签读取 -->
        <!-- <el-form-item label="字符集"><el-input v-model="form.charset" placeholder="utf-8 / gbk" /></el-form-item> -->
        <el-divider content-position="left">详情页规则</el-divider>
        <!-- 书名 -->
        <el-form-item label="书名"><el-input v-model="form.detailRules.name" /></el-form-item>
        <div class="field-sub">
          <div v-for="(item, idx) in (form.detailReplaces!.name || [])" :key="'name-'+idx" class="replace-row">
            <el-row :gutter="8"><el-col :span="10"><el-input v-model="item.search" placeholder="查找（支持正则）" /></el-col><el-col :span="2" style="text-align:center">→</el-col><el-col :span="10"><el-input v-model="item.replacement" placeholder="替换为" /></el-col><el-col :span="2"><el-button type="danger" size="small" circle @click="removeFieldReplace('detailReplaces','name',idx)"><el-icon><Delete /></el-icon></el-button></el-col></el-row>
          </div>
          <el-button type="primary" size="small" @click="addFieldReplace('detailReplaces','name')"><el-icon><Plus /></el-icon> 内容替换</el-button>
        </div>
        <!-- 作者 -->
        <el-form-item label="作者"><el-input v-model="form.detailRules.author" /></el-form-item>
        <div class="field-sub">
          <div v-for="(item, idx) in (form.detailReplaces!.author || [])" :key="'author-'+idx" class="replace-row">
            <el-row :gutter="8"><el-col :span="10"><el-input v-model="item.search" placeholder="查找（支持正则）" /></el-col><el-col :span="2" style="text-align:center">→</el-col><el-col :span="10"><el-input v-model="item.replacement" placeholder="替换为" /></el-col><el-col :span="2"><el-button type="danger" size="small" circle @click="removeFieldReplace('detailReplaces','author',idx)"><el-icon><Delete /></el-icon></el-button></el-col></el-row>
          </div>
          <el-button type="primary" size="small" @click="addFieldReplace('detailReplaces','author')"><el-icon><Plus /></el-icon> 内容替换</el-button>
        </div>
        <!-- 封面 -->
        <el-form-item label="封面"><el-input v-model="form.detailRules.coverUrl" /></el-form-item>
        <div class="field-sub">
          <div v-for="(item, idx) in (form.detailReplaces!.coverUrl || [])" :key="'cover-'+idx" class="replace-row">
            <el-row :gutter="8"><el-col :span="10"><el-input v-model="item.search" placeholder="查找（支持正则）" /></el-col><el-col :span="2" style="text-align:center">→</el-col><el-col :span="10"><el-input v-model="item.replacement" placeholder="替换为" /></el-col><el-col :span="2"><el-button type="danger" size="small" circle @click="removeFieldReplace('detailReplaces','coverUrl',idx)"><el-icon><Delete /></el-icon></el-button></el-col></el-row>
          </div>
          <el-button type="primary" size="small" @click="addFieldReplace('detailReplaces','coverUrl')"><el-icon><Plus /></el-icon> 内容替换</el-button>
        </div>
        <!-- 目录URL -->
        <el-form-item label="目录 URL"><el-input v-model="form.detailRules.tocUrl" /></el-form-item>
        <div class="field-sub">
          <div v-for="(item, idx) in (form.detailReplaces!.tocUrl || [])" :key="'tocurl-'+idx" class="replace-row">
            <el-row :gutter="8"><el-col :span="10"><el-input v-model="item.search" placeholder="查找（支持正则）" /></el-col><el-col :span="2" style="text-align:center">→</el-col><el-col :span="10"><el-input v-model="item.replacement" placeholder="替换为" /></el-col><el-col :span="2"><el-button type="danger" size="small" circle @click="removeFieldReplace('detailReplaces','tocUrl',idx)"><el-icon><Delete /></el-icon></el-button></el-col></el-row>
          </div>
          <el-button type="primary" size="small" @click="addFieldReplace('detailReplaces','tocUrl')"><el-icon><Plus /></el-icon> 内容替换</el-button>
        </div>
        <!-- 分类 -->
        <el-form-item label="分类"><el-input v-model="form.detailRules.kind" /></el-form-item>
        <div class="field-sub">
          <div v-for="(item, idx) in (form.detailReplaces!.kind || [])" :key="'kind-'+idx" class="replace-row">
            <el-row :gutter="8"><el-col :span="10"><el-input v-model="item.search" placeholder="查找（支持正则）" /></el-col><el-col :span="2" style="text-align:center">→</el-col><el-col :span="10"><el-input v-model="item.replacement" placeholder="替换为" /></el-col><el-col :span="2"><el-button type="danger" size="small" circle @click="removeFieldReplace('detailReplaces','kind',idx)"><el-icon><Delete /></el-icon></el-button></el-col></el-row>
          </div>
          <el-button type="primary" size="small" @click="addFieldReplace('detailReplaces','kind')"><el-icon><Plus /></el-icon> 内容替换</el-button>
        </div>
        <!-- 最新章节 -->
        <el-form-item label="最新章节"><el-input v-model="form.detailRules.latestChapterTitle" /></el-form-item>
        <div class="field-sub">
          <div v-for="(item, idx) in (form.detailReplaces!.latestChapterTitle || [])" :key="'latest-'+idx" class="replace-row">
            <el-row :gutter="8"><el-col :span="10"><el-input v-model="item.search" placeholder="查找（支持正则）" /></el-col><el-col :span="2" style="text-align:center">→</el-col><el-col :span="10"><el-input v-model="item.replacement" placeholder="替换为" /></el-col><el-col :span="2"><el-button type="danger" size="small" circle @click="removeFieldReplace('detailReplaces','latestChapterTitle',idx)"><el-icon><Delete /></el-icon></el-button></el-col></el-row>
          </div>
          <el-button type="primary" size="small" @click="addFieldReplace('detailReplaces','latestChapterTitle')"><el-icon><Plus /></el-icon> 内容替换</el-button>
        </div>
        <!-- 简介 -->
        <el-form-item label="简介"><el-input v-model="form.detailRules.intro" /></el-form-item>
        <div class="field-sub">
          <div v-for="(item, idx) in (form.detailReplaces!.intro || [])" :key="'intro-'+idx" class="replace-row">
            <el-row :gutter="8"><el-col :span="10"><el-input v-model="item.search" placeholder="查找（支持正则）" /></el-col><el-col :span="2" style="text-align:center">→</el-col><el-col :span="10"><el-input v-model="item.replacement" placeholder="替换为" /></el-col><el-col :span="2"><el-button type="danger" size="small" circle @click="removeFieldReplace('detailReplaces','intro',idx)"><el-icon><Delete /></el-icon></el-button></el-col></el-row>
          </div>
          <el-button type="primary" size="small" @click="addFieldReplace('detailReplaces','intro')"><el-icon><Plus /></el-icon> 内容替换</el-button>
        </div>
        <el-divider content-position="left">目录与正文规则</el-divider>
        <!-- 章节列表 -->
        <el-form-item label="章节列表"><el-input v-model="form.tocRules.chapterList" /></el-form-item>
        <div class="field-sub">
          <div v-for="(item, idx) in (form.tocReplaces!.chapterList || [])" :key="'toclist-'+idx" class="replace-row">
            <el-row :gutter="8"><el-col :span="10"><el-input v-model="item.search" placeholder="查找（支持正则）" /></el-col><el-col :span="2" style="text-align:center">→</el-col><el-col :span="10"><el-input v-model="item.replacement" placeholder="替换为" /></el-col><el-col :span="2"><el-button type="danger" size="small" circle @click="removeFieldReplace('tocReplaces','chapterList',idx)"><el-icon><Delete /></el-icon></el-button></el-col></el-row>
          </div>
          <el-button type="primary" size="small" @click="addFieldReplace('tocReplaces','chapterList')"><el-icon><Plus /></el-icon> 内容替换</el-button>
        </div>
        <!-- 章节标题 -->
        <el-form-item label="章节标题"><el-input v-model="form.tocRules.chapterTitle" /></el-form-item>
        <div class="field-sub">
          <div v-for="(item, idx) in (form.tocReplaces!.chapterTitle || [])" :key="'toctitle-'+idx" class="replace-row">
            <el-row :gutter="8"><el-col :span="10"><el-input v-model="item.search" placeholder="查找（支持正则）" /></el-col><el-col :span="2" style="text-align:center">→</el-col><el-col :span="10"><el-input v-model="item.replacement" placeholder="替换为" /></el-col><el-col :span="2"><el-button type="danger" size="small" circle @click="removeFieldReplace('tocReplaces','chapterTitle',idx)"><el-icon><Delete /></el-icon></el-button></el-col></el-row>
          </div>
          <el-button type="primary" size="small" @click="addFieldReplace('tocReplaces','chapterTitle')"><el-icon><Plus /></el-icon> 内容替换</el-button>
        </div>
        <!-- 章节URL -->
        <el-form-item label="章节 URL"><el-input v-model="form.tocRules.chapterUrl" /></el-form-item>
        <div class="field-sub">
          <div v-for="(item, idx) in (form.tocReplaces!.chapterUrl || [])" :key="'tocurl-'+idx" class="replace-row">
            <el-row :gutter="8"><el-col :span="10"><el-input v-model="item.search" placeholder="查找（支持正则）" /></el-col><el-col :span="2" style="text-align:center">→</el-col><el-col :span="10"><el-input v-model="item.replacement" placeholder="替换为" /></el-col><el-col :span="2"><el-button type="danger" size="small" circle @click="removeFieldReplace('tocReplaces','chapterUrl',idx)"><el-icon><Delete /></el-icon></el-button></el-col></el-row>
          </div>
          <el-button type="primary" size="small" @click="addFieldReplace('tocReplaces','chapterUrl')"><el-icon><Plus /></el-icon> 内容替换</el-button>
        </div>
        <!-- 正文 -->
        <el-form-item label="正文规则"><el-input v-model="form.contentRule" /></el-form-item>
        <div class="field-sub">
          <div v-for="(item, idx) in (form.contentReplaces || [])" :key="'content-'+idx" class="replace-row">
            <el-row :gutter="8"><el-col :span="10"><el-input v-model="item.search" placeholder="查找（支持正则）" /></el-col><el-col :span="2" style="text-align:center">→</el-col><el-col :span="10"><el-input v-model="item.replacement" placeholder="替换为" /></el-col><el-col :span="2"><el-button type="danger" size="small" circle @click="removeContentReplace(idx)"><el-icon><Delete /></el-icon></el-button></el-col></el-row>
          </div>
          <el-button type="primary" size="small" @click="addContentReplace"><el-icon><Plus /></el-icon> 内容替换</el-button>
        </div>
        <el-form-item label="请求头 JSON">
          <el-input v-model="headersText" type="textarea" :rows="4" placeholder='{"User-Agent":"Mozilla/5.0"}' />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchDialogVisible" title="批量采集" width="780px" :close-on-click-modal="false">
      <el-form v-if="!batchRunning && !batchFinished" label-width="110px">
        <el-form-item label="采集规则">
          <el-input v-model="batchForm.name" disabled />
        </el-form-item>
        <el-form-item label="URL模板">
          <el-input v-model="batchForm.pattern" disabled />
        </el-form-item>
        <el-form-item label="起始页码">
          <el-input-number v-model="batchForm.startPage" :min="1" />
        </el-form-item>
        <el-form-item label="最大页数">
          <el-input-number v-model="batchForm.maxPages" :min="1" />
        </el-form-item>
        <el-form-item label="最大本数">
          <el-input-number v-model="batchForm.maxBooks" :min="1" />
          <span class="form-tip">达到最大本数后自动停止，不填表示不限制。</span>
        </el-form-item>
        <el-form-item label="最大章节数">
          <el-input-number v-model="batchForm.maxChapters" :min="0" />
          <span class="form-tip">填 0 表示不限制。</span>
        </el-form-item>
        <el-form-item label="采集正文">
          <el-switch v-model="batchForm.includeContent" />
          <span class="form-tip">开启后采集全部章节正文，正式环境建议关闭。</span>
        </el-form-item>
        <el-form-item label="从断点继续">
          <el-switch v-model="batchForm.resume" />
          <span class="form-tip">开启后从上次中断的页码继续采集。</span>
        </el-form-item>
      </el-form>
      <!-- 采集进度面板 -->
      <div v-if="batchRunning || batchFinished" class="batch-progress-panel">
        <div class="batch-stats">
          <el-row :gutter="16">
            <el-col :span="4"><div class="stat-item"><div class="stat-num">{{ batchProgress.totalBooks || 0 }}</div><div class="stat-label">已处理</div></div></el-col>
            <el-col :span="4"><div class="stat-item stat-success"><div class="stat-num">{{ batchProgress.successBooks || 0 }}</div><div class="stat-label">成功</div></div></el-col>
            <el-col :span="4"><div class="stat-item stat-fail"><div class="stat-num">{{ batchProgress.failedBooks || 0 }}</div><div class="stat-label">失败</div></div></el-col>
            <el-col :span="4"><div class="stat-item stat-skip"><div class="stat-num">{{ batchProgress.skippedBooks || 0 }}</div><div class="stat-label">跳过</div></div></el-col>
            <el-col :span="4"><div class="stat-item"><div class="stat-num">{{ batchProgress.currentPage || batchForm.startPage }}</div><div class="stat-label">当前页</div></div></el-col>
            <el-col :span="4"><div class="stat-item"><div class="stat-num">{{ batchProgress.totalPages || 0 }}</div><div class="stat-label">已扫页</div></div></el-col>
          </el-row>
        </div>
        <el-progress :percentage="batchPercentage" :stroke-width="12" :format="() => batchPercentage + '%'" style="margin:12px 0" />
        <div class="batch-book-list">
          <div v-for="(book, idx) in batchBooks" :key="idx" class="batch-book-item">
            <el-tag size="small" :type="book.status === 'success' ? 'success' : book.status === 'failed' ? 'danger' : book.status === 'collecting' ? 'warning' : 'info'" effect="plain">{{ book.status === 'success' ? '成功' : book.status === 'failed' ? '失败' : book.status === 'collecting' ? '采集中' : '跳过' }}</el-tag>
            <span class="book-name" :title="book.bookName">{{ book.bookName || '-' }}</span>
            <span v-if="book.chapterCount" class="book-chapters">{{ book.chapterCount }}章</span>
            <el-icon v-if="book.status === 'collecting'" class="is-loading" style="color:#e6a23c"><Loading /></el-icon>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="cancelBatch">{{ batchFinished ? '关闭' : '取消' }}</el-button>
        <el-button v-if="!batchRunning && !batchFinished" type="warning" :loading="runningBatch" @click="runBatchFromDialog">开始批量采集</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="singleDialogVisible" title="采集单本" width="680px">
      <el-form label-width="110px">
        <el-form-item label="采集规则">
          <el-input v-model="singleForm.name" disabled />
        </el-form-item>
        <el-form-item label="详情页 URL">
          <el-input v-model="singleForm.entryUrl" placeholder="粘贴单本小说详情页地址" />
        </el-form-item>
        <el-form-item label="最大章节数">
          <el-input-number v-model="singleForm.maxChapters" :min="0" :max="5000" />
          <span class="form-tip">填 0 表示不限制，建议首次测试 20 章以内。</span>
        </el-form-item>
        <el-form-item label="采集正文">
          <el-switch v-model="singleForm.includeContent" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="singleDialogVisible = false">取消</el-button>
        <el-button type="success" :loading="runningSingle" @click="runSingleFromDialog">开始采集</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="testDialogVisible" title="采集规则测试结果" width="920px">
      <div v-if="testResult" class="test-result">
        <el-alert
          :type="testResult.detail.ok && testResult.toc.ok ? 'success' : 'warning'"
          :closable="false"
          show-icon
          :title="testSummary"
        />

        <el-divider content-position="left">详情页提取</el-divider>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="状态">
            <el-tag :type="testResult.detail.ok ? 'success' : 'danger'">{{ testResult.detail.ok ? '成功' : '失败' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="HTML 长度">{{ testResult.detail.htmlLength }}</el-descriptions-item>
          <el-descriptions-item label="详情 URL" :span="2">{{ testResult.detail.url }}</el-descriptions-item>
          <el-descriptions-item v-if="testResult.detail.book" label="书名">{{ testResult.detail.book.name }}</el-descriptions-item>
          <el-descriptions-item v-if="testResult.detail.book" label="作者">{{ testResult.detail.book.author }}</el-descriptions-item>
          <el-descriptions-item v-if="testResult.detail.book" label="目录 URL" :span="2">{{ testResult.detail.book.tocUrl }}</el-descriptions-item>
          <el-descriptions-item v-if="testResult.detail.book?.intro" label="简介" :span="2">{{ testResult.detail.book.intro }}</el-descriptions-item>
          <el-descriptions-item v-if="testResult.detail.error" label="错误" :span="2">{{ testResult.detail.error }}</el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">目录页提取</el-divider>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="状态">
            <el-tag :type="testResult.toc.ok ? 'success' : 'danger'">{{ testResult.toc.ok ? '成功' : '失败' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="章节数">{{ testResult.toc.chapterCount }}</el-descriptions-item>
          <el-descriptions-item label="目录 URL" :span="2">{{ testResult.toc.url }}</el-descriptions-item>
          <el-descriptions-item v-if="testResult.toc.error" label="提示" :span="2">{{ testResult.toc.error }}</el-descriptions-item>
        </el-descriptions>
        <el-table v-if="testResult.toc.chapters.length" :data="testResult.toc.chapters" border size="small" class="preview-table">
          <el-table-column prop="index" label="#" width="70" />
          <el-table-column prop="title" label="章节标题" width="220" />
          <el-table-column prop="url" label="章节 URL" />
        </el-table>

        <el-divider content-position="left">正文提取</el-divider>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="状态">
            <el-tag :type="testResult.content.ok ? 'success' : 'danger'">{{ testResult.content.ok ? '成功' : '失败' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="正文长度">{{ testResult.content.length }}</el-descriptions-item>
          <el-descriptions-item label="正文 URL" :span="2">{{ testResult.content.url || '未获取到章节 URL' }}</el-descriptions-item>
          <el-descriptions-item v-if="testResult.content.error" label="提示" :span="2">{{ testResult.content.error }}</el-descriptions-item>
        </el-descriptions>
        <pre v-if="testResult.content.preview" class="content-preview">{{ testResult.content.preview }}</pre>
      </div>
      <template #footer>
        <el-button @click="testDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialogVisible" title="导入采集规则" width="760px">
      <el-input v-model="importText" type="textarea" :rows="16" placeholder="粘贴规则 JSON，支持单个规则、数组或 { rules: [...] }" />
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="importRules">导入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="scheduleDialogVisible" title="定时任务" width="680px">
      <el-form v-if="scheduleForm.id || scheduleForm.cron" label-width="110px">
        <el-form-item label="采集规则">
          <el-input v-model="scheduleForm.ruleName" disabled />
        </el-form-item>
        <el-form-item label="Cron表达式">
          <el-input v-model="scheduleForm.cron" placeholder="0 2 * * *" />
          <span class="form-tip">例如：0 2 * * * 表示每天凌晨2点执行</span>
        </el-form-item>
        <el-form-item label="最大本数">
          <el-input-number v-model="scheduleForm.maxBooks" :min="1" />
        </el-form-item>
        <el-form-item label="最大页数">
          <el-input-number v-model="scheduleForm.maxPages" :min="1" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="scheduleForm.enabled" />
        </el-form-item>
      </el-form>
      <div v-else style="text-align:center;padding:20px">
        <el-empty description="暂无定时任务">
          <el-button type="primary" @click="createSchedule">创建定时任务</el-button>
        </el-empty>
      </div>
      <template v-if="scheduleForm.id || scheduleForm.cron" #footer>
        <el-button v-if="scheduleForm.id" type="danger" @click="deleteSchedule">删除</el-button>
        <el-button @click="scheduleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingSchedule" @click="saveSchedule">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Plus, Loading, EditPen } from '@element-plus/icons-vue'
import { collectorApi, pluginApi, type AdminPlugin, type CollectorRulePayload, type CollectorRuleRow, type CollectorLogRow, type CollectorTestResult } from '@/api'
import { buildCollectorPluginRows, type CollectorPluginTableRow } from './collectorPluginTable'

const loading = ref(false)
const saving = ref(false)
const runningBatch = ref(false)
const runningSingle = ref(false)
const batchRunning = ref(false)
const batchFinished = ref(false)
const batchProgress = ref<any>({})
const batchBooks = ref<any[]>([])
let batchSSE: EventSource | null = null

const tableRef = ref<any>(null)
const selectedRows = ref<CollectorPluginTableRow[]>([])

function handleSelectionChange(rows: CollectorPluginTableRow[]) {
  selectedRows.value = rows
}

function exportSelected() {
  downloadJson('collector-rules-export.json', {
    rules: selectedRows.value.map(r => r.raw.rule),
    exportedAt: new Date().toISOString(),
  })
}

const batchPercentage = computed(() => {
  const total = batchProgress.value.maxBooks || 1
  const done = (batchProgress.value.successBooks || 0) + (batchProgress.value.failedBooks || 0) + (batchProgress.value.skippedBooks || 0)
  return Math.min(100, Math.round((done / total) * 100))
})
const importing = ref(false)
const runningId = ref<number | null>(null)
const testingId = ref<number | null>(null)
const plugins = ref<AdminPlugin[]>([])
const rules = ref<CollectorRuleRow[]>([])
const logs = ref<CollectorLogRow[]>([])
const ruleDialogVisible = ref(false)
const singleDialogVisible = ref(false)
const batchDialogVisible = ref(false)
const testDialogVisible = ref(false)
const importDialogVisible = ref(false)
const scheduleDialogVisible = ref(false)
const savingSchedule = ref(false)
const importText = ref('')
const headersText = ref('{}')
const testResult = ref<CollectorTestResult | null>(null)
const viewportWidth = ref(typeof window === 'undefined' ? 1200 : window.innerWidth)
const isMobile = computed(() => viewportWidth.value <= 768)

const scheduleForm = ref<{
  id?: number
  ruleId: number
  ruleName: string
  cron: string
  maxBooks: number
  maxPages: number
  enabled: boolean
}>({
  ruleId: 0,
  ruleName: '',
  cron: '0 2 * * *',
  maxBooks: 50,
  maxPages: 10,
  enabled: true,
})

const emptyRule = (): CollectorRulePayload => ({
  name: '',
  entryUrl: '',
  entryUrls: [''],
  entryUrlConfigs: [{ startPage: 1, endPage: 1 }],
  enabled: true,
  charset: 'utf-8',
  headers: {},
  detailRules: { name: '', author: '', coverUrl: '', intro: '', tocUrl: '', kind: '', latestChapterTitle: '' },
  tocRules: { chapterList: '', chapterTitle: '', chapterUrl: '' },
  contentRule: '',
  listRules: { bookList: '', bookName: '', bookAuthor: '', bookUrl: '', bookCover: '', bookLatestChapter: '', bookKind: '' },
  pagination: { pattern: '', startPage: 1, maxPages: 1, increment: 1 },
  detailFilters: {},
  detailReplaces: {},
  tocFilters: {},
  tocReplaces: {},
  contentFilter: '',
  contentReplaces: [],
})

const form = ref<CollectorRulePayload>(emptyRule())
const singleForm = ref({
  id: 0,
  name: '',
  entryUrl: '',
  includeContent: false,
  maxChapters: 20,
})

const batchForm = ref({
  id: 0,
  name: '',
  pattern: '',
  startPage: 1,
  maxPages: 1,
  maxBooks: 50,
  includeContent: false,
  maxChapters: 20,
  resume: false,
})

const entryUrlRefs = ref<Record<number, any>>({})
const testingListPage = ref(false)

function addEntryUrl() {
  if (!form.value.entryUrls) {
    form.value.entryUrls = ['']
  }
  form.value.entryUrls.push('')
  if (!form.value.entryUrlConfigs) {
    form.value.entryUrlConfigs = []
  }
  form.value.entryUrlConfigs.push({ startPage: 1, endPage: 1 })
}

function removeEntryUrl(index: number) {
  if (!form.value.entryUrls) return
  if (form.value.entryUrls.length <= 1) {
    form.value.entryUrls[0] = ''
    if (form.value.entryUrlConfigs) {
      form.value.entryUrlConfigs[0] = { startPage: 1, endPage: 1 }
    }
    return
  }
  form.value.entryUrls.splice(index, 1)
  if (form.value.entryUrlConfigs) {
    form.value.entryUrlConfigs.splice(index, 1)
  }
}

function focusEntryUrl(index: number) {
  const inputEl = entryUrlRefs.value[index]?.$el?.querySelector('input') as HTMLInputElement
  if (inputEl) inputEl.focus()
}

function insertPageTagFor(index: number) {
  const urls = form.value.entryUrls || [form.value.entryUrl]
  const inputEl = entryUrlRefs.value[index]?.$el?.querySelector('input')
  if (!inputEl) return

  const start = inputEl.selectionStart || 0
  const end = inputEl.selectionEnd || 0
  const url = urls[index] || ''

  // 如果有选中的文本
  if (start !== end && start < url.length && end <= url.length) {
    const selected = url.substring(start, end)
    // 如果选中的是纯数字，替换为 [page]
    if (/^\d+$/.test(selected) && !/\[page\]|\{page\}/.test(url)) {
      urls[index] = url.substring(0, start) + '[page]' + url.substring(end)
      return
    }
  }

  // 如果没有选中数字，或已存在分页符，则不做任何操作（避免误操作）
  if (!/\[page\]|\{page\}/.test(url)) {
    urls[index] = url + '[page]/'
  }
}

function syncPaginationToForm() {
  const urls = form.value.entryUrls || [form.value.entryUrl]
  const urlWithPage = urls.find(u => /\[page\]|\{page\}/.test(u))
  if (urlWithPage) {
    const config = form.value.entryUrlConfigs?.[0] || { startPage: 1, endPage: 1 }
    const total = Math.max(1, config.endPage - config.startPage + 1)
    form.value.pagination = {
      pattern: urlWithPage,
      startPage: config.startPage,
      maxPages: Math.min(100, total),
      increment: 1,
    }
  }
}

const collectorPlugin = computed(() => plugins.value.find((plugin) => plugin.key === 'collector'))
const tableRows = computed(() => buildCollectorPluginRows(rules.value, logs.value))
const testSummary = computed(() => {
  if (!testResult.value) return ''
  const result = testResult.value
  if (!result.detail.ok) return `详情页测试失败：${result.detail.error || '请检查书名等详情页规则'}`
  if (!result.toc.ok) return `已提取《${result.detail.book?.name || ''}》，但章节为 0：${result.toc.error || '请检查目录规则'}`
  if (!result.content.ok) return `已提取《${result.detail.book?.name || ''}》和 ${result.toc.chapterCount} 个章节，但正文未提取成功：${result.content.error || '请检查正文规则'}`
  return `测试成功：已提取《${result.detail.book?.name || ''}》、${result.toc.chapterCount} 个章节和正文预览`
})

async function loadAll() {
  loading.value = true
  try {
    plugins.value = await pluginApi.getPlugins()
    rules.value = await collectorApi.getRules()
    logs.value = await collectorApi.getLogs()
  } finally {
    loading.value = false
  }
}

async function togglePlugin() {
  if (!collectorPlugin.value) return
  await pluginApi.updateStatus(collectorPlugin.value.key, collectorPlugin.value.enabled)
  ElMessage.success('插件状态已更新')
}

function newRule() {
  form.value = emptyRule()
  headersText.value = '{}'
  ruleDialogVisible.value = true
}

function editRule(row: CollectorPluginTableRow) {
  const base = emptyRule()
  const existing = row.raw.rule || {}
  form.value = JSON.parse(JSON.stringify({
    ...base,
    ...existing,
    id: row.id,
    detailRules: { ...base.detailRules, ...existing.detailRules },
    tocRules: { ...base.tocRules, ...existing.tocRules },
    listRules: { ...base.listRules, ...(existing.listRules || {}) },
    pagination: { ...base.pagination, ...(existing.pagination || {}) },
    detailFilters: { ...base.detailFilters, ...(existing.detailFilters || {}) },
    detailReplaces: { ...base.detailReplaces, ...(existing.detailReplaces || {}) },
    tocFilters: { ...base.tocFilters, ...(existing.tocFilters || {}) },
    tocReplaces: { ...base.tocReplaces, ...(existing.tocReplaces || {}) },
    contentReplaces: existing.contentReplaces || [],
  }))
  // 兼容旧数据：如果 entryUrls 不存在或为空，从 entryUrl 生成
  if (!form.value.entryUrls || form.value.entryUrls.length === 0 || !form.value.entryUrls[0]) {
    form.value.entryUrls = [form.value.entryUrl || '']
  }
  headersText.value = typeof form.value.headers === 'string' ? form.value.headers : JSON.stringify(form.value.headers || {}, null, 2)
  // 回填分页参数
  const urls = form.value.entryUrls || []
  const entryUrlConfigs = form.value.entryUrlConfigs
  if (entryUrlConfigs && entryUrlConfigs.length === urls.length) {
    // 保留现有值
  } else {
    const pag = form.value.pagination
    const sp = pag?.startPage ?? 1
    const ep = sp + (pag?.maxPages || 1) - 1
    form.value.entryUrlConfigs = urls.map(() => ({ startPage: sp, endPage: ep }))
  }
  ruleDialogVisible.value = true
}

async function saveRule() {
  saving.value = true
  try {
    form.value.headers = headersText.value ? JSON.parse(headersText.value) : {}
    syncPaginationToForm()
    await collectorApi.saveRule(form.value)
    ElMessage.success('采集规则已保存')
    ruleDialogVisible.value = false
    await loadAll()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败，请检查 JSON 和规则字段')
  } finally {
    saving.value = false
  }
}

async function testListPage() {
  const urls = form.value.entryUrls || [form.value.entryUrl]
  const url = urls.find(u => /\[page\]|\{page\}/.test(u)) || urls[0]
  const listSelector = form.value.listRules?.bookList
  if (!url || !listSelector) {
    ElMessage.warning('请先填写采集网址和列表页规则')
    return
  }
  testingListPage.value = true
  try {
    // 替换分页占位符为第1页
    const testUrl = url.replace(/\[page\]|\{page\}/g, '1')
    const result = await collectorApi.testListPage(form.value.id || 0, testUrl)
    if (result?.ok && result.bookCount > 0) {
      ElMessage.success(`列表页匹配成功，共提取到 ${result.bookCount} 本书`)
    } else {
      ElMessage.warning(result?.error || '列表页匹配失败，请检查选择器')
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '测试失败')
  } finally {
    testingListPage.value = false
  }
}

function addFieldReplace(storeKey: 'detailReplaces' | 'tocReplaces', field: string) {
  if (!form.value[storeKey]) {
    form.value[storeKey] = {}
  }
  if (!form.value[storeKey]![field]) {
    form.value[storeKey]![field] = []
  }
  form.value[storeKey]![field]!.push({ search: '', replacement: '' })
}

function removeFieldReplace(storeKey: 'detailReplaces' | 'tocReplaces', field: string, index: number) {
  if (form.value[storeKey]?.[field]) {
    form.value[storeKey]![field]!.splice(index, 1)
  }
}

function addContentReplace() {
  if (!form.value.contentReplaces) {
    form.value.contentReplaces = []
  }
  form.value.contentReplaces.push({ search: '', replacement: '' })
}

function removeContentReplace(index: number) {
  if (form.value.contentReplaces) {
    form.value.contentReplaces.splice(index, 1)
  }
}

async function deleteRule(row: CollectorPluginTableRow) {
  await ElMessageBox.confirm(`确定删除采集规则"${row.collectName}"？`, '删除规则', { type: 'warning' })
  await collectorApi.deleteRule(row.id)
  ElMessage.success('已删除')
  await loadAll()
}

async function runCollect(row: CollectorPluginTableRow) {
  const rule = row.raw.rule
  const entryUrls = rule.entryUrls || [rule.entryUrl]
  // 如果任意 entryUrl 包含分页占位符，弹出批量采集配置窗口
  if (entryUrls.some((u: string) => /\[page\]|\{page\}/.test(u))) {
    openBatch(row)
    return
  }
  // 不含分页占位符时，弹出单本采集窗口
  openSingle(row)
}

function openSingle(row: CollectorPluginTableRow) {
  const rule = row.raw.rule
  const entryUrls = rule.entryUrls || [rule.entryUrl]
  singleForm.value = {
    id: row.id,
    name: row.collectName,
    entryUrl: entryUrls[0] || '',
    includeContent: false,
    maxChapters: 20,
  }
  singleDialogVisible.value = true
}

async function runSingleFromDialog() {
  if (!singleForm.value.id || !singleForm.value.entryUrl.trim()) {
    ElMessage.warning('请填写采集网址')
    return
  }
  runningSingle.value = true
  try {
    const result = await collectorApi.runSingle(singleForm.value.id, {
      entryUrl: singleForm.value.entryUrl.trim(),
      includeContent: singleForm.value.includeContent,
      maxChapters: singleForm.value.maxChapters,
    })
    showCollectMessage(result)
    singleDialogVisible.value = false
    await loadAll()
  } catch (error: any) {
    ElMessage.error(error?.message || '采集失败')
  } finally {
    runningSingle.value = false
  }
}

function openBatch(row: CollectorPluginTableRow) {
  const rule = row.raw.rule
  // 检查列表规则
  if (!rule.listRules?.bookList) {
    ElMessage.warning('该规则未配置列表页规则（书籍列表选择器），无法批量采集')
    return
  }
  // 分页模板来源：显式配置的 pagination.pattern 或 entryUrl 中的分页占位符
  const entryUrls = rule.entryUrls || [rule.entryUrl]
  const hasPaginationPattern = !!rule.pagination?.pattern
  const hasPagePlaceholder = entryUrls.some((u: string) => /\[page\]|\{page\}/.test(u))
  if (!hasPaginationPattern && !hasPagePlaceholder) {
    ElMessage.warning('该规则未配置分页规则，且详情页不含 [page] 或 {page} 占位符，无法批量采集')
    return
  }
  const pattern = rule.pagination?.pattern || entryUrls.find((u: string) => /\[page\]|\{page\}/.test(u)) || entryUrls[0]
  batchForm.value = {
    id: row.id,
    name: row.collectName,
    pattern,
    startPage: rule.pagination?.startPage || 1,
    maxPages: rule.pagination?.maxPages || 1,
    maxBooks: 50,
    includeContent: false,
    maxChapters: 20,
    resume: false,
  }
  batchFinished.value = false
  batchDialogVisible.value = true
}

async function runBatchFromDialog() {
  if (!batchForm.value.id) {
    ElMessage.warning('请选择采集规则')
    return
  }
  runningBatch.value = true
  batchRunning.value = true
  batchProgress.value = { maxBooks: batchForm.value.maxBooks }
  batchBooks.value = []

  batchSSE = collectorApi.runBatchSSE(batchForm.value.id, {
    maxBooks: batchForm.value.maxBooks,
    startPage: batchForm.value.startPage,
    maxPages: batchForm.value.maxPages,
    includeContent: batchForm.value.includeContent,
    maxChapters: batchForm.value.maxChapters,
    resume: batchForm.value.resume,
  }, (data) => {
    if (data.type === 'progress' || data.type === 'book') {
      batchProgress.value = { ...batchProgress.value, ...data }
    }
    if (data.type === 'book') {
      // 更新或添加书籍到列表
      const idx = batchBooks.value.findIndex((b: any) => b.bookUrl === data.bookUrl && b.bookStatus !== 'collecting')
      if (idx >= 0) {
        batchBooks.value[idx] = { ...batchBooks.value[idx], ...data }
      } else {
        batchBooks.value.push(data)
      }
      // 滚动到底部
    }
    if (data.type === 'done') {
      batchRunning.value = false
      runningBatch.value = false
      batchFinished.value = true
      const r = data.result
      ElMessage.success(`批量采集完成：共${r.totalPages}页, ${r.totalBooks}本, 成功${r.successBooks}, 失败${r.failedBooks}, 跳过${r.skippedBooks}`)
      loadAll()
    }
    if (data.type === 'error') {
      batchRunning.value = false
      runningBatch.value = false
      batchFinished.value = true
      ElMessage.error(data.error || '采集出错')
    }
  })
}

function cancelBatch() {
  if (batchSSE) {
    batchSSE.close()
    batchSSE = null
  }
  batchRunning.value = false
  runningBatch.value = false
  batchFinished.value = false
  batchDialogVisible.value = false
}

function showCollectMessage(result: Awaited<ReturnType<typeof collectorApi.runSingle>>) {
  const text = `已采集《${result.book.name}》，章节 ${result.chapterCount}，正文 ${result.contentCount}`
  if (result.chapterCount === 0) {
    ElMessage.warning(`${text}。章节为 0，请点击“测试”检查目录规则。`)
  } else if (result.contentCount === 0) {
    ElMessage.warning(`${text}。正文为 0，请点击“测试”检查正文规则。`)
  } else {
    ElMessage.success(text)
  }
}

async function testRule(row: CollectorPluginTableRow) {
  testingId.value = row.id
  testResult.value = null
  const rule = row.raw.rule
  const entryUrls = rule.entryUrls || [rule.entryUrl]
  try {
    testResult.value = await collectorApi.testRule(row.id, { entryUrl: entryUrls[0] || '' })
    testDialogVisible.value = true
  } catch (error: any) {
    ElMessage.error(error?.message || '测试失败')
  } finally {
    testingId.value = null
  }
}

function openImport() {
  importText.value = ''
  importDialogVisible.value = true
}

async function importRules() {
  importing.value = true
  try {
    const payload = JSON.parse(importText.value)
    const result = await collectorApi.importRules(payload)
    const success = Number(result.success || 0)
    const fail = Number(result.fail || 0)
    if (fail > 0) {
      ElMessage.warning(`导入成功 ${success} 条，失败 ${fail} 条：${result.errors?.join('；') || '请检查规则 JSON'}`)
    } else {
      ElMessage.success(`导入成功 ${success} 条`)
      importDialogVisible.value = false
    }
    await loadAll()
  } catch (error: any) {
    ElMessage.error(error?.message || '导入失败，请检查 JSON')
  } finally {
    importing.value = false
  }
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportRule(row: CollectorPluginTableRow) {
  downloadJson(`collector-rule-${row.id}.json`, {
    rules: [row.raw.rule],
    exportedAt: new Date().toISOString(),
  })
}

async function openSchedule(row: CollectorPluginTableRow) {
  scheduleForm.value.ruleId = row.id
  scheduleForm.value.ruleName = row.collectName
  try {
    const res = await collectorApi.getSchedule(row.id)
    if (res && res.id) {
      scheduleForm.value = {
        id: res.id,
        ruleId: row.id,
        ruleName: row.collectName,
        cron: res.cron,
        maxBooks: res.maxBooks || 50,
        maxPages: res.maxPages || 10,
        enabled: res.enabled !== false,
      }
    } else {
      scheduleForm.value = {
        ruleId: row.id,
        ruleName: row.collectName,
        cron: '0 2 * * *',
        maxBooks: 50,
        maxPages: 10,
        enabled: true,
      }
    }
  } catch {
    scheduleForm.value = {
      ruleId: row.id,
      ruleName: row.collectName,
      cron: '0 2 * * *',
      maxBooks: 50,
      maxPages: 10,
      enabled: true,
    }
  }
  scheduleDialogVisible.value = true
}

function createSchedule() {
  scheduleForm.value = {
    ruleId: scheduleForm.value.ruleId,
    ruleName: scheduleForm.value.ruleName,
    cron: '0 2 * * *',
    maxBooks: 50,
    maxPages: 10,
    enabled: true,
  }
}

async function saveSchedule() {
  savingSchedule.value = true
  try {
    await collectorApi.saveSchedule({
      id: scheduleForm.value.id,
      ruleId: scheduleForm.value.ruleId,
      cron: scheduleForm.value.cron,
      maxBooks: scheduleForm.value.maxBooks,
      maxPages: scheduleForm.value.maxPages,
      enabled: scheduleForm.value.enabled,
    })
    ElMessage.success('定时任务已保存')
    scheduleDialogVisible.value = false
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    savingSchedule.value = false
  }
}

async function deleteSchedule() {
  if (!scheduleForm.value.id) return
  await ElMessageBox.confirm('确定删除该定时任务？', '删除', { type: 'warning' })
  try {
    await collectorApi.deleteSchedule(scheduleForm.value.id)
    ElMessage.success('已删除')
    scheduleDialogVisible.value = false
  } catch (error: any) {
    ElMessage.error(error?.message || '删除失败')
  }
}

function updateViewportWidth() {
  viewportWidth.value = window.innerWidth
}

onMounted(() => {
  updateViewportWidth()
  window.addEventListener('resize', updateViewportWidth, { passive: true })
  loadAll()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewportWidth)
})
</script>

<style scoped lang="scss">
.collector-plugin-manage {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.table-card {
  border-radius: 10px;
}

.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.title-block {
  h2 {
    margin: 0;
    font-size: 20px;
    color: #303133;
  }

  span {
    display: block;
    margin-top: 6px;
    color: #909399;
    font-size: 13px;
  }
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.plugin-status {
  color: #606266;
  font-size: 13px;
}

.collector-table {
  width: 100%;

  :deep(.el-table__header th) {
    background: #f5f5f5;
    color: #606266;
    font-weight: 600;
  }

  :deep(.el-button + .el-button) {
    margin-left: 6px;
  }
}

.table-scroll {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

.name-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;

  span {
    color: #606266;
    line-height: 1.45;
  }

  small {
    color: #b0b3b8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.rule-form {
  max-height: 66vh;
  overflow-y: auto;
  padding-right: 8px;
}

.form-tip {
  margin-left: 10px;
  color: #909399;
  font-size: 12px;
}

.entry-urls-item .el-form-item__content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.list-rule-item {
  position: relative;
}

.list-rule-item .el-form-item__content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.list-test-btn {
  flex-shrink: 0;
}

.batch-progress-panel {
  max-height: 400px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.batch-stats {
  margin-bottom: 4px;
}

.stat-item {
  text-align: center;
  padding: 8px 4px;
  background: #f5f7fa;
  border-radius: 6px;
}

.stat-num {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}

.stat-success .stat-num { color: #67c23a; }
.stat-fail .stat-num { color: #f56c6c; }
.stat-skip .stat-num { color: #909399; }

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.batch-book-list {
  flex: 1;
  overflow-y: auto;
  max-height: 260px;
  margin-top: 8px;
}

.batch-book-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
}

.batch-book-item .book-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #303133;
}

.batch-book-item .book-chapters {
  color: #909399;
  font-size: 12px;
  flex-shrink: 0;
}

.field-sub {
  padding: 8px 12px 12px 24px;
  margin: -8px 0 12px 0;
  background: #f8f9fa;
  border-left: 3px solid #409eff;
  border-radius: 0 4px 4px 0;
}

.field-sub .el-form-item {
  margin-bottom: 8px;
}

.field-sub .el-form-item__label {
  font-weight: normal;
  color: #606266;
}

.test-result {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-table {
  margin-top: 10px;
}

.content-preview {
  margin: 10px 0 0;
  padding: 12px;
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  background: #f7f8fa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  color: #303133;
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 768px) {
  .collector-plugin-manage {
    gap: 10px;
  }

  .table-card {
    :deep(.el-card__header) {
      padding: 14px 14px 10px;
    }

    :deep(.el-card__body) {
      padding: 0 10px 12px;
      overflow-x: auto;
    }
  }

  .page-toolbar {
    width: 100%;
    align-items: flex-start;
    gap: 12px;
  }

  .title-block {
    h2 {
      font-size: 18px;
    }

    span {
      font-size: 12px;
      line-height: 1.5;
    }
  }

  .toolbar-actions {
    width: 100%;
    gap: 8px;

    .plugin-status {
      width: 100%;
    }

    :deep(.el-button) {
      flex: 1 1 calc(33.333% - 8px);
      min-width: 0;
      margin-left: 0;
      padding: 8px 10px;
    }

    :deep(.el-switch) {
      flex: 0 0 auto;
      margin-right: auto;
    }
  }

  .collector-table {
    min-width: 640px;

    :deep(.el-button) {
      margin: 2px;
      padding: 5px 8px;
    }

    :deep(.el-button + .el-button) {
      margin-left: 2px;
    }
  }

  .table-scroll {
    margin: 0 -10px;
    padding: 0 10px;
    box-sizing: border-box;
  }
}
</style>
