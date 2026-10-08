<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import {
  getProjectUserAuthorize,
  saveProjectManageAPI,
} from '@/apis/project'
import { useUserStore } from '@/stores/userStore'
import { useProjectCategories } from '@/composables/useProjectCategories'

defineOptions({ name: 'ProjectManageDialog' })

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  projectId: {
    type: [Number, String],
    default: null,
  },
  namespaceId: {
    type: [Number, String],
    default: null,
  },
  /** 详情接口原始行 */
  projectRow: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const userStore = useUserStore()
const { userList } = storeToRefs(userStore)
const { categoryOptions, categoriesLoading, loadCategories } = useProjectCategories()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const formRef = ref()
const submitting = ref(false)
const membersLoading = ref(false)

const form = reactive({
  project_code: '',
  project_name: '',
  project_manager: '',
  category_id: null,
  description: '',
  memberUserIds: [],
})

const rules = {
  project_name: [
    { required: true, message: '请输入项目名称', trigger: 'blur' },
    { min: 1, max: 100, message: '长度在 1～100 个字符', trigger: 'blur' },
  ],
  project_manager: [
    { required: true, message: '请输入负责人', trigger: 'blur' },
  ],
}

const memberOptions = computed(() => {
  const list = userList.value || []
  return list
    .filter((u) => u?.id != null && Number(u.id) !== 1)
    .map((u) => ({
      label: String(u.name ?? u.account ?? u.id).trim() || String(u.id),
      value: Number(u.id),
    }))
})

function resetFormFromRow(row) {
  const d = row || {}
  form.project_code = String(d.project_code ?? '').trim()
  form.project_name = String(d.project_name ?? d.name ?? '').trim()
  form.project_manager = String(d.project_manager ?? '').trim()
  const rawCid = d.category_id ?? d.categoryId
  const n = Number(rawCid)
  form.category_id = Number.isFinite(n) ? n : null
  form.description = d.description != null ? String(d.description) : ''
  form.memberUserIds = []
}

async function loadMembers() {
  const pid = props.projectId
  if (pid == null || pid === '') return
  membersLoading.value = true
  try {
    const res = await getProjectUserAuthorize({ project_id: Number(pid) })
    const list = res?.code === 200 && Array.isArray(res.data) ? res.data : []
    form.memberUserIds = list
      .map((r) => Number(r.user_id))
      .filter((uid) => Number.isFinite(uid) && uid !== 1)
  } catch (e) {
    console.error('加载项目成员失败:', e)
    form.memberUserIds = []
  } finally {
    membersLoading.value = false
  }
}

async function onOpen() {
  resetFormFromRow(props.projectRow)
  const ns = props.namespaceId
  if (ns != null && ns !== '' && !userList.value?.length) {
    await userStore.fetchUserList(Number(ns)).catch(() => {})
  }
  await Promise.all([loadCategories(), loadMembers()])
}

watch(visible, (v) => {
  if (v) onOpen()
})

async function submit() {
  await formRef.value?.validate?.().catch(() => Promise.reject())

  const pid = Number(props.projectId)
  const opId = Number(userStore.userInfo?.id)
  if (!Number.isFinite(pid) || !Number.isFinite(opId)) {
    ElMessage.warning('缺少项目或用户信息')
    return
  }

  const ns = props.namespaceId
  submitting.value = true
  try {
    const payload = {
      project_id: pid,
      operator_user_id: opId,
      project_code: form.project_code.trim() || undefined,
      project_name: form.project_name.trim(),
      project_manager: form.project_manager.trim(),
      description: form.description.trim() || undefined,
      category_id: form.category_id != null && form.category_id !== '' ? Number(form.category_id) : null,
      authorize_user_ids: Array.isArray(form.memberUserIds)
        ? form.memberUserIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n !== 1)
        : [],
    }
    if (ns != null && ns !== '') {
      payload.namespace_id = Number(ns)
    }
    const res = await saveProjectManageAPI(payload)
    if (res?.code !== 200) {
      ElMessage.warning(res?.msg || '保存失败')
      return
    }
    ElMessage.success('保存成功')
    visible.value = false
    emit('saved')
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '保存失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="项目管理"
    width="640px"
    append-to-body
    destroy-on-close
    class="project-manage-dialog"
  >
    <el-form
      ref="formRef"
      v-loading="membersLoading"
      :model="form"
      :rules="rules"
      label-width="96px"
      @submit.prevent
    >
      <div class="form-section-title">基本信息</div>
      <el-form-item label="项目编号">
        <el-input v-model="form.project_code" clearable placeholder="选填" maxlength="64" />
      </el-form-item>
      <el-form-item label="项目名称" prop="project_name">
        <el-input v-model="form.project_name" clearable maxlength="100" />
      </el-form-item>
      <el-form-item label="项目类型">
        <el-select
          v-model="form.category_id"
          clearable
          filterable
          placeholder="请选择项目类型"
          class="form-field-full"
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
      <el-form-item label="负责人" prop="project_manager">
        <el-input v-model="form.project_manager" clearable maxlength="64" />
      </el-form-item>
      <el-form-item label="项目描述">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="4"
          maxlength="2000"
          show-word-limit
          placeholder="选填"
        />
      </el-form-item>

      <div class="form-section-title">项目成员</div>
      <el-form-item label="成员">
        <el-select
          v-model="form.memberUserIds"
          multiple
          filterable
          clearable
          placeholder="选择可访问本项目的成员"
          class="form-field-full"
        >
          <el-option
            v-for="opt in memberOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.form-section-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.form-field-full {
  width: 100%;
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
</style>
