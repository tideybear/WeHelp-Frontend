import { ElMessage } from 'element-plus'

export function useCopyToClipboard() {
  /**
   * 复制文本到剪贴板
   * @param {String|Number} text - 要复制的文本
   */
  const copyToClipboard = async (text) => {
    if (text === null || text === undefined) {
      text = ''
    }
    const textStr = String(text)
    try {
      if (navigator.clipboard && window.isSecureContext) {
        // 使用现代 Clipboard API
        await navigator.clipboard.writeText(textStr)
        ElMessage.success('已复制到剪贴板')
      } else {
        // 降级方案：使用传统方法
        const textArea = document.createElement('textarea')
        textArea.value = textStr
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        try {
          document.execCommand('copy')
          ElMessage.success('已复制到剪贴板')
        } catch (err) {
          ElMessage.error('复制失败')
        }
        document.body.removeChild(textArea)
      }
    } catch (err) {
      ElMessage.error('复制失败')
      console.error('复制失败:', err)
    }
  }

  return {
    copyToClipboard
  }
}
