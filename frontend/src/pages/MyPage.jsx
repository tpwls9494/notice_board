import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { authAPI, signalsAPI } from '../services/api'
import useAuthStore from '../stores/authStore'
import { useSeo } from '../utils/seo'

const SUGGESTED = ['SLM', 'LLM', '에이전트', '프롬프트', '파인튜닝', '추론 최적화', 'RAG', '멀티모달', '오픈소스', '논문']

export default function MyPage() {
  const { user, setUser } = useAuthStore()
  const [keywords, setKeywords] = useState([])
  const [customKeyword, setCustomKeyword] = useState('')
  const [bio, setBio] = useState(user?.bio || '')

  useSeo({ title: '내 관심 정보', description: '관심 있는 AI 키워드와 프로필을 관리합니다.', url: '/mypage', noindex: true })

  const interests = useQuery({
    queryKey: ['my-signal-interests'],
    queryFn: () => signalsAPI.getInterests(),
    enabled: Boolean(user?.email_verified),
  })

  useEffect(() => {
    if (interests.data?.data?.keywords) setKeywords(interests.data.data.keywords)
  }, [interests.data])

  useEffect(() => setBio(user?.bio || ''), [user?.bio])

  const saveInterests = useMutation({
    mutationFn: () => signalsAPI.updateInterests(keywords),
    onSuccess: () => toast.success('관심 키워드를 저장했습니다.'),
    onError: () => toast.error('관심 키워드를 저장하지 못했습니다.'),
  })

  const saveProfile = useMutation({
    mutationFn: () => authAPI.updateMeProfile({ bio }),
    onSuccess: (response) => { setUser(response.data); toast.success('소개를 저장했습니다.') },
    onError: () => toast.error('소개를 저장하지 못했습니다.'),
  })

  const toggleKeyword = (keyword) => {
    setKeywords((current) => current.includes(keyword) ? current.filter((item) => item !== keyword) : [...current, keyword].slice(0, 20))
  }

  const addKeyword = () => {
    const value = customKeyword.trim()
    if (!value || keywords.some((item) => item.toLowerCase() === value.toLowerCase())) return
    setKeywords((current) => [...current, value].slice(0, 20))
    setCustomKeyword('')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-black tracking-[0.16em] text-ink-300">MY JION</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-ink-950">내가 놓치고 싶지 않은 정보</h1>
      <p className="mt-3 text-sm leading-7 text-ink-500">관심 키워드는 앞으로 개인 피드와 주간 요약의 기준이 됩니다.</p>

      <section className="mt-8 rounded-[24px] border border-ink-100 bg-paper-50 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-950 text-lg font-black text-paper-50">{user?.username?.charAt(0)?.toUpperCase()}</span>
          <div><h2 className="font-black text-ink-900">{user?.username}</h2><p className="text-xs text-ink-400">{user?.email}</p></div>
        </div>
        <label className="mt-6 block"><span className="text-sm font-bold text-ink-700">나를 소개하는 한마디</span><textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={200} rows={3} className="mt-2 w-full resize-none rounded-xl border border-ink-200 bg-paper-100 p-3 text-sm leading-6 outline-none focus:border-ink-400" placeholder="관심 분야나 직접 해보고 있는 일을 적어보세요." /></label>
        <div className="mt-3 flex justify-end"><button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending} className="rounded-full border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700">소개 저장</button></div>
      </section>

      <section className="mt-5 rounded-[24px] border border-ink-100 bg-paper-50 p-6 sm:p-8">
        <div className="flex items-center justify-between"><div><h2 className="text-lg font-black text-ink-900">관심 키워드</h2><p className="mt-1 text-xs text-ink-400">최대 20개 · 현재 {keywords.length}개</p></div></div>
        {!user?.email_verified && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">이메일 인증 후 관심 키워드를 저장할 수 있습니다.</p>}
        <div className="mt-5 flex flex-wrap gap-2">{SUGGESTED.map((keyword) => <button key={keyword} type="button" onClick={() => toggleKeyword(keyword)} className={`rounded-full px-4 py-2 text-sm font-bold ${keywords.includes(keyword) ? 'bg-ink-950 text-paper-50' : 'border border-ink-100 bg-paper-100 text-ink-500 hover:border-ink-300'}`}>{keyword}</button>)}</div>
        <div className="mt-5 flex gap-2"><input value={customKeyword} onChange={(event) => setCustomKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addKeyword() } }} placeholder="직접 키워드 추가" maxLength={80} className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-paper-100 px-4 py-3 text-sm outline-none focus:border-ink-400" /><button type="button" onClick={addKeyword} className="rounded-xl border border-ink-200 px-4 text-sm font-bold text-ink-600">추가</button></div>
        {keywords.filter((keyword) => !SUGGESTED.includes(keyword)).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{keywords.filter((keyword) => !SUGGESTED.includes(keyword)).map((keyword) => <button key={keyword} type="button" onClick={() => toggleKeyword(keyword)} className="rounded-full bg-ink-950 px-3 py-1.5 text-xs font-bold text-paper-50">{keyword} ×</button>)}</div>}
        <button onClick={() => saveInterests.mutate()} disabled={!user?.email_verified || saveInterests.isPending} className="mt-6 w-full rounded-xl bg-ink-950 px-5 py-3.5 text-sm font-black text-paper-50 disabled:opacity-40">관심 키워드 저장</button>
      </section>
    </div>
  )
}
