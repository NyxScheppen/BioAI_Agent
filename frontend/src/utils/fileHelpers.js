export const normalizeToAbsoluteFileUrl = (url, apiBase) => {
  if (!url) return ''

  let finalUrl = String(url).trim()

  if (!finalUrl) return ''

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

  const str = String(url).split('?')[0]

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

const normalizeFilename = (value) => {
  if (!value) return ''
  return String(value).split('?')[0].split('/').pop() || ''
}

export const getCanonicalResultKey = (item, apiBase = '') => {
  if (!item) return ''

  const relativePath =
    item.relativePath ||
    item.relative_path ||
    getRelativePathFromUrl(item.rawUrl || item.content || item.url || '', apiBase)

  if (relativePath) {
    return `path:${String(relativePath).split('?')[0].replace(/^\/+/, '')}`
  }

  const raw = item.rawUrl || item.content || item.url || ''
  if (raw) {
    return `url:${String(raw).split('?')[0]}`
  }

  const filename = normalizeFilename(item.filename || item.name || item.title)
  if (filename) {
    return `name:${filename}`
  }

  return ''
}

export const guessResultType = (file) => {
  if (!file) return 'file'
  if (file.type === 'image') return 'plot'
  return 'file'
}

export const buildResultFromFile = (file, apiBase) => {
  const relativePath = file.relative_path || file.relativePath || ''
  const absoluteUrl = normalizeToAbsoluteFileUrl(
    file.url || relativePath || file.name || file.filename,
    apiBase
  )
  const filename = file.filename || file.name || normalizeFilename(relativePath) || 'download'
  const resultType = guessResultType(file)

  return {
    id: `${relativePath || filename}_${Date.now()}_${Math.random()}`,
    type: resultType,
    fileType: file.type || 'other',
    title: resultType === 'plot' ? '📊 分析图表' : `📄 ${filename}`,
    content: resultType === 'plot' ? `${absoluteUrl}?t=${Date.now()}` : absoluteUrl,
    rawUrl: absoluteUrl,
    filename,
    relativePath,
    sourceType: file.source_type || 'generated'
  }
}

export const mergeSessionResults = (session, incomingResults, apiBase = '') => {
  const prevResults = session.results || []
  const allResults = [...(incomingResults || []), ...prevResults]
  const resultMap = new Map()

  allResults.forEach((item) => {
    const key = getCanonicalResultKey(item, apiBase)

    if (!key) {
      resultMap.set(`fallback:${item.id || Math.random()}`, item)
      return
    }

    const existing = resultMap.get(key)

    if (!existing) {
      resultMap.set(key, item)
      return
    }

    const existingHasPath =
      existing.relativePath ||
      existing.relative_path ||
      getRelativePathFromUrl(existing.rawUrl || existing.content || existing.url || '', apiBase)

    const currentHasPath =
      item.relativePath ||
      item.relative_path ||
      getRelativePathFromUrl(item.rawUrl || item.content || item.url || '', apiBase)

    const existingIsBackend = existing.sourceType === 'generated' && !!existingHasPath
    const currentIsBackend = item.sourceType === 'generated' && !!currentHasPath

    if (!existingIsBackend && currentIsBackend) {
      resultMap.set(key, item)
    }
  })

  return Array.from(resultMap.values())
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