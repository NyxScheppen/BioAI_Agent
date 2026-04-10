export const normalizeToAbsoluteFileUrl = (url, apiBase) => {
  if (!url) return ''

  let finalUrl = String(url).trim()

  if (finalUrl.startsWith('http://') || finalUrl.startsWith('https://')) {
    return finalUrl.replace('/workspace/', '/files/')
  }

  if (finalUrl.startsWith('/files/')) {
    return `${apiBase}${finalUrl}`
  }

  if (finalUrl.startsWith('generated/')) {
    return `${apiBase}/files/${finalUrl}`
  }

  if (finalUrl.startsWith('uploads/')) {
    return `${apiBase}/files/${finalUrl}`
  }

  if (finalUrl.startsWith('files/')) {
    return `${apiBase}/${finalUrl}`
  }

  finalUrl = finalUrl.replace(/^\/+/, '')
  return `${apiBase}/files/${finalUrl}`
}

export const getRelativePathFromUrl = (url, apiBase) => {
  if (!url) return ''

  const str = String(url)

  if (str.startsWith('/files/')) {
    return str.replace('/files/', '')
  }

  if (str.startsWith(`${apiBase}/files/`)) {
    return str.replace(`${apiBase}/files/`, '')
  }

  if (str.startsWith('generated/') || str.startsWith('uploads/')) {
    return str
  }

  return str.replace(/^\/+/, '')
}

export const guessResultType = (file) => {
  if (!file) return 'file'
  if (file.type === 'image') return 'plot'
  return 'file'
}

export const buildResultFromFile = (file, apiBase) => {
  const absoluteUrl = normalizeToAbsoluteFileUrl(file.url || file.relative_path || file.name, apiBase)

  return {
    id: `${file.relative_path || file.name}_${Date.now()}_${Math.random()}`,
    type: guessResultType(file),
    fileType: file.type || 'other',
    title: file.type === 'image' ? '📊 分析图表' : `📄 ${file.name || file.filename}`,
    content: file.type === 'image' ? `${absoluteUrl}?t=${Date.now()}` : absoluteUrl,
    rawUrl: absoluteUrl,
    filename: file.name || file.filename || 'download',
    relativePath: file.relative_path || '',
    sourceType: file.source_type || 'generated'
  }
}

export const mergeSessionResults = (session, incomingResults) => {
  const prevResults = session.results || []

  const existingKeys = new Set(
    prevResults.map((item) =>
      item.type === 'plot'
        ? `${item.filename || ''}|${(item.content || '').split('?')[0]}`
        : `${item.filename || ''}|${item.rawUrl || item.content || ''}`
    )
  )

  const uniqueNew = incomingResults.filter((item) => {
    const key =
      item.type === 'plot'
        ? `${item.filename || ''}|${(item.content || '').split('?')[0]}`
        : `${item.filename || ''}|${item.rawUrl || item.content || ''}`
    if (existingKeys.has(key)) return false
    existingKeys.add(key)
    return true
  })

  return [...uniqueNew, ...prevResults]
}

export const isFileAlreadyAttached = (session, targetFile) => {
  const attached = session?.attachedFiles || []
  return attached.some((f) => {
    const a = f.relative_path || f.relativePath || f.url || f.filename
    const b =
      targetFile.relative_path ||
      targetFile.relativePath ||
      targetFile.url ||
      targetFile.filename
    return a === b
  })
}