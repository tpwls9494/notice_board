import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useRef } from 'react';
import { toast } from 'sonner';

import {
  API_BASE_URL,
  postsAPI,
  commentsAPI,
  likesAPI,
  filesAPI,
  bookmarksAPI,
} from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { useConfirm } from '../../components/ConfirmModal';
import LoginModal from '../../components/LoginModal';
import { getAvatarInitial, resolveProfileImageUrl } from '../../utils/userProfile';
import { createMetaDescription, useSeo } from '../../utils/seo';

function PostDetail() {
  const { id } = useParams();
  const postId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, token } = useAuthStore();
  const [comment, setComment] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const confirm = useConfirm();
  const commentInputRef = useRef(null);

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
      toast.success('게시글을 삭제했습니다.');
      navigate('/community');
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || '게시글 삭제에 실패했습니다.');
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: (content) => commentsAPI.createComment({ post_id: postId, content }),
    onSuccess: () => {
      queryClient.invalidateQueries(['comments', id]);
      queryClient.invalidateQueries(['post', id]);
      setComment('');
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || '댓글 작성에 실패했습니다.');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId) => commentsAPI.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries(['comments', id]);
      queryClient.invalidateQueries(['post', id]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || '댓글 삭제에 실패했습니다.');
    },
  });

  const likeMutation = useMutation({
    mutationFn: () => likesAPI.likePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['post', id]);
      queryClient.invalidateQueries(['notifications-unread-count']);
      queryClient.invalidateQueries(['my-notifications']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || '좋아요에 실패했습니다.');
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: () => likesAPI.unlikePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['post', id]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || '좋아요 취소에 실패했습니다.');
    },
  });

  const toggleBookmarkMutation = useMutation({
    mutationFn: (nextBookmarked) => (
      nextBookmarked
        ? bookmarksAPI.createBookmark(id)
        : bookmarksAPI.deleteBookmark(id)
    ),
    onMutate: async (nextBookmarked) => {
      await queryClient.cancelQueries(['post', id]);
      const previousPost = queryClient.getQueryData(['post', id]);

      queryClient.setQueryData(['post', id], (cached) => {
        if (!cached?.data) return cached;
        return {
          ...cached,
          data: {
            ...cached.data,
            is_bookmarked: nextBookmarked,
          },
        };
      });

      return { previousPost };
    },
    onSuccess: (_, nextBookmarked) => {
      queryClient.invalidateQueries(['my-bookmarks']);
      toast.success(nextBookmarked ? '북마크에 추가했습니다.' : '북마크를 해제했습니다.');
    },
    onError: (error, _, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(['post', id], context.previousPost);
      }
      toast.error(error.response?.data?.detail || '북마크 처리에 실패했습니다.');
    },
    onSettled: () => {
      queryClient.invalidateQueries(['post', id]);
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId) => filesAPI.deleteFile(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries(['files', id]);
      toast.success('첨부파일을 삭제했습니다.');
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || '첨부파일 삭제에 실패했습니다.');
    },
  });

  const post = postData?.data;
  const files = filesData?.data || [];
  const comments = commentsData?.data || [];
  const postDescription = createMetaDescription(post?.content || '');
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicPostUrl = post ? `${currentOrigin}/posts/${post.id}` : `${currentOrigin}/posts/${postId}`;
  const sharePreviewUrl = post ? `${currentOrigin}/share/posts/${post.id}` : `${currentOrigin}/share/posts/${postId}`;
  const ogImageUrl = `${API_BASE_URL}/api/v1/seo/og/posts/${postId}.svg`;

  useSeo({
    title: post?.title || '게시글',
    description: postDescription,
    url: post ? `/posts/${post.id}` : `/posts/${postId}`,
    image: ogImageUrl,
    type: 'article',
  });

  if (postLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
        <p className="text-sm text-ink-400">게시글을 불러오는 중입니다.</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="card p-8 text-center">
        <p className="text-ink-600">게시글을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const postProfileImageUrl = resolveProfileImageUrl(post.author_profile_image_url);

  const handleDelete = async () => {
    const ok = await confirm({
      title: '게시글 삭제',
      message: '게시글을 삭제하시겠습니까?',
      confirmText: '삭제',
    });
    if (ok) {
      deletePostMutation.mutate();
    }
  };

  const handleCommentSubmit = (event) => {
    event.preventDefault();
    if (!comment.trim()) return;
    createCommentMutation.mutate(comment.trim());
  };

  const handleLikeToggle = () => {
    if (!token) {
      setShowLoginModal(true);
      return;
    }

    if (post.is_liked) {
      unlikeMutation.mutate();
    } else {
      likeMutation.mutate();
    }
  };

  const handleBookmarkToggle = () => {
    if (!token) {
      setShowLoginModal(true);
      return;
    }

    toggleBookmarkMutation.mutate(!post.is_bookmarked);
  };

  const handleFileDelete = async (fileId) => {
    const ok = await confirm({
      title: '첨부파일 삭제',
      message: '첨부파일을 삭제하시겠습니까?',
      confirmText: '삭제',
    });
    if (ok) {
      deleteFileMutation.mutate(fileId);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicPostUrl);
      toast.success('게시글 링크를 복사했습니다.');
    } catch (_error) {
      toast.error('링크 복사에 실패했습니다.');
    }
  };

  const handleXShare = () => {
    const shareText = `${post?.title || '게시글'} | jion community`;
    const shareIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(sharePreviewUrl)}`;
    window.open(shareIntent, '_blank', 'noopener,noreferrer,width=640,height=720');
  };

  const handleKakaoShare = () => {
    const shareIntent = `https://story.kakao.com/share?url=${encodeURIComponent(sharePreviewUrl)}`;
    window.open(shareIntent, '_blank', 'noopener,noreferrer,width=540,height=720');
  };

  const isAuthor = user?.id === post.user_id;
  const isAdmin = user?.is_admin;

  return (
    <div className="max-w-4xl mx-auto animate-fade-up">
      <Link
        to="/community"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 mb-6 group"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        목록으로
      </Link>

      <article className="card overflow-hidden">
        <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-5 border-b border-ink-100">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              {post.category_name && (
                <span className="badge-default text-[11px] mb-3 inline-block">
                  {post.category_name}
                </span>
              )}
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-950 tracking-tight leading-snug text-balance">
                {post.title}
              </h1>
            </div>

            {(isAuthor || isAdmin) && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Link to={`/posts/${id}/edit`} className="btn-ghost text-sm">
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
              <div className="w-8 h-8 rounded-full bg-ink-200 overflow-hidden flex items-center justify-center">
                {postProfileImageUrl ? (
                  <img
                    src={postProfileImageUrl}
                    alt={`${post.author_username || '작성자'} 프로필`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold text-ink-600">
                    {getAvatarInitial(post.author_username)}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-800">{post.author_username}</p>
                <div className="flex items-center gap-2 text-xs text-ink-400">
                  <span>
                    {new Intl.DateTimeFormat('ko-KR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(post.created_at))}
                  </span>
                  <span className="w-0.5 h-0.5 rounded-full bg-ink-300" />
                  <span>조회 {post.views}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-white text-ink-600 border border-ink-200 hover:bg-paper-100 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 010 6.364l-1.59 1.59a4.5 4.5 0 01-6.364-6.364l1.591-1.59m6.363 6.364a4.5 4.5 0 010-6.364l1.59-1.59a4.5 4.5 0 016.364 6.364l-1.59 1.59" />
                </svg>
                <span>링크복사</span>
              </button>

              <button
                onClick={handleKakaoShare}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-[#FEE500] text-[#1f1f1f] border border-[#F2DA00] hover:brightness-95 active:scale-95"
              >
                <span className="text-xs font-extrabold">K</span>
                <span>카카오</span>
              </button>

              <button
                onClick={handleXShare}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-ink-950 text-white border border-ink-900 hover:bg-ink-900 active:scale-95"
              >
                <span className="text-xs font-bold">X</span>
                <span>트위터</span>
              </button>

              <button
                onClick={handleBookmarkToggle}
                disabled={toggleBookmarkMutation.isPending}
                aria-label={post.is_bookmarked ? '북마크 해제' : '북마크 추가'}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium active:scale-95 ${
                  post.is_bookmarked
                    ? 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200'
                    : 'bg-paper-200 text-ink-500 border border-ink-200 hover:bg-paper-300 hover:text-ink-700'
                }`}
              >
                <svg className="w-4 h-4" fill={post.is_bookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 3.75H6.75A2.25 2.25 0 004.5 6v14.25a.75.75 0 001.219.585L12 15.75l6.281 5.085a.75.75 0 001.219-.585V6a2.25 2.25 0 00-2.25-2.25z" />
                </svg>
                <span>북마크</span>
              </button>

              <button
                onClick={handleLikeToggle}
                disabled={likeMutation.isPending || unlikeMutation.isPending}
                aria-label={post.is_liked ? '좋아요 취소' : '좋아요'}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium active:scale-95 ${
                  post.is_liked
                    ? 'bg-ink-100 text-ink-800 border border-ink-300 hover:bg-ink-200'
                    : 'bg-paper-200 text-ink-500 border border-ink-200 hover:bg-paper-300 hover:text-ink-700'
                }`}
              >
                <svg className="w-4 h-4" fill={post.is_liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                <span>{post.likes_count || 0}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-8">
          <div className="prose prose-ink max-w-none whitespace-pre-wrap text-ink-800 leading-relaxed">
            {post.content}
          </div>
        </div>

        {files.length > 0 && (
          <div className="px-6 sm:px-8 py-5 border-t border-ink-100 bg-paper-50">
            <h3 className="text-sm font-semibold text-ink-700 mb-3">첨부파일 ({files.length})</h3>
            <div className="space-y-1.5">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between px-3 py-2.5 bg-white rounded-lg border border-ink-100 group hover:border-ink-200"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ink-800 truncate">{file.original_filename}</p>
                    <p className="text-xs text-ink-400">{(file.file_size / 1024).toFixed(1)} KB</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={filesAPI.downloadFile(file.id)}
                      download
                      className="text-xs font-medium text-ink-700 hover:text-ink-900 underline underline-offset-2"
                    >
                      다운로드
                    </a>
                    {(isAuthor || isAdmin) && (
                      <button
                        onClick={() => handleFileDelete(file.id)}
                        className="text-xs text-ink-400 hover:text-red-600"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 sm:px-8 py-6 border-t border-ink-100">
          <h2 className="text-sm font-semibold text-ink-700 mb-5">댓글 {comments.length}개</h2>

          {token ? (
            <form onSubmit={handleCommentSubmit} className="mb-6">
              <textarea
                ref={commentInputRef}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="댓글을 입력하세요..."
                className="input-field resize-none"
                rows="3"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={createCommentMutation.isPending || !comment.trim()}
                  className="btn-primary text-sm"
                >
                  {createCommentMutation.isPending ? '등록 중...' : '댓글 등록'}
                </button>
              </div>
            </form>
          ) : (
            <div className="mb-6">
              <textarea
                onClick={() => setShowLoginModal(true)}
                placeholder="댓글을 작성하려면 로그인하세요"
                className="input-field resize-none cursor-pointer"
                rows="3"
                readOnly
              />
            </div>
          )}

          {commentsLoading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {comments.length === 0 && (
                <p className="text-center py-8 text-sm text-ink-400">댓글이 없습니다.</p>
              )}

              {comments.map((item) => {
                const commentProfileImageUrl = resolveProfileImageUrl(item.author_profile_image_url);
                return (
                  <div key={item.id} className="group px-4 py-3.5 bg-paper-50 rounded-xl hover:bg-paper-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-ink-200 overflow-hidden flex items-center justify-center">
                          {commentProfileImageUrl ? (
                            <img
                              src={commentProfileImageUrl}
                              alt={`${item.author_username || '작성자'} 프로필`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] font-bold text-ink-600">
                              {getAvatarInitial(item.author_username)}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-ink-800">{item.author_username}</span>
                        <span className="text-xs text-ink-400">
                          {new Intl.DateTimeFormat('ko-KR', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(item.created_at))}
                        </span>
                      </div>

                      {(user?.id === item.user_id || isAdmin) && (
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: '댓글 삭제',
                              message: '댓글을 삭제하시겠습니까?',
                              confirmText: '삭제',
                            });
                            if (ok) {
                              deleteCommentMutation.mutate(item.id);
                            }
                          }}
                          className="text-xs text-ink-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                        >
                          삭제
                        </button>
                      )}
                    </div>

                    <p className="text-sm text-ink-700 whitespace-pre-wrap pl-8 leading-relaxed">
                      {item.content}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </article>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={() => {
          setShowLoginModal(false);
          setTimeout(() => {
            commentInputRef.current?.focus();
          }, 100);
        }}
      />
    </div>
  );
}

export default PostDetail;
