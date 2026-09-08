import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { signalsAPI } from '../../services/api'
import { useSeo } from '../../utils/seo'
import SignalBody from '../../components/signals/SignalBody'

const inputClass = 'mt-1.5 w-full rounded-xl border border-ink-200 bg-paper-100 px-3.5 py-2.5 text-sm text-ink-800 outline-none focus:border-ink-400'

function toForm(item) {
  return {
    title: item.title || '',
    original_title: item.original_title || '',
    image_url: item.image_url || '',
    summary: item.summary || '',
    body: item.body || '',
    why_it_matters: item.why_it_matters || '',
    try_this: item.try_this || '',
    content_kind: item.content_kind || 'workflow',
    source_kind: item.source_kind || 'web',
    source_name: item.source_name || '',
    source_url: item.source_url || '',
    verification_level: item.verification_level || 'unverified',
    tags: (item.tags || []).join(', '),
    evidence: (item.evidence || []).join('\n'),
    importance_score: item.importance_score || 0,
    external_reactions: item.external_reactions || 0,
    pinned_until: item.pinned_until ? item.pinned_until.slice(0, 16) : '',
  }
}

function toPayload(form) {
  const payload = {
    ...form,
    tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    evidence: form.evidence.split('\n').map((url) => url.trim()).filter(Boolean),
    importance_score: Number(form.importance_score) || 0,
    external_reactions: Number(form.external_reactions) || 0,
    original_title: form.original_title.trim() || null,
    image_url: form.image_url.trim() || null,
    pinned_until: form.pinned_until || null,
  }
  return payload
}

function ReviewCard({ item, busy, onSave, onPublish, onAction }) {
  const [form, setForm] = useState(() => toForm(item))

  useEffect(() => setForm(toForm(item)), [item])

  const change = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  return (
    <article className="rounded-[22px] border border-ink-100 bg-paper-50 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
        <span className="rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-700">검토 필요</span>
        <span>{item.source_name}</span>
        <span>·</span>
        <span>{item.status}</span>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="text-xs font-bold text-ink-600">제목
          <input name="title" required minLength={4} value={form.title} onChange={change} className={inputClass} />
        </label>
        <label className="text-xs font-bold text-ink-600">원문 제목
          <input name="original_title" value={form.original_title} onChange={change} className={inputClass} />
        </label>
        <label className="text-xs font-bold text-ink-600">목록 소개 · 한 문장
          <textarea name="summary" required minLength={10} rows={4} value={form.summary} onChange={change} className={inputClass} />
        </label>
        <label className="text-xs font-bold text-ink-600">본문 · Markdown
          <textarea name="body" rows={12} maxLength={20000} value={form.body} onChange={change} placeholder="소식·해설은 본문에서 궁금증에 답하세요. 소제목과 표를 사용할 수 있습니다." className={inputClass} />
          <span className="mt-2 block font-normal leading-6">본문이 있으면 기존 활용 포인트 대신 표시합니다. 비워두면 기존 글 구성이 유지됩니다.</span>
        </label>
        {form.body.trim() && <details className="rounded-xl border border-ink-200 p-4"><summary className="cursor-pointer text-sm text-ink-600">본문 미리보기</summary><div className="mt-5"><SignalBody body={form.body} /></div></details>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-ink-600">왜 중요한가
            <textarea name="why_it_matters" required={!form.body.trim()} rows={4} value={form.why_it_matters} onChange={change} className={inputClass} />
          </label>
          <label className="text-xs font-bold text-ink-600">직접 해보기 · {form.content_kind === 'workflow' ? '활용법은 필수' : '소식·연구 해설은 선택'}
            <textarea name="try_this" required={form.content_kind === 'workflow'} rows={4} value={form.try_this} onChange={change} className={inputClass} />
          </label>
        </div>
        <label className="text-xs font-bold text-ink-600">공식 이미지 URL
          <input name="image_url" type="url" value={form.image_url} onChange={change} className={inputClass} />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-xs font-bold text-ink-600">중요도 (0~1)<input name="importance_score" type="number" min="0" max="1" step="0.05" value={form.importance_score} onChange={change} className={inputClass} /></label>
          <label className="text-xs font-bold text-ink-600">외부 반응 수<input name="external_reactions" type="number" min="0" value={form.external_reactions} onChange={change} className={inputClass} /></label>
          <label className="text-xs font-bold text-ink-600">상단 유지 기한<input name="pinned_until" type="datetime-local" value={form.pinned_until} onChange={change} className={inputClass} /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-xs font-bold text-ink-600">분류
            <select name="content_kind" value={form.content_kind} onChange={change} className={inputClass}>
              <option value="release">새 소식</option><option value="workflow">활용법</option><option value="research">연구·자료</option>
            </select>
          </label>
          <label className="text-xs font-bold text-ink-600">검증 수준
            <select name="verification_level" value={form.verification_level} onChange={change} className={inputClass}>
              <option value="unverified">미검증</option><option value="community">커뮤니티 경험</option><option value="cross_checked">교차 확인</option><option value="official">공식·1차 출처</option>
            </select>
          </label>
          <label className="text-xs font-bold text-ink-600">출처 유형
            <input name="source_kind" value={form.source_kind} onChange={change} className={inputClass} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-ink-600">출처 이름
            <input name="source_name" value={form.source_name} onChange={change} className={inputClass} />
          </label>
          <label className="text-xs font-bold text-ink-600">원문 URL
            <input name="source_url" type="url" value={form.source_url} onChange={change} className={inputClass} />
          </label>
        </div>
        <label className="text-xs font-bold text-ink-600">태그 <span className="font-normal text-ink-300">쉼표로 구분</span>
          <input name="tags" value={form.tags} onChange={change} className={inputClass} />
        </label>
        <label className="text-xs font-bold text-ink-600">추가 근거 URL <span className="font-normal text-ink-300">한 줄에 하나</span>
          <textarea name="evidence" rows={3} value={form.evidence} onChange={change} className={inputClass} />
        </label>
      </div>

      <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-4 block truncate text-sm text-ink-600 underline">원문 열기 · {item.source_url}</a>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => onSave(item.id, toPayload(form))} className="rounded-full border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700 disabled:opacity-40">수정 저장</button>
        <button type="button" disabled={busy || form.verification_level === 'unverified'} onClick={() => onPublish(item.id, toPayload(form))} className="rounded-full bg-ink-950 px-4 py-2 text-xs font-bold text-paper-50 disabled:opacity-40">저장 후 공개</button>
        <button type="button" disabled={busy} onClick={() => onAction(item.id, 'hold')} className="rounded-full border border-ink-200 px-4 py-2 text-xs font-bold text-ink-600 disabled:opacity-40">보류</button>
        <button type="button" disabled={busy} onClick={() => onAction(item.id, 'reject')} className="rounded-full px-4 py-2 text-xs font-bold text-red-500 disabled:opacity-40">제외</button>
      </div>
    </article>
  )
}

export default function SignalReviewPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  useSeo({ title: '검토함', description: '공개 전 AI 정보 검토', url: '/review', noindex: true })
  const queue = useQuery({ queryKey: ['signal-review-queue', page], queryFn: () => signalsAPI.getReviewQueue({ page, page_size: 20 }) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['signal-review-queue'] })
  const mutation = useMutation({
    mutationFn: async ({ id, payload, action }) => {
      if (payload) await signalsAPI.update(id, payload)
      if (action) return signalsAPI.review(id, { action, verification_level: payload?.verification_level })
      return null
    },
    onSuccess: (_, variables) => {
      refresh()
      toast.success(variables.action === 'publish' ? '검토를 마치고 공개했습니다.' : '검토 내용을 저장했습니다.')
    },
    onError: (error) => toast.error(error.response?.data?.detail || '검토 내용을 저장하지 못했습니다.'),
  })
  const items = queue.data?.data?.items || []
  const total = queue.data?.data?.total || 0
  const pageCount = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs font-black tracking-[0.16em] text-ink-300">EDITORIAL QUEUE</p>
      <div className="mt-2 flex items-end justify-between">
        <div><h1 className="text-3xl font-black text-ink-950">검토함</h1><p className="mt-2 text-sm text-ink-400">내용과 출처를 다듬고 검증 수준을 선택한 뒤 공개합니다.</p></div>
        <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-bold text-ink-500">전체 {total}건</span>
      </div>
      {queue.isError && <div className="mt-8 rounded-2xl bg-red-50 p-4 text-sm text-red-700">검토함을 불러오지 못했습니다.</div>}
      <div className="mt-8 space-y-5">
        {queue.isLoading && <div className="h-64 animate-pulse rounded-[22px] bg-ink-100" />}
        {!queue.isLoading && !queue.isError && items.length === 0 && <div className="rounded-[24px] border border-dashed border-ink-200 bg-paper-50 py-16 text-center text-sm text-ink-400">현재 검토할 정보가 없습니다.</div>}
        {items.map((item) => (
          <ReviewCard
            key={item.id}
            item={item}
            busy={mutation.isPending}
            onSave={(id, payload) => mutation.mutate({ id, payload })}
            onPublish={(id, payload) => mutation.mutate({ id, payload, action: 'publish' })}
            onAction={(id, action) => mutation.mutate({ id, action })}
          />
        ))}
      </div>
      {!queue.isLoading && total > 20 && (
        <nav className="mt-8 flex items-center justify-center gap-3" aria-label="검토함 페이지">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-full border border-ink-200 px-4 py-2 text-sm font-bold text-ink-600 disabled:opacity-30">이전</button>
          <span className="text-sm font-semibold text-ink-400">{page} / {pageCount}</span>
          <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-full border border-ink-200 px-4 py-2 text-sm font-bold text-ink-600 disabled:opacity-30">다음</button>
        </nav>
      )}
    </div>
  )
}
