import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { qaAPI } from '../services/api'
import { useState } from 'react'

function QAList() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['qaQuestions', page, search],
    queryFn: () => qaAPI.getQuestions(page, 10, search),
  })

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
        <p className="text-sm text-ink-400">불러오는 중&#x2026;</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <div className="inline-flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 rounded-xl text-sm" role="alert">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          질문을 불러오는데 실패했습니다.
        </div>
      </div>
    )
  }

  const questions = data?.data?.questions || []
  const total = data?.data?.total || 0
  const pageSize = data?.data?.page_size || 10
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink-950 tracking-tight text-balance">
              질문답변
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              전체 <span className="font-semibold text-ink-700">{total}</span>개의 질문
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="card p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400"
                fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="질문 검색&#x2026;"
                className="input-field pl-10"
              />
            </div>
            <button type="submit" className="btn-primary whitespace-nowrap">
              검색
            </button>
          </form>

          {search && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-ink-100">
              <span className="badge-accent flex items-center gap-1.5">
                검색: {search}
                <button
                  onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}
                  className="text-accent hover:text-accent-dark ml-0.5"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-2">
        {questions.length === 0 ? (
          <div className="card px-6 py-16 text-center">
            <div className="text-ink-300 mb-3">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-ink-500 font-medium">질문이 없습니다</p>
            <p className="text-ink-400 text-sm mt-1">첫 번째 질문을 등록해보세요</p>
          </div>
        ) : (
          questions.map((question, index) => (
            <Link
              key={question.id}
              to={`/qa/${question.id}`}
              className={`card-hover block opacity-0 animate-fade-up stagger-${Math.min(index + 1, 8)}`}
            >
              <div className="px-5 py-4 flex items-center gap-4">
                {/* Solved indicator */}
                <div className={`hidden sm:flex w-10 h-10 rounded-lg items-center justify-center flex-shrink-0 ${
                  question.is_solved ? 'bg-emerald-100' : 'bg-amber-50'
                }`}>
                  {question.is_solved ? (
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <span className="text-xs font-bold text-amber-700">
                      {question.bounty}P
                    </span>
                  )}
                </div>

                {/* Question Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className={`text-[15px] font-semibold truncate ${
                      question.is_solved ? 'text-ink-500' : 'text-ink-900'
                    }`}>
                      {question.title}
                    </h2>
                    {question.is_solved ? (
                      <span className="badge-success text-[11px]">해결됨</span>
                    ) : (
                      <span className="badge-points text-[11px]">{question.bounty}P</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ink-400">
                    <span className="font-medium text-ink-600">{question.author_username}</span>
                    <span>{new Intl.DateTimeFormat('ko-KR').format(new Date(question.created_at))}</span>
                  </div>
                </div>

                {/* Answer count */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs text-ink-400">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                    <span>답변 {question.answer_count}</span>
                  </div>
                </div>

                {/* Arrow */}
                <svg className="w-4 h-4 text-ink-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          <div className="flex items-center gap-1 mx-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...')
                acc.push(p)
                return acc
              }, [])
              .map((item, idx) =>
                item === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-ink-400 text-sm">&#x2026;</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium ${
                      page === item
                        ? 'bg-ink-950 text-paper-50 shadow-soft'
                        : 'text-ink-600 hover:bg-ink-100'
                    }`}
                    style={{ transition: 'background-color 0.2s ease-out, color 0.2s ease-out' }}
                  >
                    {item}
                  </button>
                )
              )}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-ghost text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

export default QAList
