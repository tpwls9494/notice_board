import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { resolveApiAssetUrl, signalsAPI, socialAPI } from '../../services/api'
import RelatedSignalPicker from '../../components/social/RelatedSignalPicker'
import ImageAttachment from '../../components/social/ImageAttachment'
import { useSeo } from '../../utils/seo'

const fieldClass = 'mt-2 w-full rounded-lg border border-ink-200 bg-paper-50 px-3 py-2.5 text-sm font-normal text-ink-950 outline-none placeholder:text-ink-400 focus:border-accent'

export default function SocialPostFormPage() {
  const { postId } = useParams()
  const [params] = useSearchParams()
  const entrySpace = params.get('space') === 'lounge' ? 'lounge' : 'community'
  const reviewEntry = entrySpace === 'community' && (params.get('topic') === 'experience' || Boolean(params.get('signal')))
  const signalSlug = entrySpace === 'community' ? params.get('signal') : null
  const contextKey = postId ? 'edit:' + postId : entrySpace + ':' + (reviewEntry ? 'review' : 'general') + ':' + (signalSlug || '')
  return <SocialPostEditor key={contextKey} postId={postId} entrySpace={entrySpace} reviewEntry={reviewEntry} signalSlug={signalSlug} />
}

function SocialPostEditor({ postId, entrySpace, reviewEntry, signalSlug }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = Boolean(postId)
  const initialSpace = entrySpace
  const initialTopic = initialSpace === 'lounge' ? 'chat' : reviewEntry ? 'experience' : 'story'
  const [form, setForm] = useState({ title: '', content: '', space: initialSpace, topic: initialTopic, tags: '', image_url: '' })
  const [relatedSignal, setRelatedSignal] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const uploadedImage = useRef(null)
  const initializedPost = useRef(null)
  const [sourceSlug, setSourceSlug] = useState(() => !isEdit ? signalSlug : null)
  const sourceQuery = useQuery({ queryKey: ['signal', sourceSlug], queryFn: () => signalsAPI.getSignal(sourceSlug), enabled: Boolean(sourceSlug) })
  useEffect(() => {
    if (!sourceSlug || !sourceQuery.data?.data) return
    const { id, slug, title } = sourceQuery.data.data
    setRelatedSignal({ id, slug, title })
    setSourceSlug(null)
  }, [sourceSlug, sourceQuery.data])
  useSeo({ title: isEdit ? '글 수정' : '글쓰기', description: '커뮤니티에 이야기를 나눕니다.', url: isEdit ? `/community/${postId}/edit` : '/community/write', noindex: true })

  const existing = useQuery({ queryKey: ['social-post', postId], queryFn: () => socialAPI.getPost(postId), enabled: isEdit })
  const isLounge = form.space === 'lounge'
  const fixedReview = !isLounge && (isEdit ? existing.data?.data?.topic === 'experience' : reviewEntry)
  const canChooseTopic = !isLounge && !fixedReview
  const titlePlaceholder = form.topic === 'experience'
    ? relatedSignal || sourceSlug
      ? '써본 경험을 한 줄로 정리해 주세요'
      : '사용한 도구와 경험을 한 줄로 적어주세요'
    : '사람들과 나누고 싶은 이야기를 적어주세요'
  useEffect(() => {
    if (!existing.data?.data) return
    const post = existing.data.data
    if (initializedPost.current === post.id) return
    initializedPost.current = post.id
    setRelatedSignal(post.related_signal || null)
    setForm({ title: post.title, content: post.content, space: post.space, topic: post.topic, tags: (post.tags || []).join(', '), image_url: post.image_url || '' })
  }, [existing.data])

  const save = useMutation({
    mutationFn: async () => {
      const space = isEdit ? existing.data.data.space : entrySpace
      const topic = fixedReview ? 'experience' : space === 'lounge' && !isEdit ? 'chat' : form.topic
      let imageUrl = form.image_url.trim() || null
      if (imageFile) {
        if (uploadedImage.current?.file !== imageFile) {
          const response = await socialAPI.uploadImage(imageFile)
          uploadedImage.current = { file: imageFile, url: resolveApiAssetUrl(response.data.url) }
        }
        imageUrl = uploadedImage.current.url
      }
      const payload = { ...form, space, topic, related_signal_id: space === 'community' ? relatedSignal?.id || null : null, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean), image_url: imageUrl }
      return isEdit ? socialAPI.updatePost(postId, payload) : socialAPI.createPost(payload)
    },
    onSuccess: (response) => {
      for (const key of ['signal-experiences', 'social-posts', 'community-preview', 'site-activity']) queryClient.invalidateQueries({ queryKey: [key] })
      queryClient.invalidateQueries({ queryKey: ['social-post', String(response.data.id)] })
      toast.success(isEdit ? '글을 수정했습니다.' : '이야기를 올렸습니다.')
      navigate(`/community/${response.data.id}`)
    },
    onError: (error) => toast.error(error.response?.data?.detail || '글을 저장하지 못했습니다.'),
  })
  const change = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }
  const selectImage = (file) => {
    if (save.isPending) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { toast.error('PNG, JPG, WebP 이미지만 첨부할 수 있습니다.'); return }
    if (!file.size || file.size > 5 * 1024 * 1024) { toast.error('이미지는 비어 있지 않은 5MB 이하 파일을 선택해 주세요.'); return }
    setImageFile(file)
    uploadedImage.current = null
    setForm((current) => ({ ...current, image_url: '' }))
  }
  const removeImage = () => {
    setImageFile(null)
    uploadedImage.current = null
    setForm((current) => ({ ...current, image_url: '' }))
  }
  const pasteImage = (event) => {
    if (save.isPending) return
    const image = [...(event.clipboardData?.items || [])].find((item) => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile()
    if (!image) return
    event.preventDefault()
    selectImage(image)
  }

  if (isEdit && existing.isPending) return <p role="status" className="py-12 text-center text-sm text-ink-500">작성한 글을 불러오는 중입니다.</p>
  if (isEdit && existing.isError) return <div role="alert" className="py-12 text-center text-sm text-ink-500">글을 불러오지 못했습니다. <button type="button" onClick={() => existing.refetch()} className="text-accent-dark">다시 시도</button></div>

  return (
    <div className="mx-auto max-w-3xl">
      <header className="border-b border-ink-200 pb-5">
        <h1 className="text-3xl font-bold tracking-tight text-ink-950">{isEdit ? '글 수정' : isLounge ? '라운지 글쓰기' : fixedReview ? '후기 쓰기' : '커뮤니티 글쓰기'}</h1>
        <p className="mt-2 text-sm leading-6 text-ink-500">{isLounge ? '라운지에 일상과 가벼운 이야기를 남깁니다.' : fixedReview ? '직접 써본 경험을 커뮤니티에 사용 후기로 남깁니다.' : '커뮤니티에 질문과 경험, 팁을 나눕니다.'}</p>
      </header>
      <form onSubmit={(event) => { event.preventDefault(); if (!sourceSlug && !save.isPending) save.mutate() }} className="mt-6 space-y-6">
        <label className="block text-sm font-medium text-ink-700">
          제목
          <input name="title" required disabled={save.isPending} maxLength={200} value={form.title} onChange={change} placeholder={titlePlaceholder} className="mt-2 w-full border-b border-ink-200 bg-transparent py-3 text-xl font-semibold leading-7 text-ink-950 outline-none placeholder:font-normal placeholder:text-ink-400 focus:border-accent" />
        </label>
        <div>
          <label htmlFor="post-content" className="block text-sm font-medium text-ink-700">내용</label>
          <textarea id="post-content" name="content" required disabled={save.isPending} maxLength={20000} rows={10} value={form.content} onChange={change} onPaste={pasteImage} aria-describedby={form.topic === 'experience' ? 'experience-guide' : undefined} placeholder={form.topic === 'experience' ? '경험을 자유롭게 적어주세요.' : '질문, 경험, 생각을 자유롭게 작성하세요.'} className="mt-3 w-full resize-y rounded-lg border border-ink-200 bg-paper-50 p-4 text-[15px] font-normal leading-7 text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent sm:p-5" />
          {form.topic === 'experience' && <p id="experience-guide" className="mt-2 text-xs leading-6 text-ink-500">편해진 점, 아쉬운 점, 사용 환경을 함께 적으면 도움이 돼요. 직접 겪은 범위에서 편하게 써주세요.</p>}
        </div>

        <fieldset disabled={save.isPending} className="space-y-5 border-t border-ink-200 pt-5">
          <legend className="pr-3 text-sm font-semibold text-ink-700">{canChooseTopic ? '게시 설정' : '추가 정보 · 선택'}</legend>
          {canChooseTopic && <label className="block text-xs font-medium text-ink-600">글 종류<select name="topic" value={form.topic} onChange={change} className={fieldClass}><option value="question">질문</option><option value="experience">사용 후기</option><option value="tip">팁</option><option value="story">이야기</option>{isEdit && existing.data?.data?.topic === 'chat' && <option value="chat">잡담</option>}</select></label>}
          {sourceSlug && <div role="status" className="text-sm text-ink-500">{sourceQuery.isError ? <>연결할 소식을 불러오지 못했어요. <button type="button" onClick={() => sourceQuery.refetch()} className="text-accent-dark">다시 시도</button><button type="button" onClick={() => setSourceSlug(null)} className="ml-3 text-ink-600">연결 없이 작성</button></> : '관련 소식을 불러오는 중입니다.'}</div>}
          {form.space === 'community' && !sourceSlug && <RelatedSignalPicker value={relatedSignal} onChange={setRelatedSignal} />}
          <label className="block text-xs font-medium text-ink-600">태그 <span className="font-normal text-ink-500">선택 · 쉼표로 구분</span><input name="tags" value={form.tags} onChange={change} placeholder="SLM, 프롬프트, 개발" className={fieldClass} /></label>
          <ImageAttachment file={imageFile} imageUrl={form.image_url} onSelect={selectImage} onRemove={removeImage} disabled={save.isPending} />
        </fieldset>
        <div className="flex justify-end gap-3 border-t border-ink-200 pt-5"><button type="button" disabled={save.isPending} onClick={() => navigate(-1)} className="px-5 py-3 text-sm font-medium text-ink-600 disabled:opacity-40">취소</button><button type="submit" disabled={save.isPending || Boolean(sourceSlug)} className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-40">{save.isPending ? '저장 중' : isEdit ? '수정 완료' : form.topic === 'experience' ? '후기 올리기' : '글 올리기'}</button></div>
      </form>
    </div>
  )
}
