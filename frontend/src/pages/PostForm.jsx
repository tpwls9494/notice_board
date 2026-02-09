import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? '게시글 수정' : '게시글 작성'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              제목
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              카테고리
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
              내용
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용을 입력하세요"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              rows="15"
              required
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? '저장 중...' : isEdit ? '수정' : '작성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PostForm
