<script setup>
import { reactive, ref, computed } from 'vue'
import { Plus, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useMenu } from '@/stores/menuStore'
import { useUserStore } from '@/stores/userStore'
import { createProjectAPI } from '@/apis/project'
import { useProjectCategories } from '@/composables/useProjectCategories'

defineOptions({ name: 'ProjectToolbar' })

const emit = defineEmits(['created'])

const menuStore = useMenu()
const userStore = useUserStore()
const { currentNamespaceId } = storeToRefs(menuStore)

const STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '进行中', value: '进行中' },
  { label: '未开始', value: '未开始' },
  { label: '已结束', value: '已结束' },
  { label: '已逾期', value: '已逾期' },
]


const filterKeyword = defineModel('filterKeyword', { type: String, default: '' })
const filterStatus = defineModel('filterStatus', { type: String, default: '' })

const resetFilters = () => {
  filterKeyword.value = ''
  filterStatus.value = ''
}

/** 与实时筛选一致；查询时去掉首尾空格 */
const applyFilter = () => {
  filterKeyword.value = filterKeyword.value.trim()
}

const createVisible = ref(false)
const createFormRef = ref()
const createSubmitting = ref(false)
const { categoryOptions, categoriesLoading, loadCategories } = useProjectCategories()

const createForm = reactive({
  name: '',
  category_id: null,
  /** 项目成员（多选），不含当前登录用户；不含 user_id=1（由后端自动加入） */
  memberUserIds: [],
})

/** 当前空间下可选成员：除当前登录用户外的 userList */
const projectMemberOptions = computed(() => {
  const me = Number(userStore.userInfo?.id)
  const list = userStore.userList || []
  return list
    .filter((u) => u?.id != null && Number(u.id) !== me)
    .map((u) => ({
      label: String(u.name ?? u.account ?? u.id).trim() || String(u.id),
      value: Number(u.id),
    }))
})

const createRules = {
  name: [
    { required: true, message: '请输入项目名称', trigger: 'blur' },
    { min: 1, max: 100, message: '长度在 1～100 个字符', trigger: 'blur' },
  ],
}

const resetCreateForm = () => {
  createForm.name = ''
  createForm.category_id = null
  createForm.memberUserIds = []
  createFormRef.value?.resetFields?.()
}

const openCreateDialog = async () => {
  resetCreateForm()
  const pid = currentNamespaceId.value
  if (pid != null && pid !== '' && (!userStore.userList?.length)) {
    await userStore.fetchUserList(Number(pid)).catch(() => {})
  }
  await loadCategories()
  createVisible.value = true
}

const submitCreate = async () => {
  await createFormRef.value?.validate?.().catch(() => Promise.reject())
  const pid = currentNamespaceId.value
  const uid = userStore.userInfo?.id
  if (pid == null || pid === '' || uid == null || uid === '') {
    ElMessage.warning('请先选择空间并登录')
    return
  }
  createSubmitting.value = true
  try {
    const me = userStore.userInfo
    const managerName = String(me?.name || me?.account || '').trim()
    const res = await createProjectAPI({
      namespace_id: Number(pid),
      user_id: Number(uid),
      name: createForm.name.trim(),
      ...(managerName ? { project_manager: managerName } : {}),
      ...(createForm.category_id != null && createForm.category_id !== ''
        ? { category_id: Number(createForm.category_id) }
        : {}),
      authorize_user_ids: Array.isArray(createForm.memberUserIds)
        ? createForm.memberUserIds.map((x) => Number(x)).filter((n) => Number.isFinite(n))
        : [],
    })
    if (res?.code !== 200) {
      ElMessage.warning(res?.msg || '创建失败')
      return
    }
    const code = res?.data?.project_code
    ElMessage.success(
      code
        ? `创建成功，项目编号：${code}`
        : res?.msg === 'success'
          ? '创建成功'
          : res?.msg || '创建成功',
    )
    createVisible.value = false
    emit('created')
  } finally {
    createSubmitting.value = false
  }
}
</script>

<template>
  <div class="project-toolbar">
    <el-card class="project-toolbar-card" shadow="never">
      <div class="project-toolbar-row">
        <el-form :inline="true" class="project-filter-form" label-width="88px" @submit.prevent>
          <el-form-item label="项目名称">
            <el-input
              v-model="filterKeyword"
              class="project-filter-input"
              clearable
              placeholder="输入名称关键字搜索"
              :prefix-icon="Search"
            />
          </el-form-item>
          <el-form-item label="项目状态">
            <el-select
              v-model="filterStatus"
              class="project-filter-select"
              clearable
              placeholder="全部状态"
            >
              <el-option
                v-for="opt in STATUS_OPTIONS"
                :key="opt.value === '' ? 'all' : opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item class="project-filter-actions">
            <el-button type="primary" @click="applyFilter">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
        <div class="project-toolbar-extra">
          <el-tooltip content="新增项目" placement="top">
            <el-button
              type="primary"
              :icon="Plus"
              circle
              aria-label="新增项目"
              @click="openCreateDialog"
            />
          </el-tooltip>
        </div>
      </div>
    </el-card>

    <el-dialog
      v-model="createVisible"
      class="project-toolbar-dialog"
      title="新增项目"
      width="560px"
      destroy-on-close
      append-to-body
      @closed="resetCreateForm"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="88px"
        @submit.prevent
      >
        <el-form-item label="项目名称" prop="name">
          <el-input
            v-model="createForm.name"
            clearable
            placeholder="请输入项目名称"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="项目类型">
          <el-select
            v-model="createForm.category_id"
            clearable
            filterable
            placeholder="请选择项目类型"
            class="project-create-category"
            :loading="categoriesLoading"
          >
            <el-option
              v-for="opt in categoryOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="项目成员">
          <el-select
            v-model="createForm.memberUserIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            clearable
            filterable
            placeholder="请选择项目成员"
            class="project-create-members"
          >
            <el-option
              v-for="opt in projectMemberOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="createSubmitting" @click="submitCreate">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
/* 本页主色 #409eff（与 Element Plus 默认主色梯度一致，供按钮/聚焦态等） */
$toolbar-primary: #409eff;
$toolbar-primary-light-3: #79bbff;
$toolbar-primary-light-5: #a0cfff;
$toolbar-primary-light-7: #c6e2ff;
$toolbar-primary-light-8: #d9ecff;
$toolbar-primary-light-9: #ecf5ff;
$toolbar-primary-dark-2: #337ecc;

.project-toolbar {
  flex-shrink: 0;
  margin-bottom: 16px;
  --el-color-primary: #{$toolbar-primary};
  --el-color-primary-light-3: #{$toolbar-primary-light-3};
  --el-color-primary-light-5: #{$toolbar-primary-light-5};
  --el-color-primary-light-7: #{$toolbar-primary-light-7};
  --el-color-primary-light-8: #{$toolbar-primary-light-8};
  --el-color-primary-light-9: #{$toolbar-primary-light-9};
  --el-color-primary-dark-2: #{$toolbar-primary-dark-2};
}

.project-toolbar-card {
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);

  :deep(.el-card__body) {
    padding: 16px 20px 6px;
  }
}

.project-toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px 16px;
}

.project-filter-form {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0 8px;
}

.project-toolbar-extra {
  flex-shrink: 0;
  margin-left: auto;
  margin-bottom: 18px;
}

.project-filter-input {
  width: 240px;
}

.project-filter-select {
  width: 160px;
}

.project-create-members,
.project-create-category {
  width: 100%;
}

.project-filter-actions {
  margin-right: 0;
  margin-bottom: 18px;
}
</style>

<!-- append-to-body 的弹窗不在 scoped 子树内，需单独覆盖主色变量 -->
<style lang="scss">
.project-toolbar-dialog.el-dialog {
  --el-color-primary: #409eff;
  --el-color-primary-light-3: #79bbff;
  --el-color-primary-light-5: #a0cfff;
  --el-color-primary-light-7: #c6e2ff;
  --el-color-primary-light-8: #d9ecff;
  --el-color-primary-light-9: #ecf5ff;
  --el-color-primary-dark-2: #337ecc;
}
</style>
