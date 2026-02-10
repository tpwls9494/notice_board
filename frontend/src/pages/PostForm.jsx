import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { postsAPI } from '../services/api'
import useCategoriesStore from '../stores/categoriesStore'

function PostForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const { categories, fetchCategories } = useCategoriesStore()

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
    }
  }, [postData])

  const createMutation = useMutation({
    mutationFn: (data) => postsAPI.createPost(data),
    onSuccess: (response) => {
      alert('게시글이 작성되었습니다.')
      navigate(`/posts/${response.data.id}`)
    },
    onError: (error) => {
      alert(error.response?.data?.detail || '게시글 작성에 실패했습니다.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data) => postsAPI.updatePost(id, data),
    onSuccess: () => {
      alert('게시글이 수정되었습니다.')
      navigate(`/posts/${id}`)
    },
    onError: (error) => {
      alert(error.response?.data?.detail || '게시글 수정에 실패했습니다.')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.')
      return
    }

    const data = {
      title: title.trim(),
      content: content.trim(),
      category_id: categoryId ? parseInt(categoryId) : null,
    }

    if (isEdit) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const isLoading = createMutation.isLoading || updateMutation.isLoading

  return (
    <div className="max-w-4xl mx-auto animate-fade-up">
      {/* Back Navigation */}
      <Link
        to={isEdit ? `/posts/${id}` : '/'}
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
            {isEdit ? '내용을 수정하고 저장하세요' : '새로운 글을 작성하세요'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
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
            <label htmlFor="category" className="block text-sm font-semibold text-ink-700 mb-2">
              카테고리
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input-field"
            >
              <option value="">카테고리 선택 (선택사항)</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-semibold text-ink-700 mb-2">
              내용
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용을 입력하세요&#x2026;"
              className="input-field resize-y leading-relaxed"
              rows="15"
              required
            />
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
              disabled={isLoading}
              className="btn-accent"
            >
              {isLoading ? '저장 중\u2026' : isEdit ? '수정 완료' : '작성 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PostForm
