import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { postsAPI, filesAPI } from '../../services/api'
import useCategoriesStore from '../../stores/categoriesStore'

function PostForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploadProgress, setUploadProgress] = useState(false)

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
      toast.success('게시글이 작성되었습니다.')
      navigate(`/posts/${response.data.id}`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || '게시글 작성에 실패했습니다.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data) => postsAPI.updatePost(id, data),
    onSuccess: () => {
      toast.success('게시글이 수정되었습니다.')
      navigate(`/posts/${id}`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || '게시글 수정에 실패했습니다.')
    },
  })

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || [])

    // 파일 크기 검증 (10MB)
    const MAX_SIZE = 10 * 1024 * 1024
    const invalidFiles = files.filter(file => file.size > MAX_SIZE)
    if (invalidFiles.length > 0) {
      toast.error(`파일 크기는 10MB를 초과할 수 없습니다: ${invalidFiles.map(f => f.name).join(', ')}`)
      return
    }

    // 파일 타입 검증
    const ALLOWED_TYPES = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ]
    const invalidTypes = files.filter(file => !ALLOWED_TYPES.includes(file.type))
    if (invalidTypes.length > 0) {
      toast.error(`지원하지 않는 파일 형식입니다: ${invalidTypes.map(f => f.name).join(', ')}`)
      return
    }

    setSelectedFiles(files)
  }

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 모두 입력해주세요.')
      return
    }

    const data = {
      title: title.trim(),
      content: content.trim(),
      category_id: categoryId ? parseInt(categoryId) : null,
    }

    try {
      if (isEdit) {
        // 수정 시에는 파일 업로드 지원 안 함
        await updateMutation.mutateAsync(data)
      } else {
        // 1. 게시글 생성
        const response = await createMutation.mutateAsync(data)
        const postId = response.data.id

        // 2. 파일 업로드 (선택된 파일이 있을 경우)
        if (selectedFiles.length > 0) {
          setUploadProgress(true)

          try {
            // 순차적으로 파일 업로드
            for (const file of selectedFiles) {
              await filesAPI.uploadFile(postId, file)
            }
            toast.success(`게시글이 작성되었습니다. (파일 ${selectedFiles.length}개 업로드됨)`)
          } catch (fileError) {
            // 파일 업로드 실패 시에도 게시글은 이미 생성됨
            toast.warning('게시글은 작성되었으나 일부 파일 업로드에 실패했습니다.')
          } finally {
            setUploadProgress(false)
          }
        } else {
          toast.success('게시글이 작성되었습니다.')
        }

        navigate(`/posts/${postId}`)
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || '게시글 작성에 실패했습니다.')
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

          {/* File Attachment (create only) */}
          {!isEdit && (
            <div>
              <label htmlFor="files" className="block text-sm font-semibold text-ink-700 mb-2">
                파일 첨부 (선택사항)
              </label>

              {/* File Input */}
              <input
                id="files"
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="files"
                className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-ink-200 rounded-lg cursor-pointer hover:border-ink-400 hover:bg-paper-50 transition-colors"
              >
                <svg className="w-5 h-5 text-ink-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
                <span className="text-sm text-ink-600">파일 선택 (최대 10MB)</span>
              </label>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between px-3 py-2 bg-paper-50 rounded-lg border border-ink-100"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="w-4 h-4 text-ink-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm text-ink-800 truncate">{file.name}</p>
                          <p className="text-xs text-ink-400">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-xs text-ink-400 hover:text-red-600 flex-shrink-0 ml-2"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-2 text-xs text-ink-400">
                지원 형식: 이미지(JPEG, PNG, GIF, WebP), 문서(PDF, Word, Excel), 텍스트
              </p>
            </div>
          )}

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
                ? (uploadProgress ? '파일 업로드 중\u2026' : '저장 중\u2026')
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
