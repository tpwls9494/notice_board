import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { blogAPI } from '../services/api'
import { CATEGORIES } from '../constants/categories'
import MarkdownToolbar from '../components/MarkdownToolbar'
import MermaidBlock from '../components/MermaidBlock'

const TAG_OPTIONS = CATEGORIES.filter((c) => c.key !== 'all')

export default function BlogEditor() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(slug)
  const textareaRef = useRef(null)

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

  const { toolbar, keyDownHandler } = MarkdownToolbar({
    textareaRef,
    value: form.content,
    onChange: (next) => setForm((prev) => ({ ...prev, content: next })),
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
            썸네일 URL
          </label>
          <p className="text-xs text-ink-400 mb-1.5">
            블로그 목록에서 카드 이미지로 표시됩니다. 비워두면 글 제목 첫
            글자로 대체됩니다.
          </p>
          <input
            name="thumbnail_url"
            value={form.thumbnail_url}
            onChange={handleChange}
            placeholder="https://example.com/image.jpg"
            className="w-full px-3 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map((tag) => (
              <button
                key={tag.key}
                type="button"
                onClick={() => toggleTag(tag.key)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  selectedTags.includes(tag.key)
                    ? 'bg-ink-800 text-white border-ink-800'
                    : 'bg-white text-ink-500 border-ink-200 hover:border-ink-400'
                }`}
              >
                {tag.label}
              </button>
            ))}
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
              <textarea
                ref={textareaRef}
                name="content"
                value={form.content}
                onChange={handleChange}
                onKeyDown={keyDownHandler}
                required
                rows={20}
                className="w-full px-3 py-2 border border-ink-100 rounded-b-lg rounded-t-none border-t-0 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-y"
              />
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
            disabled={saving}
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
