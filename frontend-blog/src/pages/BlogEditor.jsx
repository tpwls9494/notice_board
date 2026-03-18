import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { blogAPI } from '../services/api'
import MarkdownToolbar from '../components/MarkdownToolbar'
import MermaidBlock from '../components/MermaidBlock'

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const MAX_FILE_SIZE = 10 * 1024 * 1024

export default function BlogEditor() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(slug)
  const textareaRef = useRef(null)
  const thumbnailInputRef = useRef(null)

  const [form, setForm] = useState({
    title: '',
    content: '',
    summary: '',
    thumbnail_url: '',
    tags: '',
    is_published: true,
  })
  const [postId, setPostId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('write')
  const [uploading, setUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [categories, setCategories] = useState([])
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)

  useEffect(() => {
    blogAPI.getCategories()
      .then((res) => setCategories(res.data))
      .catch(() => {})
  }, [])

  const handleAddCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) return
    setAddingCategory(true)
    try {
      const res = await blogAPI.createCategory(name)
      setCategories((prev) => [...prev, res.data])
      setNewCategoryName('')
      setShowNewCategory(false)
      toggleTag(name)
    } catch (err) {
      setError(err.response?.data?.detail || '카테고리 추가에 실패했습니다.')
    } finally {
      setAddingCategory(false)
    }
  }

  const handleDeleteCategory = async (cat) => {
    if (!confirm(`"${cat.name}" 카테고리를 삭제할까요?`)) return
    try {
      await blogAPI.deleteCategory(cat.id)
      setCategories((prev) => prev.filter((c) => c.id !== cat.id))
    } catch (err) {
      setError(err.response?.data?.detail || '카테고리 삭제에 실패했습니다.')
    }
  }

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    blogAPI
      .getPost(slug)
      .then((res) => {
        const p = res.data
        setPostId(p.id)
        setForm({
          title: p.title || '',
          content: p.content || '',
          summary: p.summary || '',
          thumbnail_url: p.thumbnail_url || '',
          tags: p.tags || '',
          is_published: p.is_published ?? true,
        })
      })
      .catch(() => setError('글을 불러올 수 없습니다.'))
      .finally(() => setLoading(false))
  }, [slug, isEdit])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const toggleTag = (tagKey) => {
    const currentTags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const newTags = currentTags.includes(tagKey)
      ? currentTags.filter((t) => t !== tagKey)
      : [...currentTags, tagKey]
    setForm((prev) => ({ ...prev, tags: newTags.join(', ') }))
  }

  const selectedTags = form.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (isEdit) {
        await blogAPI.update(postId, form)
      } else {
        await blogAPI.create(form)
      }
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  /* ── Image upload helper ── */
  const uploadAndInsertImage = useCallback(async (file) => {
    if (!IMAGE_MIME_TYPES.has(file.type)) {
      setError('이미지 파일만 업로드할 수 있습니다. (jpg, png, gif, webp)')
      return null
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('파일 크기가 10MB를 초과합니다.')
      return null
    }

    setUploading(true)
    setError(null)
    try {
      const res = await blogAPI.uploadImage(file)
      return res.data.url
    } catch (err) {
      setError(err.response?.data?.detail || '이미지 업로드에 실패했습니다.')
      return null
    } finally {
      setUploading(false)
    }
  }, [])

  const insertImageMarkdown = useCallback((url, alt = '이미지') => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const markdown = `![${alt}](${url})`
    const prefix = start > 0 && form.content[start - 1] !== '\n' ? '\n' : ''
    const next = form.content.slice(0, start) + prefix + markdown + '\n' + form.content.slice(start)
    setForm((prev) => ({ ...prev, content: next }))
    requestAnimationFrame(() => {
      ta.focus()
      const cursor = start + prefix.length + markdown.length + 1
      ta.setSelectionRange(cursor, cursor)
    })
  }, [form.content])

  const handleImageFiles = useCallback(async (files) => {
    for (const file of files) {
      const url = await uploadAndInsertImage(file)
      if (url) insertImageMarkdown(url, file.name.replace(/\.[^.]+$/, ''))
    }
  }, [uploadAndInsertImage, insertImageMarkdown])

  /* ── Drag & drop on textarea ── */
  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => setIsDragOver(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer?.files || []).filter((f) =>
      IMAGE_MIME_TYPES.has(f.type),
    )
    if (files.length > 0) handleImageFiles(files)
  }

  /* ── Paste image ── */
  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imageFiles = items
      .filter((item) => item.kind === 'file' && IMAGE_MIME_TYPES.has(item.type))
      .map((item) => item.getAsFile())
      .filter(Boolean)
    if (imageFiles.length > 0) {
      e.preventDefault()
      handleImageFiles(imageFiles)
    }
  }

  /* ── Thumbnail upload ── */
  const handleThumbnailUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const url = await uploadAndInsertImage(file)
    if (url) setForm((prev) => ({ ...prev, thumbnail_url: url }))
  }

  /* ── Toolbar (image button triggers file upload) ── */
  const { toolbar, keyDownHandler } = MarkdownToolbar({
    textareaRef,
    value: form.content,
    onChange: (next) => setForm((prev) => ({ ...prev, content: next })),
    onImageUpload: handleImageFiles,
  })

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-ink-300 border-t-ink-800 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink-900 mb-6">
        {isEdit ? '글 수정' : '새 글 작성'}
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">
            제목
          </label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">
            요약
          </label>
          <input
            name="summary"
            value={form.summary}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">
            썸네일
          </label>
          <p className="text-xs text-ink-400 mb-1.5">
            이미지를 업로드하거나 URL을 직접 입력할 수 있습니다.
          </p>
          <div className="flex gap-2">
            <input
              name="thumbnail_url"
              value={form.thumbnail_url}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
              className="flex-1 px-3 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              type="button"
              onClick={() => thumbnailInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-2 border border-ink-200 text-ink-600 rounded-lg text-sm hover:bg-paper-100 disabled:opacity-50 shrink-0"
            >
              {uploading ? '업로드 중...' : '이미지 업로드'}
            </button>
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleThumbnailUpload}
            />
          </div>
          {form.thumbnail_url && (
            <img
              src={form.thumbnail_url}
              alt="썸네일 미리보기"
              className="mt-2 h-32 object-cover rounded-lg border border-ink-100"
              onError={(e) => (e.target.style.display = 'none')}
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">
            카테고리
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            {categories.map((cat) => (
              <span key={cat.id} className="relative group/cat">
                <button
                  type="button"
                  onClick={() => toggleTag(cat.name)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    selectedTags.includes(cat.name)
                      ? 'bg-ink-800 text-white border-ink-800'
                      : 'bg-white text-ink-500 border-ink-200 hover:border-ink-400'
                  }`}
                >
                  {cat.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover/cat:opacity-100 transition-opacity"
                  title="카테고리 삭제"
                >
                  ×
                </button>
              </span>
            ))}
            {showNewCategory ? (
              <div className="flex items-center gap-1.5">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                  placeholder="카테고리 이름"
                  autoFocus
                  className="px-2.5 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={addingCategory || !newCategoryName.trim()}
                  className="px-2.5 py-1.5 text-sm bg-ink-800 text-white rounded-lg disabled:opacity-50"
                >
                  {addingCategory ? '...' : '추가'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewCategory(false); setNewCategoryName('') }}
                  className="px-2 py-1.5 text-sm text-ink-400 hover:text-ink-600"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewCategory(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-dashed border-ink-300 text-ink-400 hover:border-ink-500 hover:text-ink-600 transition-colors"
                title="카테고리 추가"
              >
                +
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-ink-700">
              내용 (Markdown)
            </label>
            <div className="inline-flex rounded-lg border border-ink-100 bg-paper-100 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('write')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'write'
                    ? 'bg-white text-ink-900 shadow-sm'
                    : 'text-ink-400 hover:text-ink-700'
                }`}
              >
                작성
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-white text-ink-900 shadow-sm'
                    : 'text-ink-400 hover:text-ink-700'
                }`}
              >
                미리보기
              </button>
            </div>
          </div>

          {viewMode === 'write' ? (
            <div>
              {toolbar}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  name="content"
                  value={form.content}
                  onChange={handleChange}
                  onKeyDown={keyDownHandler}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onPaste={handlePaste}
                  required
                  rows={20}
                  className={`w-full px-3 py-2 border rounded-b-lg rounded-t-none border-t-0 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-y transition-colors ${
                    isDragOver
                      ? 'border-blue-400 bg-blue-50/50'
                      : 'border-ink-100'
                  }`}
                />
                {isDragOver && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-b-lg bg-blue-50/80 border-2 border-dashed border-blue-400 pointer-events-none">
                    <p className="text-sm font-medium text-blue-600">이미지를 여기에 놓으세요</p>
                  </div>
                )}
                {uploading && (
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2.5 py-1 bg-ink-800 text-white text-xs rounded-md">
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    업로드 중...
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-400">
                이미지를 드래그&드롭하거나 붙여넣기(Ctrl+V)로 삽입할 수 있습니다.
              </p>
            </div>
          ) : (
            <div className="min-h-[480px] px-4 py-3 border border-ink-100 rounded-lg bg-white overflow-y-auto">
              {form.content ? (
                <div className="prose prose-preview">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '')
                        const lang = match?.[1] || ''
                        if (lang === 'mermaid') {
                          return <MermaidBlock code={String(children).replace(/\n$/, '')} />
                        }
                        return <code className={className} {...props}>{children}</code>
                      },
                    }}
                  >
                    {form.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-ink-300 text-sm py-8 text-center">
                  미리보기할 내용이 없습니다.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="is_published"
            checked={form.is_published}
            onChange={handleChange}
            id="is_published"
            className="w-4 h-4"
          />
          <label htmlFor="is_published" className="text-sm text-ink-700">
            바로 발행
          </label>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving || uploading}
            className="px-5 py-2 bg-ink-800 text-white rounded-lg text-sm hover:bg-ink-900 disabled:opacity-50"
          >
            {saving ? '저장 중...' : isEdit ? '수정' : '발행'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-5 py-2 border border-ink-200 text-ink-600 rounded-lg text-sm hover:bg-paper-100"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  )
}
