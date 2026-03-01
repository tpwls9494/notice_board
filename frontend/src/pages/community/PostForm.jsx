import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { postsAPI, filesAPI } from '../../services/api'
import useCategoriesStore from '../../stores/categoriesStore'
import useAuthStore from '../../stores/authStore'

const NOTICE_CATEGORY_SLUG = 'notice'
const IMAGE_MIME_PREFIX = 'image/'
const MAX_FILE_SIZE = 10 * 1024 * 1024

const ALLOWED_UPLOAD_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]

const INLINE_FILE_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt'

const isImageMimeType = (mimeType = '') => mimeType.startsWith(IMAGE_MIME_PREFIX)

const escapeMarkdownText = (value = '') => (
  value
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
)

const createUploadToken = () => (
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
)

const replaceUploadPlaceholders = (baseContent, replacements) => (
  replacements.reduce(
    (contentText, replacement) => contentText.split(replacement.placeholder).join(replacement.url),
    baseContent
  )
)

function PostForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = Boolean(id)
  const postId = Number(id)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [uploadProgress, setUploadProgress] = useState(false)
  const [pendingInlineUploads, setPendingInlineUploads] = useState([])

  const contentInputRef = useRef(null)
  const inlineFileInputRef = useRef(null)

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
    if (postData?.data) {
      setTitle(postData.data.title)
      setContent(postData.data.content)
      setCategoryId(postData.data.category_id || '')
      setPendingInlineUploads([])
    }
  }, [postData])

  const selectableCategories = categories.filter(
    (category) => user?.is_admin || category.slug !== NOTICE_CATEGORY_SLUG
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

  const insertAtCursor = (snippet) => {
    const textarea = contentInputRef.current

    setContent((previous) => {
      if (!textarea) {
        return `${previous}${snippet}`
      }

      const start = textarea.selectionStart ?? previous.length
      const end = textarea.selectionEnd ?? previous.length
      const next = `${previous.slice(0, start)}${snippet}${previous.slice(end)}`

      requestAnimationFrame(() => {
        textarea.focus()
        const cursor = start + snippet.length
        textarea.setSelectionRange(cursor, cursor)
      })

      return next
    })
  }

  const handleInsertLink = () => {
    insertAtCursor('[링크 텍스트](https://example.com)')
  }

  const handleInsertInlineFormula = () => {
    insertAtCursor('$E = mc^2$')
  }

  const handleInsertBlockFormula = () => {
    insertAtCursor('\n$$\n\\int_0^1 x^2\\,dx\n$$\n')
  }

  const handleOpenInlineFilePicker = () => {
    inlineFileInputRef.current?.click()
  }

  const handleInlineFileChange = (event) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const validFiles = []
    const rejectedFiles = []

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        rejectedFiles.push(`${file.name} (10MB 초과)`)
        continue
      }

      if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
        rejectedFiles.push(`${file.name} (지원되지 않는 형식)`)
        continue
      }

      validFiles.push(file)
    }

    if (rejectedFiles.length > 0) {
      toast.warning(`일부 파일은 삽입되지 않았습니다: ${rejectedFiles.join(', ')}`)
    }

    if (validFiles.length === 0) {
      event.target.value = ''
      return
    }

    const uploads = validFiles.map((file) => {
      const placeholder = `upload://${createUploadToken()}`
      const escapedName = escapeMarkdownText(file.name)
      const markdown = isImageMimeType(file.type)
        ? `![${escapedName}](${placeholder})`
        : `[${escapedName}](${placeholder})`

      return {
        file,
        placeholder,
        markdown,
        originalFilename: file.name,
      }
    })

    const snippet = uploads.map((upload) => upload.markdown).join('\n\n')
    insertAtCursor(`${snippet}\n`)
    setPendingInlineUploads((previous) => [...previous, ...uploads])
    event.target.value = ''
  }

  const uploadInlineFiles = async (targetPostId, rawContent) => {
    const targets = pendingInlineUploads.filter((upload) => rawContent.includes(upload.placeholder))

    if (targets.length === 0) {
      return {
        resolvedContent: rawContent,
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

    let resolvedContent = replaceUploadPlaceholders(rawContent, replacements)

    for (const failedUpload of failedUploads) {
      resolvedContent = resolvedContent
        .split(failedUpload.markdown)
        .join(`[업로드 실패: ${failedUpload.originalFilename}]`)
      resolvedContent = resolvedContent
        .split(failedUpload.placeholder)
        .join('')
    }

    return {
      resolvedContent,
      uploadedCount: replacements.length,
      failedUploads,
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()

    if (!trimmedTitle || !trimmedContent) {
      toast.error('제목과 내용을 모두 입력해주세요.')
      return
    }

    if (!categoryId) {
      toast.error('커뮤니티 위치를 선택해주세요.')
      return
    }

    const data = {
      title: trimmedTitle,
      content: trimmedContent,
      category_id: parseInt(categoryId, 10),
    }

    setUploadProgress(true)

    try {
      if (isEdit) {
        const { resolvedContent, uploadedCount, failedUploads } = await uploadInlineFiles(postId, trimmedContent)
        const normalizedContent = resolvedContent.trim() || trimmedContent

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
            : '게시글이 수정되었습니다.'
        )

        setPendingInlineUploads([])
        navigate(`/posts/${id}`)
        return
      }

      const response = await createMutation.mutateAsync(data)
      const createdPostId = response.data.id

      const { resolvedContent, uploadedCount, failedUploads } = await uploadInlineFiles(createdPostId, trimmedContent)
      const normalizedContent = resolvedContent.trim() || trimmedContent

      if (normalizedContent !== trimmedContent) {
        await postsAPI.updatePost(createdPostId, { content: normalizedContent })
      }

      await invalidateCommunityCaches()

      if (failedUploads.length > 0) {
        toast.warning(`일부 파일 업로드에 실패했습니다: ${failedUploads.map((item) => item.originalFilename).join(', ')}`)
      }

      toast.success(
        uploadedCount > 0
          ? `게시글이 작성되었습니다. (인라인 파일 ${uploadedCount}개 반영)`
          : '게시글이 작성되었습니다.'
      )

      setPendingInlineUploads([])
      navigate(`/posts/${createdPostId}`)
    } catch (error) {
      toast.error(
        error.response?.data?.detail
          || (isEdit ? '게시글 수정에 실패했습니다.' : '게시글 작성에 실패했습니다.')
      )
    } finally {
      setUploadProgress(false)
    }
  }

  const isLoading = createMutation.isLoading || updateMutation.isLoading
  const activeInlineUploadCount = pendingInlineUploads.filter(
    (upload) => content.includes(upload.placeholder)
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
            {isEdit ? '내용을 수정하고 저장하세요' : '글 내용 안에서 이미지, 파일, 수식을 함께 작성할 수 있습니다.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          <div>
            <label htmlFor="category" className="block text-sm font-semibold text-ink-700 mb-2">
              커뮤니티 위치 <span className="text-red-500">*</span>
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input-field"
              required
            >
              <option value="">커뮤니티를 선택하세요</option>
              {selectableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
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
              className="input-field text-lg font-medium"
              required
            />
          </div>

          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <label htmlFor="content" className="block text-sm font-semibold text-ink-700">
                내용
              </label>
              <div className="flex flex-wrap justify-end gap-1.5">
                <button
                  type="button"
                  onClick={handleOpenInlineFilePicker}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-ink-200 text-ink-700 hover:bg-paper-100"
                >
                  이미지/파일
                </button>
                <button
                  type="button"
                  onClick={handleInsertLink}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-ink-200 text-ink-700 hover:bg-paper-100"
                >
                  링크
                </button>
                <button
                  type="button"
                  onClick={handleInsertInlineFormula}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-ink-200 text-ink-700 hover:bg-paper-100"
                >
                  수식
                </button>
                <button
                  type="button"
                  onClick={handleInsertBlockFormula}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-ink-200 text-ink-700 hover:bg-paper-100"
                >
                  수식 블록
                </button>
              </div>
            </div>

            <input
              ref={inlineFileInputRef}
              type="file"
              multiple
              accept={INLINE_FILE_ACCEPT}
              onChange={handleInlineFileChange}
              className="hidden"
            />

            <textarea
              ref={contentInputRef}
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용을 입력하세요&#x2026;"
              className="input-field resize-y leading-relaxed"
              rows="18"
              required
            />

            <p className="mt-2 text-xs text-ink-400">
              본문에서 이미지/파일/링크/수식을 직접 삽입할 수 있습니다.
              {' '}이미지와 파일은 저장 시 자동 업로드되어 본문 링크로 치환됩니다.
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
