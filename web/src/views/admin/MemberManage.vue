<template>
  <div class="member-manage">
    <div class="toolbar">
      <el-button type="primary" @click="openCreateDialog">新增会员套餐</el-button>
    </div>

    <el-table :data="configs" v-loading="loading" style="width: 100%">
      <el-table-column prop="product_type" label="类型" width="100" />
      <el-table-column prop="name" label="名称" width="120" />
      <el-table-column prop="price" label="原价" width="100">
        <template #default="{ row }">¥{{ row.price }}</template>
      </el-table-column>
      <el-table-column prop="sale_price" label="售价" width="100">
        <template #default="{ row }">¥{{ row.sale_price }}</template>
      </el-table-column>
      <el-table-column prop="duration_days" label="有效天数" width="100" />
      <el-table-column prop="badge_icon" label="标识" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.badge_icon" :color="row.badge_color">{{ row.badge_icon }}</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" />
      <el-table-column prop="is_active" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'info'">{{ row.is_active ? '上架' : '下架' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
          <el-button type="danger" link size="small" @click="deleteConfig(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑会员套餐' : '新增会员套餐'" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="类型标识" required>
          <el-input v-model="form.product_type" placeholder="如 monthly/quarterly/yearly" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如 月会员" />
        </el-form-item>
        <el-form-item label="原价" required>
          <el-input-number v-model="form.price" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="售价" required>
          <el-input-number v-model="form.sale_price" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="有效天数" required>
          <el-input-number v-model="form.duration_days" :min="1" />
        </el-form-item>
        <el-form-item label="会员标识">
          <el-input v-model="form.badge_icon" placeholder="如 VIP" />
        </el-form-item>
        <el-form-item label="标识颜色">
          <el-color-picker v-model="form.badge_color" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="上架">
          <el-switch v-model="form.is_active" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { memberApi, unwrapResponse, type MembershipConfig } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const configs = ref<MembershipConfig[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number>(0)

const defaultForm: Partial<MembershipConfig> = {
  product_type: '',
  name: '',
  price: 0,
  sale_price: 0,
  duration_days: 30,
  badge_icon: 'VIP',
  badge_color: '#FFD700',
  description: '',
  sort_order: 0,
  is_active: 1,
}

const form = ref<Partial<MembershipConfig>>({ ...defaultForm })

async function loadConfigs() {
  loading.value = true
  try {
    const res = await memberApi.getAdminConfigs()
    configs.value = unwrapResponse(res)
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  isEdit.value = false
  editingId.value = 0
  form.value = { ...defaultForm }
  dialogVisible.value = true
}

function openEditDialog(row: MembershipConfig) {
  isEdit.value = true
  editingId.value = row.id
  form.value = { ...row }
  dialogVisible.value = true
}

async function saveConfig() {
  try {
    if (isEdit.value) {
      await memberApi.updateConfig(editingId.value, form.value)
    } else {
      await memberApi.createConfig(form.value)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadConfigs()
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  }
}

async function deleteConfig(id: number) {
  try {
    await ElMessageBox.confirm('确定删除该会员套餐吗？', '提示', { type: 'warning' })
    await memberApi.deleteConfig(id)
    ElMessage.success('删除成功')
    loadConfigs()
  } catch {
    // 取消删除
  }
}

onMounted(loadConfigs)
</script>

<style scoped>
.member-manage {
  padding: 20px;
}
.toolbar {
  margin-bottom: 16px;
}
</style>
