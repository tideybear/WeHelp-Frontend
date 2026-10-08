/** CSV 单元格转义 */
export function escapeCsvCell(val) {
  if (val == null) return ''
  const s = String(val)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * @param {string[]} headerLabels 表头（列 label）
 * @param {string[][]} dataRows 与表头顺序一致的数据行
 */
export function buildCsvContent(headerLabels, dataRows) {
  const lines = [headerLabels.map(escapeCsvCell).join(',')]
  for (const row of dataRows) {
    lines.push((row || []).map(escapeCsvCell).join(','))
  }
  return lines.join('\r\n')
}

/** 触发浏览器下载（UTF-8 BOM，便于 Excel 打开中文） */
export function downloadCsvFile(filename, csvContent) {
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
