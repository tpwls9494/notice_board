import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { postsAPI, commentsAPI, likesAPI, filesAPI } from '../services/api';
import useAuthStore from '../stores/authStore';

function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, token } = useAuthStore();
  const [comment, setComment] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { data: postData, isLoading: postLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: () => postsAPI.getPost(id),
  });

  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => commentsAPI.getComments(id),
  });

  const { data: filesData } = useQuery({
    queryKey: ['files', id],
    queryFn: () => filesAPI.getPostFiles(id),
  });

  const deletePostMutation = useMutation({
    mutationFn: () => postsAPI.deletePost(id),
    onSuccess: () => {
      alert('게시글이 삭제되었습니다.');
      navigate('/');
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: (content) => commentsAPI.createComment({ post_id: parseInt(id), content }),
    onSuccess: () => {
      queryClient.invalidateQueries(['comments', id]);
      setComment('');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId) => commentsAPI.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries(['comments', id]);
    },
  });

  const likeMutation = useMutation({
    mutationFn: () => likesAPI.likePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['post', id]);
    },
    onError: (error) => {
      alert(error.response?.data?.detail || '좋아요에 실패했습니다.');
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: () => likesAPI.unlikePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['post', id]);
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId) => filesAPI.deleteFile(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries(['files', id]);
      alert('파일이 삭제되었습니다.');
    },
  });

  if (postLoading) {
    return <div className="text-center py-12">로딩 중...</div>;
  }

  const post = postData?.data;
  const files = filesData?.data || [];

  const handleDelete = () => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      deletePostMutation.mutate();
    }
  };

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    createCommentMutation.mutate(comment);
  };

  const handleLikeToggle = () => {
    if (!token) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    if (post?.is_liked) {
      unlikeMutation.mutate();
    } else {
      likeMutation.mutate();
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    if (!token) {
      alert('로그인이 필요합니다.');
      return;
    }

    setUploading(true);
    try {
      await filesAPI.uploadFile(id, selectedFile);
      queryClient.invalidateQueries(['files', id]);
      setSelectedFile(null);
      alert('파일이 업로드되었습니다.');
    } catch (error) {
      alert(error.response?.data?.detail || '파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileDelete = (fileId) => {
    if (window.confirm('파일을 삭제하시겠습니까?')) {
      deleteFileMutation.mutate(fileId);
    }
  };

  const isAuthor = user?.id === post?.user_id;
  const isAdmin = user?.is_admin;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* Post Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{post?.title}</h1>
                {post?.category_name && (
                  <span className="px-2 py-1 text-sm font-medium rounded bg-gray-100 text-gray-700">
                    {post.category_name}
                  </span>
                )}
              </div>
            </div>
            {(isAuthor || isAdmin) && (
              <div className="flex space-x-2">
                <Link
                  to={`/posts/${id}/edit`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  수정
                </Link>
                <button
                  onClick={handleDelete}
                  className="text-red-600 hover:text-red-800"
                >
                  삭제
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-4">
              <span>{post?.author_username}</span>
              <span>조회 {post?.views}</span>
              <span>{new Date(post?.created_at).toLocaleString('ko-KR')}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLikeToggle}
                disabled={likeMutation.isLoading || unlikeMutation.isLoading}
                className={`flex items-center gap-1 px-3 py-1 rounded-full transition ${
                  post?.is_liked
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{post?.is_liked ? '❤️' : '🤍'}</span>
                <span className="font-medium">{post?.likes_count}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Post Content */}
        <div className="px-6 py-6">
          <div className="prose max-w-none whitespace-pre-wrap">
            {post?.content}
          </div>
        </div>

        {/* Files Section */}
        {(files.length > 0 || isAuthor) && (
          <div className="px-6 py-4 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">첨부파일</h3>

            {/* File List */}
            {files.length > 0 && (
              <div className="mb-4 space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">📎</span>
                      <span className="text-gray-900">{file.original_filename}</span>
                      <span className="text-sm text-gray-500">
                        ({(file.file_size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={filesAPI.downloadFile(file.id)}
                        download
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        다운로드
                      </a>
                      {(isAuthor || isAdmin) && (
                        <button
                          onClick={() => handleFileDelete(file.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* File Upload (only for author) */}
            {isAuthor && (
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <button
                  onClick={handleFileUpload}
                  disabled={!selectedFile || uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? '업로드 중...' : '업로드'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Comments Section */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            댓글 {commentsData?.data?.length || 0}
          </h2>

          {/* Comment Form */}
          {token && (
            <form onSubmit={handleCommentSubmit} className="mb-6">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="댓글을 입력하세요..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                rows="3"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={createCommentMutation.isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {createCommentMutation.isLoading ? '작성 중...' : '댓글 작성'}
                </button>
              </div>
            </form>
          )}

          {/* Comments List */}
          {commentsLoading ? (
            <p className="text-gray-500">댓글 로딩 중...</p>
          ) : (
            <div className="space-y-4">
              {commentsData?.data?.map((comment) => (
                <div key={comment.id} className="bg-white p-4 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="font-medium text-gray-900">
                        {comment.author_username}
                      </span>
                      <span className="text-gray-500">
                        {new Date(comment.created_at).toLocaleString('ko-KR')}
                      </span>
                    </div>
                    {(user?.id === comment.user_id || isAdmin) && (
                      <button
                        onClick={() => {
                          if (window.confirm('댓글을 삭제하시겠습니까?')) {
                            deleteCommentMutation.mutate(comment.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Link
          to="/"
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
        >
          목록으로
        </Link>
      </div>
    </div>
  );
}

export default PostDetail;
