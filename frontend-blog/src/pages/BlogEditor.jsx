import { useState, useEffect, useRef, useCallback } from 'react'
import { useBlocker, useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { blogAPI } from '../services/api'
import MarkdownToolbar from '../components/MarkdownToolbar'
import MermaidBlock from '../components/MermaidBlock'
import PublishSettings from '../components/PublishSettings'
import RichTextEditor from '../components/RichTextEditor'
import './BlogEditor.css'

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const MAX_FILE_SIZE = 10 * 1024 * 1024
const AUTOSAVE_DELAY_MS = 900

export default function BlogEditor() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(slug)
  const textareaRef = useRef(null)
  const publishDialogRef = useRef(null)
  const formRef = useRef(null)
  const dirtyRef = useRef(false)
  const serverUpdatedAtRef = useRef(null)
  const allowNavigationRef = useRef(false)

  const [form, setForm] = useState({
    title: '',
    content: '',
    summary: '',
    thumbnail_url: '',
    tags: '',
    is_published: false,
  })
  const [postId, setPostId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('write')
  const [inputMode, setInputMode] = useState('rich')
  const [uploading, setUploading] = useState(false)
  const uploadCount = useRef(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const [categories, setCategories] = useState([])
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [draftStatus, setDraftStatus] = useState('ready')
  const [recoveryDraft, setRecoveryDraft] = useState(null)
  const [postLoaded, setPostLoaded] = useState(!isEdit)
  const [serverUpdatedAt, setServerUpdatedAt] = useState(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const draftKey = `jion-blog-editor:${slug || 'new'}`
  formRef.current = form
  dirtyRef.current = dirty

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

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    blogAPI
      .getPost(slug)
      .then((res) => {
        const p = res.data
        setPostId(p.id)
        setServerUpdatedAt(p.updated_at || null)
        serverUpdatedAtRef.current = p.updated_at || null
        setForm({
          title: p.title || '',
          content: p.content || '',
          summary: p.summary || '',
          thumbnail_url: p.thumbnail_url || '',
          tags: p.tags || '',
          is_published: p.is_published ?? true,
        })
      })
      .catch(() => { setError('글을 불러올 수 없습니다.'); setLoadFailed(true) })
      .finally(() => { setLoading(false); setPostLoaded(true) })
  }, [slug, isEdit])

  useEffect(() => {
    if (!postLoaded) return
    try {
      const stored = localStorage.getItem(draftKey)
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (!parsed?.form || (!parsed.form.title && !parsed.form.content)) return
      if (serverUpdatedAt && parsed.baseUpdatedAt && parsed.baseUpdatedAt !== serverUpdatedAt) {
        setRecoveryDraft({ ...parsed, hasServerConflict: true })
        return
      }
      if (serverUpdatedAt && !parsed.baseUpdatedAt && parsed.savedAt && new Date(parsed.savedAt) <= new Date(serverUpdatedAt)) {
        localStorage.removeItem(draftKey)
        return
      }
      setRecoveryDraft(parsed)
    } catch {
      localStorage.removeItem(draftKey)
    }
  }, [draftKey, postLoaded, serverUpdatedAt])

  const persistDraft = useCallback((updateStatus = false) => {
    if (!dirtyRef.current || !formRef.current) return true
    const savedAt = new Date().toISOString()
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        form: formRef.current,
        savedAt,
        baseUpdatedAt: serverUpdatedAtRef.current,
      }))
      if (updateStatus) setDraftStatus('saved')
      return true
    } catch {
      if (updateStatus) setDraftStatus('failed')
      return false
    }
  }, [draftKey])

  useEffect(() => {
    if (!dirty) return undefined
    allowNavigationRef.current = false
    setDraftStatus('saving')
    const timer = window.setTimeout(() => {
      persistDraft(true)
    }, AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [dirty, form, persistDraft])

  useEffect(() => () => {
    if (!allowNavigationRef.current) persistDraft(false)
  }, [persistDraft])

  useEffect(() => {
    const warnBeforeLeave = (event) => {
      if (!dirty) return
      persistDraft(false)
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeave)
    return () => window.removeEventListener('beforeunload', warnBeforeLeave)
  }, [dirty, persistDraft])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    dirty && !allowNavigationRef.current && currentLocation.pathname !== nextLocation.pathname
  ))

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const stored = persistDraft(true)
    if (window.confirm(stored ? '작성 중인 내용은 임시 저장했습니다. 편집 화면을 나갈까요?' : '임시 저장하지 못했습니다. 나가면 내용이 사라질 수 있습니다. 그래도 나갈까요?')) {
      allowNavigationRef.current = true
      blocker.proceed()
    } else {
      blocker.reset()
    }
  }, [blocker, persistDraft])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    setDirty(true)
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
    setDirty(true)
  }

  const selectedTags = form.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  const savePost = async (publish) => {
    if (saving || uploading || recoveryDraft || loadFailed) return
    if (!form.title.trim() || !form.content.trim()) {
      setError('제목과 본문을 입력해 주세요.')
      setPublishOpen(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = { ...form, title: form.title.trim(), is_published: publish }
      const { data } = isEdit ? await blogAPI.update(postId, payload) : await blogAPI.create(payload)
      allowNavigationRef.current = true
      dirtyRef.current = false
      setDirty(false)
      try { localStorage.removeItem(draftKey) } catch { /* Server save has succeeded. */ }
      setPublishOpen(false)
      setDraftStatus('server-saved')
      setServerUpdatedAt(data.updated_at)
      serverUpdatedAtRef.current = data.updated_at
      if (publish) navigate(`/${data.slug}`)
      else navigate(`/edit/${data.slug}`, { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (publishOpen) publishDialogRef.current?.showModal()
    else publishDialogRef.current?.close()
  }, [publishOpen])

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

    uploadCount.current += 1
    setUploading(true)
    setError(null)
    try {
      const res = await blogAPI.uploadImage(file)
      return res.data.url
    } catch (err) {
      setError(err.response?.data?.detail || '이미지 업로드에 실패했습니다.')
      return null
    } finally {
      uploadCount.current -= 1
      setUploading(uploadCount.current > 0)
    }
  }, [])

  const insertImageMarkdown = useCallback((url, alt = '이미지') => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const markdown = `![${alt}](${url})`
    const prefix = start > 0 && ta.value[start - 1] !== '\n' ? '\n' : ''
    setForm((prev) => ({ ...prev, content: prev.content.slice(0, start) + prefix + markdown + '\n' + prev.content.slice(start) }))
    setDirty(true)
    requestAnimationFrame(() => {
      ta.focus()
      const cursor = start + prefix.length + markdown.length + 1
      ta.setSelectionRange(cursor, cursor)
    })
  }, [])

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
    if (url) setDirty(true)
  }

  /* ── Toolbar (image button triggers file upload) ── */
  const { toolbar, keyDownHandler } = MarkdownToolbar({
    textareaRef,
    value: form.content,
    onChange: (next) => {
      setForm((prev) => ({ ...prev, content: next }))
      setDirty(true)
    },
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
    <div className="writing-room">
      <div className="writing-topbar">
        <div><p className="journal-eyebrow">나의 작업 공간</p><h1>{isEdit ? '기록 이어 쓰기' : '새로운 기록'}</h1></div>
        <div className="writing-actions">
          <p className={`writing-save-status ${draftStatus === 'failed' ? 'is-error' : ''}`} role="status">{draftStatus === 'saving' ? '임시 저장 중…' : draftStatus === 'saved' ? '이 브라우저에 임시 저장됨' : draftStatus === 'server-saved' ? '초안을 저장했습니다' : draftStatus === 'failed' ? '임시 저장 실패 · 초안 저장을 눌러주세요' : '작성하면 자동으로 임시 저장됩니다'}</p>
          {!form.is_published && <button type="button" className="writing-secondary" onClick={() => savePost(false)} disabled={saving || uploading || !form.title.trim() || !form.content.trim() || Boolean(recoveryDraft) || loadFailed}>{saving ? '저장 중…' : '초안 저장'}</button>}
          <button type="button" className="writing-primary" onClick={() => setPublishOpen(true)} disabled={saving || uploading || !form.title.trim() || !form.content.trim() || Boolean(recoveryDraft) || loadFailed}>{form.is_published ? '수정 반영' : '발행 준비'} <span aria-hidden="true">↗</span></button>
        </div>
      </div>

      {recoveryDraft && <div className="writing-recovery" role="status"><div><strong>이전에 쓰던 내용이 남아 있어요.</strong><p>{recoveryDraft.hasServerConflict ? '서버의 글이 변경되었습니다. 복구 전에 내용을 확인해 주세요.' : `${new Date(recoveryDraft.savedAt).toLocaleString('ko-KR')}에 이 브라우저에 저장한 내용입니다.`}</p></div><div><button type="button" onClick={() => { if (!recoveryDraft.hasServerConflict || confirm('서버의 최신 내용보다 오래된 초안일 수 있습니다. 그래도 복구할까요?')) { setForm(recoveryDraft.form); setRecoveryDraft(null); setDirty(true) } }}>이어서 쓰기</button><button type="button" onClick={() => { localStorage.removeItem(draftKey); setRecoveryDraft(null) }}>저장된 내용 버리기</button></div></div>}
      {error && <p className="writing-error" role="alert">{typeof error === 'string' ? error : '저장에 실패했습니다. 입력 내용을 확인해 주세요.'}</p>}

      <fieldset disabled={saving || Boolean(recoveryDraft) || loadFailed} className="writing-layout">
        <section className="writing-document" aria-label="본문 작성">
          <label className="sr-only" htmlFor="post-title">글 제목</label>
          <input id="post-title" className="writing-title" name="title" value={form.title} onChange={handleChange} maxLength={255} placeholder="어떤 이야기를 남길까요?" />
          <div className="writing-modebar"><div className="writing-input-mode"><label htmlFor="input-mode">본문</label><select id="input-mode" aria-label="본문 편집 방식" value={inputMode} disabled={uploading} onChange={event => setInputMode(event.target.value)}><option value="rich">바로 편집</option><option value="markdown">Markdown 원문</option></select></div><div role="group" aria-label="편집 화면 보기">{[['write', '작성'], ['preview', '미리보기'], ['split', '나란히']].map(([value, label]) => <button key={value} type="button" aria-pressed={viewMode === value} disabled={uploading} onClick={() => setViewMode(value)}>{label}</button>)}</div></div>
          <div className={`writing-panes writing-panes-${viewMode}`}>
            {viewMode !== 'preview' && <div className="writing-input-pane">
              {inputMode === 'rich' ? <RichTextEditor value={form.content} onChange={content => { setForm(prev => ({ ...prev, content })); setDirty(true) }} onUpload={uploadAndInsertImage} disabled={saving || Boolean(recoveryDraft) || loadFailed} uploading={uploading} /> : <>
              {toolbar}
              <div className={`writing-textarea-wrap ${isDragOver ? 'is-dragging' : ''}`}>
                <textarea ref={textareaRef} aria-label="글 본문" name="content" value={form.content} onChange={handleChange} onKeyDown={keyDownHandler} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onPaste={handlePaste} rows={20} placeholder={'배운 내용과 직접 확인한 과정을 편하게 적어보세요.\n\n이미지는 끌어 놓거나 붙여넣을 수 있어요.'} />
                {isDragOver && <div className="writing-drop-overlay">이미지를 여기에 놓으세요</div>}
                {uploading && <span className="writing-upload-status" role="status">이미지를 올리고 있습니다…</span>}
              </div>
              </>}
              {inputMode === 'rich' && uploading && <p className="writing-rich-upload" role="status">이미지를 올리고 있습니다…</p>}
            </div>}
            {viewMode !== 'write' && <div className="writing-preview" aria-label="본문 미리보기">
              {form.content ? <div className="prose prose-preview"><h1>{form.title || '제목 없는 기록'}</h1><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{ code({ className, children, ...props }) { const lang = /language-(\w+)/.exec(className || '')?.[1]; return lang === 'mermaid' ? <MermaidBlock code={String(children).replace(/\n$/, '')} /> : <code className={className} {...props}>{children}</code> } }}>{form.content}</ReactMarkdown></div> : <p className="writing-preview-empty">글을 쓰면 여기에 읽기 화면이 나타나요.</p>}
            </div>}
          </div>
          <div className="writing-document-footer"><span>이미지 끌어 놓기 · 붙여넣기 가능</span><span>{form.content.length.toLocaleString()}자</span></div>
          <p className="writing-local-note">{form.is_published ? '수정 중인 내용은 이 브라우저에 임시 저장됩니다. 공개된 글에 적용하려면 ‘수정 반영’을 눌러주세요.' : '자동 임시 저장은 이 브라우저에 남습니다. 다른 기기에서도 이어 쓰려면 ‘초안 저장’을 눌러주세요.'}</p>
        </section>
        <PublishSettings form={form} onChange={handleChange} onThumbnail={handleThumbnailUpload} onRemoveThumbnail={() => { setForm(prev => ({ ...prev, thumbnail_url: '' })); setDirty(true) }} uploading={uploading} categories={categories} selectedTags={selectedTags} onToggleTag={toggleTag} onAddCategory={handleAddCategory} showNewCategory={showNewCategory} setShowNewCategory={setShowNewCategory} newCategoryName={newCategoryName} setNewCategoryName={setNewCategoryName} addingCategory={addingCategory} />
      </fieldset>

      <dialog ref={publishDialogRef} className="writing-publish-dialog" onCancel={e => { e.preventDefault(); if (!saving) setPublishOpen(false) }}>
        <form onSubmit={e => { e.preventDefault(); savePost(true) }}>
          <p className="journal-eyebrow">마지막으로 확인해 주세요</p><h2>{form.is_published ? '수정한 내용을 반영할까요?' : '이 기록을 발행할까요?'}</h2>
          <p className="writing-publish-help">{form.is_published ? '변경한 내용이 공개된 글에 반영됩니다.' : '발행하면 누구나 이 글을 읽을 수 있습니다.'}</p>
          <div className="writing-publish-card">{form.thumbnail_url && <img src={form.thumbnail_url} alt="대표 이미지" />}<div><span>{selectedTags.join(' / ') || '기록'}</span><h3>{form.title}</h3><p>{form.summary || '별도의 설명 없이 제목과 본문이 공개됩니다.'}</p></div></div>
          {error && <p className="writing-error" role="alert">{typeof error === 'string' ? error : '저장에 실패했습니다.'}</p>}
          <div className="writing-dialog-actions"><button type="button" disabled={saving} className="writing-secondary" onClick={() => setPublishOpen(false)}>계속 쓰기</button><button type="submit" className="writing-primary" disabled={saving || uploading}>{saving ? '저장 중…' : form.is_published ? '변경 반영하기' : '발행하기'}</button></div>
        </form>
      </dialog>
    </div>
  )
}
