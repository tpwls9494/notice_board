import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { postsAPI, commentsAPI, likesAPI, filesAPI } from '../../services/api';
import useAuthStore from '../../stores/authStore';

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
      navigate('/community');
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
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
        <p className="text-sm text-ink-400">로딩 중&#x2026;</p>
      </div>
    );
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
    <div className="max-w-4xl mx-auto animate-fade-up">
      {/* Back Navigation */}
      <Link
        to="/community"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 mb-6 group"
        style={{ transition: 'color 0.2s ease-out' }}
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true" style={{ transition: 'transform 0.2s ease-out' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        목록으로
      </Link>

      <article className="card overflow-hidden">
        {/* Post Header */}
        <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-5 border-b border-ink-100">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              {post?.category_name && (
                <span className="badge-default text-[11px] mb-3 inline-block">
                  {post.category_name}
                </span>
              )}
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-950 tracking-tight leading-snug text-balance">
                {post?.title}
              </h1>
            </div>
            {(isAuthor || isAdmin) && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Link
                  to={`/community/posts/${id}/edit`}
                  className="btn-ghost text-sm"
                >
                  수정
                </Link>
                <button
                  onClick={handleDelete}
                  className="btn-ghost text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  삭제
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-ink-200 flex items-center justify-center">
                <span className="text-xs font-bold text-ink-600">
                  {(post?.author_username || '?')[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-800">{post?.author_username}</p>
                <div className="flex items-center gap-2 text-xs text-ink-400">
                  <span>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(post?.created_at))}</span>
                  <span className="w-0.5 h-0.5 rounded-full bg-ink-300" />
                  <span>조회 {post?.views}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleLikeToggle}
              disabled={likeMutation.isLoading || unlikeMutation.isLoading}
              aria-label={post?.is_liked ? "좋아요 취소" : "좋아요"}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium active:scale-95 ${
                post?.is_liked
                  ? 'bg-ink-100 text-ink-800 border border-ink-300 hover:bg-ink-200'
                  : 'bg-paper-200 text-ink-500 border border-ink-200 hover:bg-paper-300 hover:text-ink-700'
              }`}
              style={{ transition: 'background-color 0.2s ease-out, border-color 0.2s ease-out, color 0.2s ease-out, transform 0.2s ease-out' }}
            >
              <svg className="w-4 h-4" fill={post?.is_liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              <span>{post?.likes_count || 0}</span>
            </button>
          </div>
        </div>

        {/* Post Content */}
        <div className="px-6 sm:px-8 py-8">
          <div className="prose prose-ink max-w-none whitespace-pre-wrap text-ink-800 leading-relaxed">
            {post?.content}
          </div>
        </div>

        {/* Files Section */}
        {(files.length > 0 || isAuthor) && (
          <div className="px-6 sm:px-8 py-5 border-t border-ink-100 bg-paper-50">
            <h3 className="text-sm font-semibold text-ink-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-ink-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
              첨부파일 ({files.length})
            </h3>

            {files.length > 0 && (
              <div className="space-y-1.5 mb-4">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between px-3 py-2.5 bg-white rounded-lg border border-ink-100 group hover:border-ink-200"
                    style={{ transition: 'border-color 0.2s ease-out' }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded bg-ink-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-ink-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-ink-800 truncate">{file.original_filename}</p>
                        <p className="text-xs text-ink-400">{(file.file_size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={filesAPI.downloadFile(file.id)}
                        download
                        className="text-xs font-medium text-ink-700 hover:text-ink-900 underline underline-offset-2"
                        style={{ transition: 'color 0.2s ease-out' }}
                      >
                        다운로드
                      </a>
                      {(isAuthor || isAdmin) && (
                        <button
                          onClick={() => handleFileDelete(file.id)}
                          className="text-xs text-ink-400 hover:text-red-600"
                          style={{ transition: 'color 0.2s ease-out' }}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isAuthor && (
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="flex-1 text-sm text-ink-500
                    file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
                    file:text-sm file:font-medium
                    file:bg-ink-100 file:text-ink-700
                    hover:file:bg-ink-200 file:cursor-pointer"
                />
                <button
                  onClick={handleFileUpload}
                  disabled={!selectedFile || uploading}
                  className="btn-primary text-sm"
                >
                  {uploading ? '업로드 중\u2026' : '업로드'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Comments Section */}
        <div className="px-6 sm:px-8 py-6 border-t border-ink-100">
          <h2 className="text-sm font-semibold text-ink-700 mb-5 flex items-center gap-2">
            <svg className="w-4 h-4 text-ink-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            댓글 {commentsData?.data?.length || 0}개
          </h2>

          {/* Comment Form */}
          {token && (
            <form onSubmit={handleCommentSubmit} className="mb-6">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="댓글을 입력하세요&#x2026;"
                className="input-field resize-none"
                rows="3"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={createCommentMutation.isLoading || !comment.trim()}
                  className="btn-primary text-sm"
                >
                  {createCommentMutation.isLoading ? '작성 중\u2026' : '댓글 작성'}
                </button>
              </div>
            </form>
          )}

          {/* Comments List */}
          {commentsLoading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {commentsData?.data?.length === 0 && (
                <p className="text-center py-8 text-sm text-ink-400">아직 댓글이 없습니다</p>
              )}
              {commentsData?.data?.map((comment) => (
                <div key={comment.id} className="group px-4 py-3.5 bg-paper-50 rounded-xl hover:bg-paper-100" style={{ transition: 'background-color 0.2s ease-out' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-ink-200 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-ink-600">
                          {(comment.author_username || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-ink-800">
                        {comment.author_username}
                      </span>
                      <span className="text-xs text-ink-400">
                        {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(comment.created_at))}
                      </span>
                    </div>
                    {(user?.id === comment.user_id || isAdmin) && (
                      <button
                        onClick={() => {
                          if (window.confirm('댓글을 삭제하시겠습니까?')) {
                            deleteCommentMutation.mutate(comment.id);
                          }
                        }}
                        className="text-xs text-ink-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                        style={{ transition: 'opacity 0.2s ease-out, color 0.2s ease-out' }}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-ink-700 whitespace-pre-wrap pl-8 leading-relaxed">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

export default PostDetail;
