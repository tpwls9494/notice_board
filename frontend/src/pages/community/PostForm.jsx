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
const IMAGE_RESIZE_EDGE_HITBOX = 14
const IMAGE_MOVE_POINTER_THRESHOLD = 4

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
  const resizeHoverImageRef = useRef(null)
  const selectedImageRef = useRef(null)
  const imageMoveSessionRef = useRef(null)

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
    const hoverImage = resizeHoverImageRef.current
    if (hoverImage) {
      hoverImage.classList.remove('is-resize-ready')
      resizeHoverImageRef.current = null
    }
    const selectedImage = selectedImageRef.current
    if (selectedImage) {
      selectedImage.classList.remove('is-selected')
      selectedImageRef.current = null
    }
    const moveSession = imageMoveSessionRef.current
    if (moveSession) {
      document.removeEventListener('pointermove', moveSession.onPointerMove)
      document.removeEventListener('pointerup', moveSession.onPointerUp)
      document.removeEventListener('pointercancel', moveSession.onPointerCancel)
      moveSession.imageElement.classList.remove('is-dragging')
      imageMoveSessionRef.current = null
    }
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    if (editorRef.current) {
      editorRef.current.style.cursor = ''
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

  const normalizeEditorImageNodes = () => {
    const editor = editorRef.current
    if (!editor) return

    Array.from(editor.querySelectorAll('img, figure[data-editor-image="true"] img')).forEach((imageElement) => {
      imageElement.setAttribute('data-editor-image', 'true')
      imageElement.setAttribute('draggable', 'false')
    })
  }

  const setEditorHtml = (nextHtml) => {
    const editor = editorRef.current
    if (!editor) return
    editor.innerHTML = nextHtml
    normalizeEditorImageNodes()
    setEditorHtmlSnapshot(editor.innerHTML)
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

    normalizeEditorImageNodes()
    setEditorHtmlSnapshot(editor.innerHTML)
  }

  const hasFileDragPayload = (event, { requireFiles = false } = {}) => {
    const transfer = event?.dataTransfer
    if (!transfer) return false

    if (requireFiles) {
      return Boolean(transfer.files && transfer.files.length > 0)
    }

    const types = Array.from(transfer.types || [])
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

    Array.from(body.querySelectorAll('[data-editor-image="true"], figure[data-editor-image="true"] img')).forEach((element) => {
      element.classList.remove('is-resize-ready')
      element.classList.remove('is-selected')
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

        insertHtmlAtCursor(
          `<img data-editor-image="true" draggable="false" src="${previewSrc}" alt="" data-upload-token="${token}" data-upload-placeholder="${placeholder}" />`,
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
    event.dataTransfer.dropEffect = 'copy'
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
    const hasFilePayload = hasFileDragPayload(event, { requireFiles: true })
    if (!hasFilePayload) return

    event.preventDefault()
    event.stopPropagation()
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
      normalizeEditorImageNodes()
      setEditorHtmlSnapshot(editor.innerHTML)
    }
  }

  const clearSelectedImageFrame = () => {
    const selectedImage = selectedImageRef.current
    if (!selectedImage) return

    selectedImage.classList.remove('is-selected')
    selectedImageRef.current = null
  }

  const setSelectedImageFrame = (nextFrame) => {
    const normalizedNextFrame = nextFrame || null
    if (selectedImageRef.current === normalizedNextFrame) return

    clearSelectedImageFrame()

    if (normalizedNextFrame) {
      normalizedNextFrame.classList.add('is-selected')
      selectedImageRef.current = normalizedNextFrame
    }
  }

  const handleEditorKeyDown = (event) => {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return

    const editor = editorRef.current
    const selectedImage = selectedImageRef.current
    if (!editor || !selectedImage || !editor.contains(selectedImage)) return

    event.preventDefault()

    const previousSibling = selectedImage.previousSibling
    const nextSibling = selectedImage.nextSibling
    selectedImage.remove()
    clearSelectedImageFrame()

    if (!editor.innerHTML.trim()) {
      editor.innerHTML = '<p><br></p>'
    }

    const selection = window.getSelection()
    if (selection) {
      const range = document.createRange()
      if (nextSibling && editor.contains(nextSibling)) {
        range.setStartBefore(nextSibling)
      } else if (previousSibling && editor.contains(previousSibling)) {
        range.setStartAfter(previousSibling)
      } else {
        range.selectNodeContents(editor)
        range.collapse(false)
      }
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    setEditorHtmlSnapshot(editor.innerHTML)
  }

  const clearResizeHoverState = () => {
    const previousHoverImage = resizeHoverImageRef.current
    if (previousHoverImage) {
      previousHoverImage.classList.remove('is-resize-ready')
      resizeHoverImageRef.current = null
    }
    if (!resizeSessionRef.current && editorRef.current) {
      editorRef.current.style.cursor = ''
    }
  }

  const getResizeCursor = (mode) => {
    if (mode === 'vertical') return 'ns-resize'
    if (mode === 'corner') return 'nwse-resize'
    return 'ew-resize'
  }

  const getImageResizeMode = (event, imageElement) => {
    if (!event || !imageElement) return null

    const frameRect = imageElement.getBoundingClientRect()
    const isWithinVerticalBounds = (
      event.clientY >= frameRect.top - 2
      && event.clientY <= frameRect.bottom + 2
    )
    const isWithinHorizontalBounds = (
      event.clientX >= frameRect.left - 2
      && event.clientX <= frameRect.right + 2
    )

    const rightEdgeDistance = frameRect.right - event.clientX
    const bottomEdgeDistance = frameRect.bottom - event.clientY

    const isNearRightEdge = (
      isWithinVerticalBounds
      && rightEdgeDistance >= -2
      && rightEdgeDistance <= IMAGE_RESIZE_EDGE_HITBOX
    )
    const isNearBottomEdge = (
      isWithinHorizontalBounds
      && bottomEdgeDistance >= -2
      && bottomEdgeDistance <= IMAGE_RESIZE_EDGE_HITBOX
    )

    if (isNearRightEdge && isNearBottomEdge) return 'corner'
    if (isNearRightEdge) return 'horizontal'
    if (isNearBottomEdge) return 'vertical'
    return null
  }

  const findEditorImageElement = (target) => {
    if (!target || typeof target.closest !== 'function') return null
    const directImage = target.closest('img[data-editor-image="true"]')
    if (directImage) return directImage
    const legacyFrame = target.closest('figure[data-editor-image="true"]')
    return legacyFrame?.querySelector('img') || null
  }

  const getDropRangeFromPoint = (event, editor) => {
    if (!event || !editor) return null

    if (typeof document.caretRangeFromPoint === 'function') {
      const range = document.caretRangeFromPoint(event.clientX, event.clientY)
      if (range && editor.contains(range.commonAncestorContainer)) {
        return range
      }
    }

    if (typeof document.caretPositionFromPoint === 'function') {
      const position = document.caretPositionFromPoint(event.clientX, event.clientY)
      if (position && editor.contains(position.offsetNode)) {
        const range = document.createRange()
        range.setStart(position.offsetNode, position.offset)
        range.collapse(true)
        return range
      }
    }

    const selection = window.getSelection()
    if (selection?.rangeCount) {
      const currentRange = selection.getRangeAt(0).cloneRange()
      if (editor.contains(currentRange.commonAncestorContainer)) {
        return currentRange
      }
    }

    const fallbackRange = document.createRange()
    fallbackRange.selectNodeContents(editor)
    fallbackRange.collapse(false)
    return fallbackRange
  }

  const placeImageByPointerPosition = (imageElement, pointerEvent, editor) => {
    if (!imageElement || !pointerEvent || !editor) return false

    const targetElement = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)
    const targetImage = findEditorImageElement(targetElement)

    if (targetImage && targetImage !== imageElement) {
      const targetRect = targetImage.getBoundingClientRect()
      if (pointerEvent.clientY > targetRect.top + (targetRect.height / 2)) {
        targetImage.after(imageElement)
      } else {
        targetImage.before(imageElement)
      }
      return true
    }

    const dropRange = getDropRangeFromPoint(pointerEvent, editor)
    if (!dropRange || imageElement.contains(dropRange.startContainer)) return false

    dropRange.insertNode(imageElement)
    return true
  }

  const stopImageMoveSession = (applyDrop = false, pointerEvent = null) => {
    const session = imageMoveSessionRef.current
    if (!session) return

    document.removeEventListener('pointermove', session.onPointerMove)
    document.removeEventListener('pointerup', session.onPointerUp)
    document.removeEventListener('pointercancel', session.onPointerCancel)
    imageMoveSessionRef.current = null

    const editor = editorRef.current
    if (editor) {
      editor.style.cursor = ''
    }
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    const { imageElement, moved } = session
    imageElement.classList.remove('is-dragging')

    if (!applyDrop || !moved || !editor || !pointerEvent) return

    const didMove = placeImageByPointerPosition(imageElement, pointerEvent, editor)
    if (!didMove) return

    const selection = window.getSelection()
    if (selection) {
      const range = document.createRange()
      range.setStartAfter(imageElement)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    setEditorHtmlSnapshot(editor.innerHTML)
  }

  const handleEditorPointerDown = (event) => {
    if (event.button !== 0) return

    const editor = editorRef.current
    const imageElement = findEditorImageElement(event.target)
    if (!editor || !imageElement) return

    if (getImageResizeMode(event, imageElement)) return

    if (imageMoveSessionRef.current) {
      stopImageMoveSession(false)
    }

    const onPointerMove = (moveEvent) => {
      const session = imageMoveSessionRef.current
      if (!session || moveEvent.pointerId !== session.pointerId) return

      const distance = Math.hypot(
        moveEvent.clientX - session.startX,
        moveEvent.clientY - session.startY,
      )

      if (!session.moved) {
        if (distance < IMAGE_MOVE_POINTER_THRESHOLD) return
        session.moved = true
        session.imageElement.classList.add('is-dragging')
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'grabbing'
        editor.style.cursor = 'grabbing'
      }

      moveEvent.preventDefault()
    }

    const onPointerUp = (upEvent) => {
      const session = imageMoveSessionRef.current
      if (!session || upEvent.pointerId !== session.pointerId) return
      stopImageMoveSession(true, upEvent)
    }

    const onPointerCancel = (cancelEvent) => {
      const session = imageMoveSessionRef.current
      if (!session || cancelEvent.pointerId !== session.pointerId) return
      stopImageMoveSession(false)
    }

    imageMoveSessionRef.current = {
      pointerId: event.pointerId,
      imageElement,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerCancel)
  }

  const handleEditorMouseMove = (event) => {
    if (resizeSessionRef.current) return
    if (imageMoveSessionRef.current?.moved) return

    const editor = editorRef.current
    if (!editor) return

    const hoveredImage = findEditorImageElement(event.target)
    const resizeMode = hoveredImage ? getImageResizeMode(event, hoveredImage) : null
    const canResize = Boolean(hoveredImage && resizeMode)

    if (!canResize) {
      clearResizeHoverState()
      return
    }

    if (resizeHoverImageRef.current && resizeHoverImageRef.current !== hoveredImage) {
      resizeHoverImageRef.current.classList.remove('is-resize-ready')
    }

    resizeHoverImageRef.current = hoveredImage
    hoveredImage.classList.add('is-resize-ready')
    editor.style.cursor = getResizeCursor(resizeMode)
  }

  const handleEditorMouseLeave = () => {
    if (resizeSessionRef.current) return
    clearResizeHoverState()
  }

  const stopImageResizeSession = () => {
    const session = resizeSessionRef.current
    if (!session) return

    document.removeEventListener('mousemove', session.onMouseMove)
    document.removeEventListener('mouseup', session.onMouseUp)
    resizeSessionRef.current = null
    document.body.style.cursor = ''
    clearResizeHoverState()

    if (editorRef.current) {
      setEditorHtmlSnapshot(editorRef.current.innerHTML)
    }
  }

  const handleEditorMouseDown = (event) => {
    const imageElement = findEditorImageElement(event.target)
    const editor = editorRef.current
    const resizeMode = imageElement ? getImageResizeMode(event, imageElement) : null
    if (!editor) return

    if (!imageElement) {
      clearSelectedImageFrame()
      return
    }

    setSelectedImageFrame(imageElement)

    if (!imageElement || !resizeMode) return

    event.preventDefault()
    event.stopPropagation()

    if (resizeSessionRef.current) {
      stopImageResizeSession()
    }

    const imageRect = imageElement.getBoundingClientRect()
    const editorRect = editor.getBoundingClientRect()
    const editorHorizontalPadding = 32
    const maxWidth = Math.max(
      IMAGE_RESIZE_MIN_WIDTH,
      Math.floor(editorRect.width - editorHorizontalPadding),
    )

    const startHeight = Math.max(1, Math.round(imageRect.height))
    const startWidth = Math.max(IMAGE_RESIZE_MIN_WIDTH, Math.round(imageRect.width))
    const startX = event.clientX
    const startY = event.clientY
    const aspectRatio = Math.max(0.01, startWidth / startHeight)

    resizeHoverImageRef.current = imageElement
    imageElement.classList.add('is-resize-ready')
    const activeCursor = getResizeCursor(resizeMode)
    editor.style.cursor = activeCursor
    document.body.style.cursor = activeCursor

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault()
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      const widthFromHorizontal = startWidth + deltaX
      const widthFromVertical = (startHeight + deltaY) * aspectRatio

      let nextWidthCandidate = widthFromHorizontal
      if (resizeMode === 'vertical') {
        nextWidthCandidate = widthFromVertical
      } else if (resizeMode === 'corner') {
        const horizontalDeltaWidth = widthFromHorizontal - startWidth
        const verticalDeltaWidth = widthFromVertical - startWidth
        nextWidthCandidate = (
          Math.abs(horizontalDeltaWidth) >= Math.abs(verticalDeltaWidth)
            ? widthFromHorizontal
            : widthFromVertical
        )
      }

      const nextWidth = Math.max(
        IMAGE_RESIZE_MIN_WIDTH,
        Math.min(maxWidth, Math.round(nextWidthCandidate)),
      )

      imageElement.style.width = `${nextWidth}px`
      imageElement.style.maxWidth = '100%'
      imageElement.style.height = 'auto'
      imageElement.style.display = 'block'
    }

    const onMouseUp = () => {
      stopImageResizeSession()
    }

    resizeSessionRef.current = { onMouseMove, onMouseUp }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const handleEditorClick = (event) => {
    const imageElement = findEditorImageElement(event.target)
    const editor = editorRef.current
    if (!editor || !imageElement) return
    editor.focus()
  }

  const hasMeaningfulContent = (htmlText) => {
    const plainText = extractPlainTextFromRichContent(htmlText).trim()
    if (plainText) return true

    const parser = new DOMParser()
    const parsed = parser.parseFromString(htmlText, 'text/html')
    return Boolean(parsed.body.querySelector('img, a[href]'))
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
              onPointerDown={handleEditorPointerDown}
              onClick={handleEditorClick}
              onMouseMove={handleEditorMouseMove}
              onMouseLeave={handleEditorMouseLeave}
              onKeyDown={handleEditorKeyDown}
              onInput={handleEditorInput}
              onPaste={handleEditorPaste}
              onDragEnter={handleEditorDragEnter}
              onDragOver={handleEditorDragOver}
              onDragLeave={handleEditorDragLeave}
              onDrop={handleEditorDrop}
            />

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
