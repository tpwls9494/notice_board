import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { postsAPI, filesAPI } from '../../services/api'
import useCategoriesStore from '../../stores/categoriesStore'
import useAuthStore from '../../stores/authStore'
import {
  extractPlainTextFromRichContent,
  normalizeStoredContentForEditor,
  sanitizeRichHtml,
} from '../../utils/richContent'

const NOTICE_CATEGORY_SLUG = 'notice'
const IMAGE_MIME_PREFIX = 'image/'
const MAX_FILE_SIZE = 10 * 1024 * 1024
const IMAGE_RESIZE_MIN_WIDTH = 140

const ALLOWED_UPLOAD_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt',
])

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const EXTENSION_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
}

const isImageMimeType = (mimeType = '') => mimeType.startsWith(IMAGE_MIME_PREFIX)

const getFileExtension = (filename = '') => {
  const lastDotIndex = filename.lastIndexOf('.')
  if (lastDotIndex < 0) return ''
  return filename.slice(lastDotIndex).toLowerCase()
}

const isAllowedUploadFile = (file) => {
  if (!file) return false
  if (ALLOWED_UPLOAD_TYPES.includes(file.type)) return true
  return ALLOWED_UPLOAD_EXTENSIONS.has(getFileExtension(file.name))
}

const isImageFile = (file) => {
  if (!file) return false
  if (isImageMimeType(file.type)) return true
  return IMAGE_EXTENSIONS.has(getFileExtension(file.name))
}

const normalizeFileForUpload = (file) => {
  if (!file) return file
  if (file.type && file.type !== 'application/octet-stream') return file

  const extension = getFileExtension(file.name)
  const normalizedMimeType = EXTENSION_TO_MIME[extension]
  if (!normalizedMimeType) return file

  try {
    return new File([file], file.name, {
      type: normalizedMimeType,
      lastModified: file.lastModified,
    })
  } catch (_error) {
    return file
  }
}

const escapeHtml = (value = '') => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
)

const createUploadToken = () => (
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
)

const replaceUploadPlaceholders = (baseContent, replacements) => (
  replacements.reduce(
    (contentText, replacement) => contentText.split(replacement.placeholder).join(replacement.url),
    baseContent,
  )
)

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Failed to read file as data URL'))
  reader.readAsDataURL(file)
})

const getPreferredImageMimeType = (file) => {
  if (!file) return ''

  if (isImageMimeType(file.type)) {
    return file.type.toLowerCase()
  }

  const extensionMimeType = EXTENSION_TO_MIME[getFileExtension(file.name)]
  if (extensionMimeType && isImageMimeType(extensionMimeType)) {
    return extensionMimeType
  }

  return ''
}

const coerceImageDataUrlMimeType = (rawDataUrl, preferredMimeType) => {
  const dataUrl = String(rawDataUrl || '')
  if (!dataUrl.startsWith('data:') || !preferredMimeType) return dataUrl

  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex < 0) return dataUrl

  const metadata = dataUrl.slice(5, commaIndex).toLowerCase()
  if (metadata.startsWith('image/')) {
    return dataUrl
  }

  const payload = dataUrl.slice(commaIndex + 1)
  const isBase64 = metadata.includes(';base64')

  return `data:${preferredMimeType}${isBase64 ? ';base64' : ''},${payload}`
}

const readImagePreviewSource = async (file) => {
  if (!file) return ''

  const preferredMimeType = getPreferredImageMimeType(file)
  let previewSourceFile = file

  if (preferredMimeType && !isImageMimeType(file.type)) {
    try {
      previewSourceFile = new Blob([file], { type: preferredMimeType })
    } catch (_blobError) {
      previewSourceFile = file
    }
  }

  const rawDataUrl = await readFileAsDataUrl(previewSourceFile)
  return coerceImageDataUrlMimeType(rawDataUrl, preferredMimeType)
}

function PostForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = Boolean(id)
  const postId = Number(id)

  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [uploadProgress, setUploadProgress] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [pendingInlineUploads, setPendingInlineUploads] = useState([])
  const [editorHtmlSnapshot, setEditorHtmlSnapshot] = useState('<p><br></p>')

  const editorRef = useRef(null)
  const pendingInlineUploadsRef = useRef([])
  const resizeSessionRef = useRef(null)

  const { categories, fetchCategories } = useCategoriesStore()
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const { data: postData } = useQuery({
    queryKey: ['post', id],
    queryFn: () => postsAPI.getPost(id),
    enabled: isEdit,
  })

  useEffect(() => {
    pendingInlineUploadsRef.current = pendingInlineUploads
  }, [pendingInlineUploads])

  useEffect(() => () => {
    const session = resizeSessionRef.current
    if (session) {
      document.removeEventListener('mousemove', session.onMouseMove)
      document.removeEventListener('mouseup', session.onMouseUp)
      resizeSessionRef.current = null
    }
    pendingInlineUploadsRef.current = []
  }, [])

  const selectableCategories = categories.filter(
    (category) => user?.is_admin || category.slug !== NOTICE_CATEGORY_SLUG,
  )

  const createMutation = useMutation({
    mutationFn: (data) => postsAPI.createPost(data),
  })

  const updateMutation = useMutation({
    mutationFn: (data) => postsAPI.updatePost(id, data),
  })

  const invalidateCommunityCaches = async () => {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['community'] }),
      queryClient.invalidateQueries({ queryKey: ['posts'] }),
    ])
  }

  const clearPendingInlineUploads = () => {
    pendingInlineUploadsRef.current = []
    setPendingInlineUploads([])
  }

  const setEditorHtml = (nextHtml) => {
    const editor = editorRef.current
    if (!editor) return
    editor.innerHTML = nextHtml
    setEditorHtmlSnapshot(nextHtml)
  }

  useEffect(() => {
    if (!editorRef.current) return

    if (postData?.data) {
      setTitle(postData.data.title || '')
      setCategoryId(String(postData.data.category_id || ''))
      setEditorHtml(normalizeStoredContentForEditor(postData.data.content || ''))
      clearPendingInlineUploads()
      return
    }

    if (!isEdit) {
      setEditorHtml('<p><br></p>')
    }
  }, [postData, isEdit])

  const ensureEditorRange = () => {
    const editor = editorRef.current
    if (!editor) return null

    editor.focus()
    const selection = window.getSelection()
    if (!selection) return null

    if (selection.rangeCount === 0) {
      const fallbackRange = document.createRange()
      fallbackRange.selectNodeContents(editor)
      fallbackRange.collapse(false)
      selection.addRange(fallbackRange)
      return fallbackRange
    }

    const activeRange = selection.getRangeAt(0)
    if (editor.contains(activeRange.commonAncestorContainer)) {
      return activeRange
    }

    const fallbackRange = document.createRange()
    fallbackRange.selectNodeContents(editor)
    fallbackRange.collapse(false)
    selection.removeAllRanges()
    selection.addRange(fallbackRange)
    return fallbackRange
  }

  const insertHtmlAtCursor = (htmlSnippet) => {
    const editor = editorRef.current
    if (!editor) return

    const range = ensureEditorRange()
    if (!range) return

    const fragment = range.createContextualFragment(htmlSnippet)
    const nodes = Array.from(fragment.childNodes)
    if (nodes.length === 0) return

    const lastNode = nodes[nodes.length - 1]
    range.deleteContents()
    range.insertNode(fragment)

    const selection = window.getSelection()
    if (selection && lastNode) {
      const nextRange = document.createRange()
      nextRange.setStartAfter(lastNode)
      nextRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(nextRange)
    }

    setEditorHtmlSnapshot(editor.innerHTML)
  }

  const hasFileDragPayload = (event) => {
    const types = Array.from(event.dataTransfer?.types || [])
    return types.includes('Files')
  }

  const sanitizeEditorSnapshotForUpload = () => {
    const rawHtml = editorRef.current?.innerHTML || ''

    return sanitizeRichHtml(rawHtml, {
      allowTemporaryUrls: true,
      keepUploadPlaceholders: true,
    })
  }

  const serializeContentWithPlaceholders = () => {
    const sanitizedSnapshot = sanitizeEditorSnapshotForUpload()
    const parser = new DOMParser()
    const documentNode = parser.parseFromString(sanitizedSnapshot, 'text/html')
    const body = documentNode.body

    Array.from(body.querySelectorAll('.editor-image-resize-handle')).forEach((handleElement) => {
      handleElement.remove()
    })

    Array.from(body.querySelectorAll('[data-upload-placeholder]')).forEach((element) => {
      const placeholder = element.getAttribute('data-upload-placeholder')
      if (!placeholder) return

      if (element.tagName.toLowerCase() === 'img') {
        element.setAttribute('src', placeholder)
      }

      if (element.tagName.toLowerCase() === 'a') {
        element.setAttribute('href', placeholder)
      }
    })

    return body.innerHTML || '<p><br></p>'
  }

  const handleInsertFiles = async (incomingFiles) => {
    const files = Array.from(incomingFiles || [])
    if (files.length === 0) return

    const validFiles = []
    const rejectedFiles = []

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        rejectedFiles.push(`${file.name} (10MB 초과)`)
        continue
      }

      if (!isAllowedUploadFile(file)) {
        rejectedFiles.push(`${file.name} (지원되지 않는 형식)`)
        continue
      }

      validFiles.push(file)
    }

    if (rejectedFiles.length > 0) {
      toast.warning(`일부 파일은 삽입되지 않았습니다: ${rejectedFiles.join(', ')}`)
    }

    if (validFiles.length === 0) return

    const uploads = []
    for (const file of validFiles) {
      const normalizedFile = normalizeFileForUpload(file)
      const token = createUploadToken()
      const placeholder = `upload://${token}`
      const escapedName = escapeHtml(file.name)
      const isImage = isImageFile(normalizedFile)
      let previewSrc = ''

      if (isImage) {
        try {
          previewSrc = await readImagePreviewSource(normalizedFile)
        } catch (_previewError) {
          previewSrc = ''
        }
      }

      uploads.push({
        token,
        placeholder,
        file: normalizedFile,
        originalFilename: file.name,
        isImage,
      })

      if (isImage) {
        if (!previewSrc) {
          insertHtmlAtCursor(`<p>[이미지 미리보기를 불러오지 못했습니다: ${escapedName}]</p>`)
          continue
        }

        const imageId = `img-${token}`
        insertHtmlAtCursor(
          `<figure data-editor-image="true" data-image-id="${imageId}" class="editor-image-frame">
            <img src="${previewSrc}" alt="${escapedName}" data-upload-token="${token}" data-upload-placeholder="${placeholder}" />
            <span class="editor-image-resize-handle" contenteditable="false" aria-hidden="true"></span>
            <figcaption contenteditable="false">${escapedName}</figcaption>
          </figure><p><br></p>`,
        )
      } else {
        insertHtmlAtCursor(
          `<p><a href="${placeholder}" data-upload-token="${token}" data-upload-placeholder="${placeholder}" target="_blank" rel="noopener noreferrer">${escapedName}</a></p>`,
        )
      }
    }

    pendingInlineUploadsRef.current = [...pendingInlineUploadsRef.current, ...uploads]
    setPendingInlineUploads((previous) => [...previous, ...uploads])
  }

  const handleEditorDragEnter = (event) => {
    if (!hasFileDragPayload(event)) return
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleEditorDragOver = (event) => {
    if (!hasFileDragPayload(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    if (!isDragOver) {
      setIsDragOver(true)
    }
  }

  const handleEditorDragLeave = (event) => {
    if (!hasFileDragPayload(event)) return
    event.preventDefault()

    const editor = editorRef.current
    if (!editor) {
      setIsDragOver(false)
      return
    }

    if (event.relatedTarget && editor.contains(event.relatedTarget)) {
      return
    }

    setIsDragOver(false)
  }

  const handleEditorDrop = (event) => {
    if (!hasFileDragPayload(event)) return
    event.preventDefault()
    setIsDragOver(false)
    void handleInsertFiles(event.dataTransfer?.files || [])
  }

  const handleEditorPaste = (event) => {
    const items = Array.from(event.clipboardData?.items || [])
    const files = items
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter(Boolean)

    if (files.length === 0) return

    event.preventDefault()
    void handleInsertFiles(files)
  }

  const handleEditorInput = () => {
    const editor = editorRef.current
    if (editor) {
      setEditorHtmlSnapshot(editor.innerHTML)
    }
  }

  const stopImageResizeSession = () => {
    const session = resizeSessionRef.current
    if (!session) return

    document.removeEventListener('mousemove', session.onMouseMove)
    document.removeEventListener('mouseup', session.onMouseUp)
    resizeSessionRef.current = null

    if (editorRef.current) {
      setEditorHtmlSnapshot(editorRef.current.innerHTML)
    }
  }

  const handleEditorMouseDown = (event) => {
    const handleElement = event.target?.closest?.('.editor-image-resize-handle')
    if (!handleElement) return

    const frame = handleElement.closest('figure[data-editor-image="true"]')
    const imageElement = frame?.querySelector('img')
    const editor = editorRef.current
    if (!frame || !imageElement || !editor) return

    event.preventDefault()
    event.stopPropagation()

    if (resizeSessionRef.current) {
      stopImageResizeSession()
    }

    const frameRect = frame.getBoundingClientRect()
    const editorRect = editor.getBoundingClientRect()
    const editorHorizontalPadding = 32
    const maxWidth = Math.max(
      IMAGE_RESIZE_MIN_WIDTH,
      Math.floor(editorRect.width - editorHorizontalPadding),
    )
    const startWidth = Math.max(IMAGE_RESIZE_MIN_WIDTH, Math.round(frameRect.width))
    const startX = event.clientX

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault()
      const deltaX = moveEvent.clientX - startX
      const nextWidth = Math.max(
        IMAGE_RESIZE_MIN_WIDTH,
        Math.min(maxWidth, Math.round(startWidth + deltaX)),
      )

      frame.style.width = `${nextWidth}px`
      frame.style.maxWidth = '100%'
      imageElement.style.width = '100%'
      imageElement.style.maxWidth = '100%'
      imageElement.style.height = 'auto'
    }

    const onMouseUp = () => {
      stopImageResizeSession()
    }

    resizeSessionRef.current = { onMouseMove, onMouseUp }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const hasMeaningfulContent = (htmlText) => {
    const plainText = extractPlainTextFromRichContent(htmlText).trim()
    if (plainText) return true

    const parser = new DOMParser()
    const parsed = parser.parseFromString(htmlText, 'text/html')
    return Boolean(parsed.body.querySelector('img, a[href], figure[data-editor-image="true"]'))
  }

  const removeFailedUploadNodes = (htmlText, failedUploads) => {
    if (failedUploads.length === 0) return htmlText

    const parser = new DOMParser()
    const parsed = parser.parseFromString(htmlText, 'text/html')
    const body = parsed.body

    failedUploads.forEach((upload) => {
      Array.from(body.querySelectorAll('img')).forEach((imageElement) => {
        if ((imageElement.getAttribute('src') || '') !== upload.placeholder) return
        const frame = imageElement.closest('[data-editor-image="true"]')
        if (frame) {
          frame.remove()
        } else {
          imageElement.remove()
        }
      })

      Array.from(body.querySelectorAll('a')).forEach((linkElement) => {
        if ((linkElement.getAttribute('href') || '') !== upload.placeholder) return
        const fallbackText = parsed.createTextNode(`[업로드 실패: ${upload.originalFilename}]`)
        linkElement.replaceWith(fallbackText)
      })
    })

    return body.innerHTML
  }

  const uploadInlineFiles = async (targetPostId, contentWithPlaceholders) => {
    const targets = pendingInlineUploadsRef.current.filter((upload) => (
      contentWithPlaceholders.includes(upload.placeholder)
    ))

    if (targets.length === 0) {
      return {
        resolvedContent: sanitizeRichHtml(contentWithPlaceholders),
        uploadedCount: 0,
        failedUploads: [],
      }
    }

    const replacements = []
    const failedUploads = []

    for (const upload of targets) {
      try {
        const response = await filesAPI.uploadFile(targetPostId, upload.file)
        const uploadedFile = response?.data

        if (!uploadedFile?.id) {
          failedUploads.push(upload)
          continue
        }

        replacements.push({
          placeholder: upload.placeholder,
          url: filesAPI.downloadFile(uploadedFile.id),
        })
      } catch (_error) {
        failedUploads.push(upload)
      }
    }

    let resolvedContent = replaceUploadPlaceholders(contentWithPlaceholders, replacements)
    resolvedContent = removeFailedUploadNodes(resolvedContent, failedUploads)
    resolvedContent = sanitizeRichHtml(resolvedContent)

    return {
      resolvedContent,
      uploadedCount: replacements.length,
      failedUploads,
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const trimmedTitle = title.trim()
    const serializedContent = serializeContentWithPlaceholders()

    if (!trimmedTitle || !hasMeaningfulContent(serializedContent)) {
      toast.error('제목과 내용을 모두 입력해주세요.')
      return
    }

    if (!categoryId) {
      toast.error('커뮤니티를 선택해주세요.')
      return
    }

    const data = {
      title: trimmedTitle,
      content: serializedContent,
      category_id: parseInt(categoryId, 10),
    }

    setUploadProgress(true)

    try {
      if (isEdit) {
        const { resolvedContent, uploadedCount, failedUploads } = await uploadInlineFiles(postId, serializedContent)
        const normalizedContent = resolvedContent.trim() || serializedContent

        await updateMutation.mutateAsync({
          ...data,
          content: normalizedContent,
        })

        await invalidateCommunityCaches()

        if (failedUploads.length > 0) {
          toast.warning(`일부 파일 업로드에 실패했습니다: ${failedUploads.map((item) => item.originalFilename).join(', ')}`)
        }

        toast.success(
          uploadedCount > 0
            ? `게시글이 수정되었습니다. (인라인 파일 ${uploadedCount}개 반영)`
            : '게시글이 수정되었습니다.',
        )

        clearPendingInlineUploads()
        navigate(`/posts/${id}`)
        return
      }

      const response = await createMutation.mutateAsync(data)
      const createdPostId = response.data.id

      const { resolvedContent, uploadedCount, failedUploads } = await uploadInlineFiles(createdPostId, serializedContent)
      const normalizedContent = resolvedContent.trim() || serializedContent

      if (normalizedContent !== serializedContent) {
        await postsAPI.updatePost(createdPostId, { content: normalizedContent })
      }

      await invalidateCommunityCaches()

      if (failedUploads.length > 0) {
        toast.warning(`일부 파일 업로드에 실패했습니다: ${failedUploads.map((item) => item.originalFilename).join(', ')}`)
      }

      toast.success(
        uploadedCount > 0
          ? `게시글이 작성되었습니다. (인라인 파일 ${uploadedCount}개 반영)`
          : '게시글이 작성되었습니다.',
      )

      clearPendingInlineUploads()
      navigate(`/posts/${createdPostId}`)
    } catch (error) {
      toast.error(
        error.response?.data?.detail
          || (isEdit ? '게시글 수정에 실패했습니다.' : '게시글 작성에 실패했습니다.'),
      )
    } finally {
      setUploadProgress(false)
    }
  }

  const isLoading = createMutation.isLoading || updateMutation.isLoading
  const activeInlineUploadCount = pendingInlineUploads.filter(
    (upload) => editorHtmlSnapshot.includes(upload.placeholder),
  ).length

  return (
    <div className="max-w-4xl mx-auto animate-fade-up">
      <Link
        to={isEdit ? `/posts/${id}` : '/community'}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 mb-6 group"
        style={{ transition: 'color 0.2s ease-out' }}
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true" style={{ transition: 'transform 0.2s ease-out' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {isEdit ? '게시글로 돌아가기' : '목록으로'}
      </Link>

      <div className="card overflow-hidden">
        <div className="px-6 sm:px-8 py-5 border-b border-ink-100">
          <h1 className="font-display text-xl font-bold text-ink-950 tracking-tight text-balance">
            {isEdit ? '게시글 수정' : '새 게시글 작성'}
          </h1>
          <p className="text-sm text-ink-400 mt-1">
            {isEdit ? '내용을 수정하고 저장하세요' : '드래그앤드롭으로 이미지와 파일을 본문에 바로 삽입할 수 있습니다.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          <div>
            <label htmlFor="category" className="block text-sm font-semibold text-ink-700 mb-2">
              커뮤니티 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="input-field h-[52px] pr-12 appearance-none"
                required
              >
                <option value="">커뮤니티를 선택하세요</option>
                {selectableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-ink-500">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-semibold text-ink-700 mb-2">
              제목
            </label>
            <input
              id="title"
              type="text"
              autoComplete="off"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요&#x2026;"
              className="input-field h-[52px] text-lg font-medium"
              required
            />
          </div>

          <div>
            <label htmlFor="rich-editor" className="block text-sm font-semibold text-ink-700 mb-2">
              내용
            </label>

            <div
              id="rich-editor"
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className={`rich-editor ${isDragOver ? 'is-drag-over' : ''}`}
              onMouseDown={handleEditorMouseDown}
              onInput={handleEditorInput}
              onPaste={handleEditorPaste}
              onDragEnter={handleEditorDragEnter}
              onDragOver={handleEditorDragOver}
              onDragLeave={handleEditorDragLeave}
              onDrop={handleEditorDrop}
            />

            <p className="mt-2 text-xs text-ink-400">
              이미지는 드래그/붙여넣기하면 바로 보이며, 우측 하단 핸들을 드래그하면 비율을 유지한 채 크기만 조절됩니다.
            </p>

            {activeInlineUploadCount > 0 && (
              <p className="mt-1 text-xs text-ink-500">
                업로드 대기 중인 인라인 파일: {activeInlineUploadCount}개
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-ink-100">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-secondary"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading || uploadProgress}
              className="btn-accent"
            >
              {(isLoading || uploadProgress)
                ? '저장 중\u2026'
                : (isEdit ? '수정 완료' : '작성 완료')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PostForm
