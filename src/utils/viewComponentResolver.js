/**
 * 根据 view_authorize.component 解析并动态加载业务视图模块。
 *
 * 约定：
 * - 整包视图：component 名与模块根目录同名（如 financePayablesYiLu → ./financePayablesYiLu/index.vue）
 * - 列表视图：component 以 listPrefix 开头（如 financePayablesListXxx → ./List/{name}/index.vue）
 */

/**
 * @param {string[]} viewList
 * @param {object} options
 * @param {string} [options.prefix] 组件名前缀
 * @param {string[]} [options.exactNames] 精确匹配（按顺序优先）
 * @param {string[]} [options.packageNames] 整包组件名（按顺序优先）
 * @param {(name: string) => boolean} [options.predicate]
 * @returns {string|undefined}
 */
export function findViewComponentName(viewList, options = {}) {
  const list = Array.isArray(viewList) ? viewList : []
  const names = list.filter((c) => typeof c === 'string' && c !== '')

  if (Array.isArray(options.packageNames)) {
    for (const pkg of options.packageNames) {
      if (names.includes(pkg)) return pkg
    }
  }

  if (Array.isArray(options.exactNames)) {
    for (const exact of options.exactNames) {
      if (names.includes(exact)) return exact
    }
  }

  if (options.prefix) {
    const hit = names.find((c) => c.startsWith(options.prefix))
    if (hit) return hit
  }

  if (typeof options.predicate === 'function') {
    return names.find(options.predicate)
  }

  return undefined
}

/**
 * @param {string[]} viewList
 * @param {object} spec
 * @param {string[]} [spec.packageNames] 整包 component 名
 * @param {string} [spec.listPrefix] 列表 component 前缀
 * @param {(name: string) => Promise<{ default?: unknown }>} spec.importPackage
 * @param {(name: string) => Promise<{ default?: unknown }>} spec.importList
 * @param {() => Promise<{ default?: unknown }>} spec.importDefault
 * @param {string} [spec.logLabel] 加载失败日志前缀
 * @returns {Promise<{ component: unknown, mode: 'package'|'list'|'default', name: string|null }>}
 */
export async function loadNamespaceViewModule(viewList, spec) {
  const {
    packageNames = [],
    listPrefix,
    importPackage,
    importList,
    importDefault,
    logLabel = '视图',
  } = spec

  for (const pkg of packageNames) {
    if (typeof importPackage !== 'function') continue
    const hit = findViewComponentName(viewList, { packageNames: [pkg] })
    if (!hit) continue
    try {
      const mod = await importPackage(hit)
      if (mod?.default) {
        return { component: mod.default, mode: 'package', name: hit }
      }
    } catch (e) {
      console.error(`加载${logLabel}整包 ${hit} 失败:`, e)
    }
  }

  if (listPrefix && importList) {
    const listName = findViewComponentName(viewList, { prefix: listPrefix })
    if (listName) {
      try {
        const mod = await importList(listName)
        if (mod?.default) {
          return { component: mod.default, mode: 'list', name: listName }
        }
      } catch (e) {
        console.error(`加载${logLabel}列表 ${listName} 失败:`, e)
      }
    }
  }

  const fallback = await importDefault()
  return {
    component: fallback?.default ?? fallback,
    mode: 'default',
    name: null,
  }
}
