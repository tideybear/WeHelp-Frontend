<script setup>
import { reactive, computed, watch, ref, nextTick, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Calendar } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import {
  getProjectDetailAPI,
  updateProjectStatusAPI,
  updateProjectDatesAPI,
  updateProjectInfoAPI,
} from '@/apis/project'
import { useUserStore } from '@/stores/userStore'
import { useProjectCategories } from '@/composables/useProjectCategories'

defineOptions({ name: 'ProjectDetailInfoCard' })

const emit = defineEmits(['detail-loaded'])

const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)
const { categoryOptions, categoriesLoading, loadCategories, labelForCategoryId } = useProjectCategories()

const DASH = '-'

const STATUS_OPTIONS = ['未开始', '进行中', '已结束']

/** 与详情 / 接口字段一致 */
const DATE_FIELD_KEYS = [
  'planned_start_date',
  'planned_end_date',
  'actual_start_date',
  'actual_end_date',
]

const DATE_FIELD_LABELS = {
  planned_start_date: '计划开始日期',
  planned_end_date: '计划结束日期',
  actual_start_date: '实际开始日期',
  actual_end_date: '实际结束日期',
}

/** 实际开始/结束日期允许为空，保存时可置空 */
const OPTIONAL_DATE_FIELDS = new Set(['actual_start_date', 'actual_end_date'])

/** 详情展示字段 → 提交 `/project/info` 的列名 */
const TEXT_EDIT_API_FIELD = {
  project_code: 'project_code',
  name: 'project_name',
  project_manager: 'project_manager',
  description: 'description',
}

const props = defineProps({
  /** 项目主键，与接口 `project_id` 一致 */
  projectId: {
    type: [Number, String],
    default: null,
  },
  /** 项目负责人或系统管理员为 true 时可编辑页内基本信息 */
  canEdit: {
    type: Boolean,
    default: false,
  },
})

const operatorUserId = computed(() => {
  const id = userInfo.value?.id
  const n = Number(id)
  return Number.isFinite(n) ? n : null
})

function dashText(val) {
  if (val == null) return DASH
  if (typeof val === 'string' && val.trim() === '') return DASH
  return String(val)
}

/**
 * 项目编号展示：业务编码 project_code → 表主键 id → 路由上的 project_id → 无则 -
 */
function resolveProjectCode(row, fallbackProjectId) {
  if (row && typeof row === 'object') {
    const raw = row.project_code ?? row.projectCode ?? row.projectcode
    if (raw != null && String(raw).trim() !== '') {
      return String(raw).trim()
    }
    const id = row.id ?? row.project_id ?? row.projectId
    if (id != null && id !== '') {
      return String(id)
    }
  }
  if (fallbackProjectId != null && fallbackProjectId !== '') {
    return String(fallbackProjectId)
  }
  return DASH
}

function formatDate(val) {
  if (val == null || val === '') return DASH
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) {
    const s = String(val).trim()
    return s === '' ? DASH : s
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

function emptyDetail() {
  return {
    project_code: resolveProjectCode(null, props.projectId),
    name: DASH,
    category_id: null,
    category_name: DASH,
    status: DASH,
    project_manager: DASH,
    planned_start_date: DASH,
    planned_end_date: DASH,
    actual_start_date: DASH,
    actual_end_date: DASH,
    description: DASH,
    progress: 0,
  }
}

function mapApiRowToDetail(row) {
  if (!row || typeof row !== 'object') return emptyDetail()

  let progress = Number(row.processes ?? row.progress)
  if (!Number.isFinite(progress)) progress = 0
  progress = Math.min(100, Math.max(0, Math.round(progress)))

  const rawCid = row.category_id ?? row.categoryId
  const cidNum = Number(rawCid)
  const category_id = Number.isFinite(cidNum) ? cidNum : null
  const category_name = dashText(
    row.category_name ?? row.categoryName ?? row.categoryname,
  )

  return {
    project_code: resolveProjectCode(row, props.projectId),
    name: dashText(row.project_name ?? row.name),
    category_id,
    category_name,
    status: dashText(row.status),
    project_manager: dashText(row.project_manager ?? row.manager),
    planned_start_date: formatDate(row.planned_start_date),
    planned_end_date: formatDate(row.planned_end_date),
    actual_start_date: formatDate(row.actual_start_date),
    actual_end_date: formatDate(row.actual_end_date),
    description: dashText(row.description),
    progress,
  }
}

const detail = reactive(emptyDetail())
const loading = ref(false)
const rawDetailRow = ref(null)

async function loadDetail() {
  const raw = props.projectId
  if (raw == null || raw === '') {
    Object.assign(detail, emptyDetail())
    return
  }
  const project_id = Number(raw)
  if (!Number.isFinite(project_id)) {
    Object.assign(detail, emptyDetail())
    return
  }

  loading.value = true
  try {
    const res = await getProjectDetailAPI({ project_id })
    if (res?.code !== 200) {
      Object.assign(detail, emptyDetail())
      return
    }
    const rows = Array.isArray(res?.data) ? res.data : []
    rawDetailRow.value = rows[0] ?? null
    Object.assign(detail, mapApiRowToDetail(rows[0]))
    if (detail.category_id != null) {
      const lbl = labelForCategoryId(detail.category_id, detail.category_name)
      if (lbl && detail.category_name === DASH) {
        detail.category_name = lbl
      }
    }
    emit('detail-loaded', rawDetailRow.value)
  } catch {
    rawDetailRow.value = null
    Object.assign(detail, emptyDetail())
    emit('detail-loaded', null)
  } finally {
    loading.value = false
  }
}

defineExpose({ loadDetail, rawDetailRow })

watch(
  () => props.projectId,
  () => {
    loadDetail()
  },
  { immediate: true },
)

onMounted(() => {
  loadCategories()
})

const CATEGORY_EDIT_FIELD = 'category'

const categorySaving = ref(false)
const categoryEditDraft = ref(null)

const categoryDisplayLabel = computed(() => {
  if (detail.category_id != null) {
    return labelForCategoryId(detail.category_id, detail.category_name) || detail.category_name
  }
  return detail.category_name
})

const categoryTagVisible = computed(() => {
  const label = String(categoryDisplayLabel.value ?? '').trim()
  return label !== '' && label !== DASH
})

function normalizeCategoryId(val) {
  if (val == null || val === '') return null
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

function startCategoryEdit() {
  if (fieldEditDisabled.value || categorySaving.value || textSaving.value) return
  if (!props.canEdit) return
  if (textEditingField.value && textEditingField.value !== CATEGORY_EDIT_FIELD) {
    cancelTextEdit()
  }
  categoryEditDraft.value = normalizeCategoryId(detail.category_id)
  textEditingField.value = CATEGORY_EDIT_FIELD
  loadCategories()
}

function cancelCategoryEdit() {
  detail.category_id = categoryEditDraft.value
  categoryEditDraft.value = null
  if (textEditingField.value === CATEGORY_EDIT_FIELD) {
    textEditingField.value = ''
  }
}

async function saveCategoryField() {
  if (fieldEditDisabled.value || categorySaving.value || textSaving.value) return
  if (textEditingField.value !== CATEGORY_EDIT_FIELD) return
  if (operatorUserId.value == null) return
  const project_id = Number(props.projectId)
  if (!Number.isFinite(project_id)) return

  const nextId = normalizeCategoryId(detail.category_id)
  const draftId = normalizeCategoryId(categoryEditDraft.value)
  if (nextId === draftId) {
    cancelCategoryEdit()
    return
  }

  categorySaving.value = true
  try {
    const res = await updateProjectInfoAPI({
      project_id,
      operator_user_id: operatorUserId.value,
      category_id: nextId,
    })
    if (res?.code !== 200) {
      ElMessage.warning(res?.msg || '更新失败')
      await loadDetail()
      return
    }
    ElMessage.success('已保存')
    categoryEditDraft.value = null
    textEditingField.value = ''
    await loadDetail()
  } finally {
    categorySaving.value = false
  }
}

const statusSaving = ref(false)

const statusEditDisabled = computed(() => {
  if (!props.canEdit) return true
  const raw = props.projectId
  if (raw == null || raw === '') return true
  return !Number.isFinite(Number(raw))
})

const fieldEditDisabled = computed(
  () => statusEditDisabled.value || loading.value,
)

function formatYmdFromDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayYmd() {
  return formatYmdFromDate(new Date())
}

/** 将详情展示（yyyy.MM.dd / yyyy-MM-dd / 可解析字符串）转为选择器用的 yyyy-MM-dd；无效则 null */
function parseDisplayToYmd(displayStr) {
  if (displayStr == null || displayStr === '' || displayStr === DASH) return null
  const s = String(displayStr).trim()
  const dot = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(s)
  if (dot) return `${dot[1]}-${dot[2]}-${dot[3]}`
  const dash = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (dash) return `${dash[1]}-${dash[2]}-${dash[3]}`
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return formatYmdFromDate(d)
  return null
}

const datePickerVisible = ref(false)
const dateEditField = ref('')
const datePickerModel = ref('')
const dateSaving = ref(false)

const datePickerTitle = computed(() => DATE_FIELD_LABELS[dateEditField.value] || '选择日期')

const datePickerClearable = computed(() => OPTIONAL_DATE_FIELDS.has(dateEditField.value))

function openDatePicker(field) {
  if (fieldEditDisabled.value) return
  dateEditField.value = field
  const parsed = parseDisplayToYmd(detail[field])
  datePickerModel.value = parsed ?? (OPTIONAL_DATE_FIELDS.has(field) ? null : todayYmd())
  datePickerVisible.value = true
}

async function saveDatePicker() {
  if (fieldEditDisabled.value || dateSaving.value) return
  if (operatorUserId.value == null) return
  const field = dateEditField.value
  if (!DATE_FIELD_KEYS.includes(field)) return
  const project_id = Number(props.projectId)
  const optional = OPTIONAL_DATE_FIELDS.has(field)
  const value = datePickerModel.value ? String(datePickerModel.value).trim() : ''
  if (!value && !optional) {
    ElMessage.warning('请选择日期')
    return
  }
  const prevYmd = parseDisplayToYmd(detail[field])
  const nextYmd = value || null
  if (prevYmd === nextYmd) {
    datePickerVisible.value = false
    return
  }
  dateSaving.value = true
  try {
    const res = await updateProjectDatesAPI({
      project_id,
      operator_user_id: operatorUserId.value,
      [field]: nextYmd,
    })
    if (res?.code !== 200) {
      ElMessage.warning(res?.msg || '更新失败')
      return
    }
    datePickerVisible.value = false
    ElMessage.success('日期已更新')
    await loadDetail()
  } finally {
    dateSaving.value = false
  }
}

function onDateDialogClosed() {
  dateEditField.value = ''
  datePickerModel.value = ''
}

const onStatusCommand = async (cmd) => {
  if (statusEditDisabled.value || statusSaving.value) return
  if (cmd === detail.status) return
  if (detail.status === '未开始' && cmd === '进行中') {
    const hasStart = parseDisplayToYmd(detail.planned_start_date) != null
    const hasEnd = parseDisplayToYmd(detail.planned_end_date) != null
    if (!hasStart || !hasEnd) {
      ElMessage.warning('请先将计划开始日期和计划结束日期填写完整，再切换为进行中')
      return
    }
  }
  const project_id = Number(props.projectId)
  if (operatorUserId.value == null) return
  statusSaving.value = true
  try {
    const res = await updateProjectStatusAPI({
      project_id,
      status: cmd,
      operator_user_id: operatorUserId.value,
    })
    if (res?.code !== 200) {
      ElMessage.warning(res?.msg || '更新失败')
      return
    }
    detail.status = cmd
    ElMessage.success('状态已更新')
  } finally {
    statusSaving.value = false
  }
}

const statusTagType = (status) => {
  if (status === DASH || status === '-') return 'info'
  if (status === '进行中') return 'success'
  if (status === '未开始') return 'warning'
  if (status === '已结束') return 'info'
  return 'info'
}

const textEditingField = ref('')
const textEditModel = ref('')
const textEditDraft = ref('')
const textSaving = ref(false)
const textEditInputRef = ref(null)

function detailDisplayToEditModel(val) {
  if (val == null || val === DASH) return ''
  return String(val)
}

watch(textEditingField, (field) => {
  if (!field || field === CATEGORY_EDIT_FIELD) return
  nextTick(() => {
    textEditInputRef.value?.focus?.()
  })
})

function startTextEdit(field) {
  if (fieldEditDisabled.value || textSaving.value || categorySaving.value) return
  if (!TEXT_EDIT_API_FIELD[field]) return
  if (textEditingField.value === CATEGORY_EDIT_FIELD) {
    cancelCategoryEdit()
  }
  textEditingField.value = field
  const draft = detailDisplayToEditModel(detail[field])
  textEditDraft.value = draft
  textEditModel.value = draft
}

function cancelTextEdit() {
  if (textEditingField.value === CATEGORY_EDIT_FIELD) {
    cancelCategoryEdit()
    return
  }
  textEditingField.value = ''
  textEditModel.value = ''
  textEditDraft.value = ''
}

async function saveTextField() {
  if (fieldEditDisabled.value || textSaving.value) return
  if (operatorUserId.value == null) return
  const field = textEditingField.value
  const apiKey = TEXT_EDIT_API_FIELD[field]
  if (!apiKey) return

  const trimmed = String(textEditModel.value ?? '').trim()
  const draftTrimmed = String(textEditDraft.value ?? '').trim()
  if (trimmed === draftTrimmed) {
    cancelTextEdit()
    return
  }

  if (field === 'name' && !trimmed) {
    ElMessage.warning('项目名称不能为空')
    return
  }

  const project_id = Number(props.projectId)
  textSaving.value = true
  try {
    const res = await updateProjectInfoAPI({
      project_id,
      operator_user_id: operatorUserId.value,
      [apiKey]: trimmed,
    })
    if (res?.code !== 200) {
      ElMessage.warning(res?.msg || '更新失败')
      return
    }
    ElMessage.success('已保存')
    cancelTextEdit()
    await loadDetail()
  } finally {
    textSaving.value = false
  }
}

function onTextFieldKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault()
    cancelTextEdit()
    return
  }
  if (e.key !== 'Enter') return
  if (textEditingField.value === 'description') {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    saveTextField()
    return
  }
  e.preventDefault()
  saveTextField()
}


</script>

<template>
  <div class="project-detail-info-card__wrap">
    <div v-if="categoryTagVisible" class="project-detail-info-card__category-tag-row">
      <el-tag
        size="small"
        effect="plain"
        type="primary"
        class="project-detail-info-card__category-tag"
      >
        {{ categoryDisplayLabel }}
      </el-tag>
    </div>
    <el-card v-loading="loading" class="project-detail-info-card" shadow="never">
      <el-descriptions :column="2" border class="project-detail-info-card__desc">
        <el-descriptions-item label="项目编号">
          <div v-if="textEditingField === 'project_code'" class="project-detail-info-card__inline-edit">
            <el-input
              ref="textEditInputRef"
              v-model="textEditModel"
              size="small"
              clearable
              placeholder="项目编号"
              @keydown="onTextFieldKeydown"
            />
            <div class="project-detail-info-card__inline-edit-actions">
              <el-button type="primary" link size="small" :loading="textSaving" @click="saveTextField">
                保存
              </el-button>
              <el-button link size="small" :disabled="textSaving" @click="cancelTextEdit">取消</el-button>
            </div>
          </div>
          <span
            v-else
            class="project-detail-info-card__editable-text"
            :title="canEdit ? '双击可编辑' : undefined"
            @dblclick="startTextEdit('project_code')"
            >{{ detail.project_code }}</span
          >
        </el-descriptions-item>
        <el-descriptions-item label="项目名称">
          <div v-if="textEditingField === 'name'" class="project-detail-info-card__inline-edit">
            <el-input
              ref="textEditInputRef"
              v-model="textEditModel"
              size="small"
              clearable
              placeholder="项目名称"
              @keydown="onTextFieldKeydown"
            />
            <div class="project-detail-info-card__inline-edit-actions">
              <el-button type="primary" link size="small" :loading="textSaving" @click="saveTextField">
                保存
              </el-button>
              <el-button link size="small" :disabled="textSaving" @click="cancelTextEdit">取消</el-button>
            </div>
          </div>
          <span
            v-else
            class="project-detail-info-card__editable-text"
            :title="canEdit ? '双击可编辑' : undefined"
            @dblclick="startTextEdit('name')"
            >{{ detail.name }}</span
          >
        </el-descriptions-item>
        <el-descriptions-item label="项目类型">
          <div
            v-if="textEditingField === CATEGORY_EDIT_FIELD"
            class="project-detail-info-card__inline-edit"
          >
            <el-select
              v-model="detail.category_id"
              clearable
              filterable
              placeholder="请选择项目类型"
              class="project-detail-info-card__category-select"
              :loading="categoriesLoading"
              :disabled="categorySaving"
            >
              <el-option
                v-for="opt in categoryOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <div class="project-detail-info-card__inline-edit-actions">
              <el-button type="primary" link size="small" :loading="categorySaving" @click="saveCategoryField">
                保存
              </el-button>
              <el-button link size="small" :disabled="categorySaving" @click="cancelCategoryEdit">取消</el-button>
            </div>
          </div>
          <span
            v-else
            class="project-detail-info-card__editable-text"
            :class="{ 'project-detail-info-card__editable-text--readonly': !canEdit }"
            :title="canEdit ? '双击可编辑' : undefined"
            @dblclick="startCategoryEdit"
          >{{ categoryDisplayLabel }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="项目状态">
          <el-dropdown
            trigger="click"
            :disabled="statusEditDisabled || statusSaving || loading"
            @command="onStatusCommand"
          >
            <span class="project-detail-info-card__status-trigger" role="button" tabindex="0">
              <el-tag
                size="small"
                effect="plain"
                :type="statusTagType(detail.status)"
                class="project-detail-info-card__status-tag"
              >
                {{ detail.status }}
                <span class="project-detail-info-card__status-caret" aria-hidden="true">▾</span>
              </el-tag>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="s in STATUS_OPTIONS"
                  :key="s"
                  :command="s"
                  :disabled="s === detail.status"
                >
                  {{ s }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-descriptions-item>
        <el-descriptions-item label="负责人">
          <div v-if="textEditingField === 'project_manager'" class="project-detail-info-card__inline-edit">
            <el-input
              ref="textEditInputRef"
              v-model="textEditModel"
              size="small"
              clearable
              placeholder="负责人"
              @keydown="onTextFieldKeydown"
            />
            <div class="project-detail-info-card__inline-edit-actions">
              <el-button type="primary" link size="small" :loading="textSaving" @click="saveTextField">
                保存
              </el-button>
              <el-button link size="small" :disabled="textSaving" @click="cancelTextEdit">取消</el-button>
            </div>
          </div>
          <span
            v-else
            class="project-detail-info-card__editable-text"
            :title="canEdit ? '双击可编辑' : undefined"
            @dblclick="startTextEdit('project_manager')"
            >{{ detail.project_manager }}</span
          >
        </el-descriptions-item>
        <el-descriptions-item
          v-for="key in DATE_FIELD_KEYS"
          :key="key"
          :label="DATE_FIELD_LABELS[key]"
        >
          <div class="project-detail-info-card__date-cell">
            <span class="project-detail-info-card__date-text">{{ detail[key] }}</span>
            <el-button
              type="primary"
              link
              size="small"
              :icon="Calendar"
              :disabled="statusEditDisabled || loading"
              :aria-label="`修改${DATE_FIELD_LABELS[key]}`"
              @click="openDatePicker(key)"
            />
          </div>
        </el-descriptions-item>
        <el-descriptions-item label="项目描述" :span="2">
          <div v-if="textEditingField === 'description'" class="project-detail-info-card__inline-edit">
            <el-input
              ref="textEditInputRef"
              v-model="textEditModel"
              type="textarea"
              :rows="5"
              maxlength="2000"
              show-word-limit
              @keydown="onTextFieldKeydown"
            />
            <div class="project-detail-info-card__inline-edit-actions">
              <el-button type="primary" link size="small" :loading="textSaving" @click="saveTextField">
                保存
              </el-button>
              <el-button link size="small" :disabled="textSaving" @click="cancelTextEdit">取消</el-button>
              <span class="project-detail-info-card__inline-edit-hint">描述中换行请直接按 Enter；保存请点按钮或使用 Ctrl/⌘ + Enter</span>
            </div>
          </div>
          <div
            v-else
            class="project-detail-info-card__description project-detail-info-card__editable-text"
            :class="{ 'project-detail-info-card__editable-text--readonly': !canEdit }"
            :title="canEdit ? '双击可编辑' : undefined"
            @dblclick="startTextEdit('description')"
          >
            {{ detail.description }}
          </div>
        </el-descriptions-item>
        <el-descriptions-item label="当前进度">
          <div class="project-detail-info-card__progress">
            <el-progress :percentage="detail.progress" :stroke-width="14" />
          </div>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-dialog
      v-model="datePickerVisible"
      class="project-detail-info-card__date-dialog"
      :title="datePickerTitle"
      width="400px"
      append-to-body
      destroy-on-close
      @closed="onDateDialogClosed"
    >
      <el-date-picker
        v-model="datePickerModel"
        type="date"
        value-format="YYYY-MM-DD"
        :clearable="datePickerClearable"
        :placeholder="datePickerClearable ? '选择日期，可留空' : '选择日期'"
        style="width: 100%"
        teleported
      />
      <template #footer>
        <el-button @click="datePickerVisible = false">取消</el-button>
        <el-button type="primary" :loading="dateSaving" @click="saveDatePicker">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.project-detail-info-card__wrap {
  width: 100%;
  padding: 1%;
  background-color: #ffffff;
}

.project-detail-info-card__category-tag-row {
  width: 100%;
  box-sizing: border-box;
  padding: 0 var(--el-card-padding) 8px;
  padding-left: 20px;
}

.project-detail-info-card__category-tag {
  max-width: 100%;
}

.project-detail-info-card {
  width: 100%;
  --el-card-border-color: transparent;
  border: none;
  box-shadow: none;

  :deep(.el-card__body) {
    padding: var(--el-card-padding);
  }
}

.project-detail-info-card__desc {
  :deep(.el-descriptions__label) {
    width: 120px;
    font-weight: 500;
  }
}

.project-detail-info-card__date-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.project-detail-info-card__date-text {
  min-width: 0;
}

.project-detail-info-card__category-select {
  width: 100%;
  max-width: 280px;
}

.project-detail-info-card__status-trigger {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  outline: none;

  &:focus-visible .project-detail-info-card__status-tag {
    outline: 2px solid var(--el-color-primary-light-5);
    outline-offset: 2px;
    border-radius: 4px;
  }
}

.project-detail-info-card__status-tag {
  cursor: pointer;
}

.project-detail-info-card__status-caret {
  margin-left: 4px;
  font-size: 10px;
  opacity: 0.75;
}

.project-detail-info-card__editable-text {
  display: inline-block;
  max-width: 100%;
  cursor: text;
  user-select: text;
}

.project-detail-info-card__editable-text--readonly {
  cursor: default;
}

.project-detail-info-card__inline-edit {
  width: 100%;
}

.project-detail-info-card__inline-edit-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 6px;
}

.project-detail-info-card__inline-edit-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.project-detail-info-card__description {
  box-sizing: border-box;
  min-height: 96px;
  padding: 8px 0;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--el-text-color-regular);
}

.project-detail-info-card__progress {
  width: 100%;
  padding-top: 4px;
}
</style>
