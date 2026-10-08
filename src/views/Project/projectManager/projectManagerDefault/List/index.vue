<script setup>
defineOptions({ name: 'ProjectListPage' })

import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useMenu } from '@/stores/menuStore'
import { useUserStore } from '@/stores/userStore'
import { getProjectListAPI } from '@/apis/project'
import ProjectToolbar from './components/ProjectToolbar.vue'
import ProjectList from './components/ProjectList.vue'



const router = useRouter()
const menuStore = useMenu()
const userStore = useUserStore()
const { currentNamespaceId } = storeToRefs(menuStore)

const filterKeyword = ref('')
const filterStatus = ref('')
const projectList = ref([])
const listLoading = ref(false)

/** 将接口行映射为列表卡片字段（兼容常见列名） */
function normalizeProjectRow(row) {
  if (!row || typeof row !== 'object') return null
  const id = row.id ?? row.projectid ?? row.project_id
  if (id === undefined || id === null || id === '') return null
  const name = row.name ?? row.projectname ?? row.project_name ?? '未命名项目'
  const status = row.status ?? row.project_status ?? '进行中'
  const categoryName = row.categoryname ?? row.categoryName ?? row.category_name
  const rawCode = row.project_code ?? row.projectCode ?? row.projectcode
  const projectCode =
    rawCode != null && String(rawCode).trim() !== '' ? String(rawCode).trim() : String(id)
  return {
    id: String(id),
    name: String(name),
    projectCode,
    status: String(status),
    ...(categoryName != null ? { categoryName: String(categoryName) } : {}),
  }
}

const loadProjects = async () => {
  const pid = currentNamespaceId.value
  const uid = userStore.userInfo?.id
  if (pid == null || pid === '' || uid == null || uid === '') {
    projectList.value = []
    return
  }
  listLoading.value = true
  try {
    const res = await getProjectListAPI({
      namespace_id: Number(pid),
      user_id: Number(uid),
    })
    const raw = Array.isArray(res?.data) ? res.data : []
    projectList.value = raw.map(normalizeProjectRow).filter(Boolean)
  } catch {
    projectList.value = []
  } finally {
    listLoading.value = false
  }
}

watch(
  () => [currentNamespaceId.value, userStore.userInfo?.id],
  () => {
    loadProjects()
  },
  { immediate: true },
)

const filteredProjects = computed(() => {
  const kw = filterKeyword.value.trim().toLowerCase()
  const st = filterStatus.value
  return projectList.value.filter((p) => {
    const nameOk =
      !kw ||
      String(p.name).toLowerCase().includes(kw) ||
      String(p.projectCode ?? '').toLowerCase().includes(kw)
    const statusOk = st == null || st === '' || p.status === st
    return nameOk && statusOk
  })
})

const goProjectDetail = (id) => {
  router.push({ name: 'ProjectDetail', params: { id: String(id) } })
}
</script>

<template>
  <div class="project-page">
    <ProjectToolbar
      v-model:filter-keyword="filterKeyword"
      v-model:filter-status="filterStatus"
      @created="loadProjects"
    />
    <ProjectList :items="filteredProjects" :loading="listLoading" @open-detail="goProjectDetail" />
  </div>
</template>

<style scoped lang="scss">
.project-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 16px 20px 20px;
  background-color: #ffffff;
}
</style>
