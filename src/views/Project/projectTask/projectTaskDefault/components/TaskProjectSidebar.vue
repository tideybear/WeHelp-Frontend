<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Search } from '@element-plus/icons-vue'
import { useMenu } from '@/stores/menuStore'
import { useUserStore } from '@/stores/userStore'
import { getProjectListAPI } from '@/apis/project'
import { projectStatusTagType } from '../composables/useTaskProjectSidebar'


const props = defineProps({
  selectedProjectId: {
    type: [String, Number],
    default: null,
  },
})

const emit = defineEmits(['update:selectedProjectId', 'update:selectedProject', 'select'])

const menuStore = useMenu()
const userStore = useUserStore()
const { currentNamespaceId } = storeToRefs(menuStore)

const filterKeyword = ref('')
const projectList = ref([])
const listLoading = ref(false)
const listRef = ref(null)

/** 与项目列表页一致，兼容接口列名 */
function normalizeProjectRow(row) {
  if (!row || typeof row !== 'object') return null
  const id = row.id ?? row.projectid ?? row.project_id
  if (id === undefined || id === null || id === '') return null
  const name = row.name ?? row.projectname ?? row.project_name ?? '未命名项目'
  const status = row.status ?? row.project_status ?? '进行中'
  const categoryName = row.categoryname ?? row.categoryName ?? row.category_name
  return {
    id: String(id),
    name: String(name),
    status: String(status),
    ...(categoryName != null ? { categoryName: String(categoryName) } : {}),
  }
}

async function loadProjects() {
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
    void loadProjects()
  },
  { immediate: true },
)

const filteredProjects = computed(() => {
  const kw = filterKeyword.value.trim().toLowerCase()
  const list = projectList.value
  if (!kw) return list
  return list.filter((p) => String(p.name).toLowerCase().includes(kw))
})

const emptyDescription = computed(() => {
  if (listLoading.value) return '加载中…'
  if (!projectList.value.length) return '暂无项目'
  return '无匹配项目'
})

function emitSelection(row) {
  if (!row) {
    emit('update:selectedProjectId', null)
    emit('update:selectedProject', null)
    return
  }
  emit('update:selectedProjectId', row.id)
  emit('update:selectedProject', row)
}

async function scrollActiveProjectIntoView() {
  await nextTick()
  const root = listRef.value
  if (!root) return
  const active = root.querySelector('.task-project-sidebar__item.is-active')
  active?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
}

watch(
  [projectList, () => props.selectedProjectId],
  ([list, sid]) => {
    if (!list.length) {
      if (!listLoading.value) emitSelection(null)
      return
    }
    if (sid != null && sid !== '') {
      const found = list.find((p) => String(p.id) === String(sid))
      if (found) {
        emitSelection(found)
        void scrollActiveProjectIntoView()
        return
      }
      // 路由/详情带入的项目 id：列表未匹配前勿回退到第一项
      return
    }
    emitSelection(list[0])
    void scrollActiveProjectIntoView()
  },
  { flush: 'post', immediate: true },
)

watch(
  () => props.selectedProjectId,
  () => {
    void scrollActiveProjectIntoView()
  },
)

function onSelect(row) {
  emitSelection(row)
  emit('select', row.id)
}
</script>

<template>
  <div v-loading="listLoading" class="task-project-sidebar">
    <el-input
      v-model="filterKeyword"
      class="task-project-sidebar__search"
      clearable
      placeholder="搜索项目"
      :prefix-icon="Search"
    />
    <el-scrollbar class="task-project-sidebar__scroll">
      <ul v-if="filteredProjects.length" ref="listRef" class="task-project-sidebar__list">
        <li
          v-for="item in filteredProjects"
          :key="item.id"
          class="task-project-sidebar__item"
          :class="{ 'is-active': String(selectedProjectId) === String(item.id) }"
          role="button"
          tabindex="0"
          @click="onSelect(item)"
          @keydown.enter.prevent="onSelect(item)"
        >
          <span class="task-project-sidebar__name" :title="item.name">{{ item.name }}</span>
          <el-tag
            class="task-project-sidebar__tag"
            size="small"
            effect="plain"
            :type="projectStatusTagType(item.status)"
          >
            {{ item.status }}
          </el-tag>
        </li>
      </ul>
      <el-empty v-else class="task-project-sidebar__empty" :description="emptyDescription" :image-size="72" />
    </el-scrollbar>
  </div>
</template>

<style scoped lang="scss">
.task-project-sidebar {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.task-project-sidebar__search {
  flex-shrink: 0;
  margin-bottom: 10px;
}

.task-project-sidebar__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.task-project-sidebar__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.task-project-sidebar__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.is-active {
    background: var(--el-color-primary-light-9);
  }

  &:focus-visible {
    outline: 2px solid var(--el-color-primary-light-5);
    outline-offset: 1px;
  }
}

.task-project-sidebar__name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.35;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-project-sidebar__tag {
  flex-shrink: 0;
}

.task-project-sidebar__empty {
  padding: 24px 8px;
}
</style>
