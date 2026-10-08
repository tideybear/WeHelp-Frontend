/** 侧栏项目状态标签（与列表 status 一致：未开始 / 进行中 / 已结束） */
export function projectStatusTagType(status) {
  if (status === '进行中') return 'success'
  if (status === '未开始') return 'warning'
  if (status === '已结束') return 'info'
  return 'info'
}
