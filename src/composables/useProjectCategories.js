import { ref } from 'vue'
import { getProjectCategoriesListAPI } from '@/apis/project'

let cachedOptions = null

function normalizeCategoryOptions(rows) {
  return (rows || [])
    .map((r) => {
      const id = r?.category_id ?? r?.categoryId
      const n = Number(id)
      if (!Number.isFinite(n)) return null
      const name = String(r?.category_name ?? r?.categoryName ?? '').trim()
      return {
        value: n,
        label: name || `类型 ${n}`,
      }
    })
    .filter(Boolean)
}

/**
 * 加载 project_categories 选项（带简单内存缓存）
 */
export function useProjectCategories() {
  const categoryOptions = ref(cachedOptions ? [...cachedOptions] : [])
  const categoriesLoading = ref(false)

  async function loadCategories(force = false) {
    if (!force && cachedOptions?.length) {
      categoryOptions.value = [...cachedOptions]
      return categoryOptions.value
    }
    categoriesLoading.value = true
    try {
      const res = await getProjectCategoriesListAPI()
      const list = res?.code === 200 && Array.isArray(res.data) ? res.data : []
      const opts = normalizeCategoryOptions(list)
      cachedOptions = opts
      categoryOptions.value = [...opts]
      return opts
    } catch (e) {
      console.error('加载项目类型失败:', e)
      categoryOptions.value = []
      return []
    } finally {
      categoriesLoading.value = false
    }
  }

  function labelForCategoryId(id, fallbackName = '') {
    const n = Number(id)
    if (!Number.isFinite(n)) return fallbackName || ''
    const hit = categoryOptions.value.find((o) => o.value === n)
    return hit?.label || fallbackName || ''
  }

  return {
    categoryOptions,
    categoriesLoading,
    loadCategories,
    labelForCategoryId,
  }
}
