import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
  API_BASE_URL,
  followsAPI,
  postsAPI,
  commentsAPI,
  likesAPI,
  bookmarksAPI,
} from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { useConfirm } from '../../components/ConfirmModal';
import LoginModal from '../../components/LoginModal';
import { getAvatarInitial, resolveProfileImageUrl } from '../../utils/userProfile';
import { createMetaDescription, useSeo } from '../../utils/seo';
import { trackAnalyticsEvent } from '../../utils/analytics';
import {
  extractPlainTextFromRichContent,
  isLikelyHtml,
  sanitizeRichHtml,
} from '../../utils/richContent';

const markdownComponents = {
  h1: ({ node, ...props }) => (
    <h1 className="mb-4 text-2xl font-bold text-ink-950" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="mb-3 mt-6 text-xl font-semibold text-ink-900" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="mb-3 mt-5 text-lg font-semibold text-ink-900" {...props} />
  ),
  p: ({ node, ...props }) => (
    <p className="mb-4 whitespace-pre-wrap text-ink-800 leading-relaxed last:mb-0" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul className="mb-4 list-disc pl-6 text-ink-800 leading-relaxed" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="mb-4 list-decimal pl-6 text-ink-800 leading-relaxed" {...props} />
  ),
  li: ({ node, ...props }) => (
    <li className="mb-1" {...props} />
  ),
  a: ({ node, ...props }) => (
    <a
      className="font-medium text-ink-800 underline underline-offset-2 hover:text-ink-950"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  img: ({ node, alt, ...props }) => (
    <img
      alt={alt || '첨부 이미지'}
      loading="lazy"
      className="my-4 w-full rounded-xl border border-ink-200 bg-paper-50 object-contain"
      {...props}
    />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote className="my-4 border-l-4 border-ink-200 pl-4 text-ink-600" {...props} />
  ),
  code: ({ node, inline, ...props }) => (
    inline
      ? <code className="rounded bg-paper-200 px-1.5 py-0.5 text-sm text-ink-900" {...props} />
      : <code className="text-sm text-ink-900" {...props} />
  ),
  pre: ({ node, ...props }) => (
    <pre className="my-4 overflow-x-auto rounded-xl border border-ink-200 bg-paper-50 p-4" {...props} />
  ),
};

const RECRUIT_TYPE_LABELS = {
  PROJECT: '프로젝트',
  STUDY: '스터디',
  HACKATHON: '해커톤/공모전',
  CLUB: '동아리/커뮤니티',
  ETC: '기타',
};

const APPLICATION_STATUS_LABELS = {
  PENDING: '검토중',
  ACCEPTED: '수락',
  REJECTED: '거절',
};

const APPLICATION_STATUS_STYLES = {
  PENDING: 'bg-paper-200 text-ink-600 border border-ink-200',
  ACCEPTED: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  REJECTED: 'bg-rose-100 text-rose-700 border border-rose-200',
};

const formatRecruitDeadlineDday = (deadlineAt) => {
  if (!deadlineAt) return '-';
  const deadlineDate = new Date(deadlineAt);
  if (Number.isNaN(deadlineDate.getTime())) return '-';

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDeadline = new Date(
    deadlineDate.getFullYear(),
    deadlineDate.getMonth(),
    deadlineDate.getDate(),
  );
  const diffDays = Math.floor((startOfDeadline.getTime() - startOfToday.getTime()) / 86_400_000);

  if (diffDays < 0) return '마감';
  if (diffDays === 0) return 'D-day';
  return `D-${diffDays}`;
};

function PostDetail() {
  const { id } = useParams();
  const postId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, token } = useAuthStore();
  const [comment, setComment] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [applyLink, setApplyLink] = useState('');
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

  const applyRecruitMutation = useMutation({
    mutationFn: (payload) => postsAPI.applyRecruitPost(id, payload),
    onSuccess: () => {
      toast.success('지원이 완료되었습니다.');
      setShowApplyModal(false);
      setApplyMessage('');
      setApplyLink('');
      queryClient.invalidateQueries(['recruit-applications', id]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || '지원에 실패했습니다.');
    },
  });

  const updateRecruitApplicationStatusMutation = useMutation({
    mutationFn: ({ applicationId, nextStatus }) =>
      postsAPI.updateRecruitApplicationStatus(id, applicationId, nextStatus),
    onSuccess: () => {
      toast.success('지원 상태를 변경했습니다.');
      queryClient.invalidateQueries(['recruit-applications', id]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || '지원 상태 변경에 실패했습니다.');
    },
  });

  const post = postData?.data;
  const authorUserId = post?.user_id ?? null;
  const isAuthor = user?.id === post?.user_id;
  const isAdmin = user?.is_admin;
  const isRecruitPost = post?.post_type === 'RECRUIT';
  const recruitMeta = post?.recruit_meta || null;
  const isRecruitClosed = Boolean(
    recruitMeta
    && (
      recruitMeta.status === 'CLOSED'
      || (recruitMeta.deadline_at && new Date(recruitMeta.deadline_at) <= new Date())
    ),
  );

  const {
    data: recruitApplicationsData,
    isLoading: recruitApplicationsLoading,
  } = useQuery({
    queryKey: ['recruit-applications', id],
    queryFn: () => postsAPI.getRecruitApplications(id),
    enabled: Boolean(token && isRecruitPost && (isAuthor || isAdmin)),
  });

  const { data: followStatusData, isLoading: followStatusLoading } = useQuery({
    queryKey: ['follow-status', authorUserId],
    queryFn: () => followsAPI.getFollowStatus(authorUserId),
    enabled: Boolean(authorUserId && token && user?.id !== authorUserId),
  });

  const followMutation = useMutation({
    mutationFn: (targetUserId) => followsAPI.followUser(targetUserId),
    onSuccess: () => {
      toast.success('팔로우했습니다.');
      queryClient.invalidateQueries(['follow-status', authorUserId]);
      queryClient.invalidateQueries(['posts']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || '팔로우에 실패했습니다.');
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: (targetUserId) => followsAPI.unfollowUser(targetUserId),
    onSuccess: () => {
      toast.success('언팔로우했습니다.');
      queryClient.invalidateQueries(['follow-status', authorUserId]);
      queryClient.invalidateQueries(['posts']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || '언팔로우에 실패했습니다.');
    },
  });

  const recruitApplications = recruitApplicationsData?.data || [];
  const isFollowingAuthor = Boolean(followStatusData?.data?.is_following);
  const isFollowActionPending = followMutation.isPending || unfollowMutation.isPending;
  const showFollowButton = Boolean(post?.user_id) && (!token || (user && user.id !== post.user_id));
  const comments = commentsData?.data || [];
  const postContent = post?.content || '';
  const isHtmlPostContent = isLikelyHtml(postContent);
  const sanitizedHtmlContent = isHtmlPostContent ? sanitizeRichHtml(postContent) : '';
  const postDescription = createMetaDescription(extractPlainTextFromRichContent(postContent));
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

  useEffect(() => {
    if (!post?.id || post?.category_slug !== 'dev-news') return;
    trackAnalyticsEvent('dev_news_post_view', {
      post_id: post.id,
      category_slug: post.category_slug,
    });
  }, [post?.id, post?.category_slug]);

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

  const handleOpenApplyModal = () => {
    if (!token) {
      setShowLoginModal(true);
      return;
    }
    if (isRecruitClosed) {
      toast.error('마감된 모집입니다.');
      return;
    }
    setShowApplyModal(true);
  };

  const handleApplySubmit = (event) => {
    event.preventDefault();
    if (!applyMessage.trim()) {
      toast.error('지원 메시지를 입력해주세요.');
      return;
    }
    applyRecruitMutation.mutate({
      message: applyMessage.trim(),
      link: applyLink.trim() || null,
    });
  };

  const handleUpdateApplicationStatus = async (applicationId, nextStatus) => {
    const statusLabel = nextStatus === 'ACCEPTED' ? '수락' : '거절';
    const ok = await confirm({
      title: `지원 ${statusLabel}`,
      message: `해당 지원을 ${statusLabel}하시겠습니까?`,
      confirmText: statusLabel,
    });
    if (!ok) return;
    updateRecruitApplicationStatusMutation.mutate({ applicationId, nextStatus });
  };

  const handleFollowToggle = () => {
    if (!authorUserId) return;
    if (!token) {
      setShowLoginModal(true);
      return;
    }

    if (isFollowingAuthor) {
      unfollowMutation.mutate(authorUserId);
    } else {
      followMutation.mutate(authorUserId);
    }
  };

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

              {isRecruitPost && recruitMeta && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-ink-100 text-ink-700 border border-ink-200">
                      {RECRUIT_TYPE_LABELS[recruitMeta.recruit_type] || recruitMeta.recruit_type}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                      recruitMeta.status === 'OPEN'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-rose-100 text-rose-700 border-rose-200'
                    }`}
                    >
                      {recruitMeta.status === 'OPEN' ? '모집중' : '마감'}
                    </span>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-paper-200 text-ink-600 border border-ink-200">
                      {recruitMeta.is_online ? '온라인' : '오프라인'}
                    </span>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                      {formatRecruitDeadlineDday(recruitMeta.deadline_at)}
                    </span>
                  </div>
                  <div className="text-xs text-ink-500 space-y-1">
                    <p>일정: {recruitMeta.schedule_text}</p>
                    {!recruitMeta.is_online && recruitMeta.location_text && (
                      <p>장소: {recruitMeta.location_text}</p>
                    )}
                    <p>모집 인원: 최대 {recruitMeta.headcount_max}명</p>
                    <p>
                      마감일:{' '}
                      {recruitMeta.deadline_at
                        ? new Intl.DateTimeFormat('ko-KR', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(recruitMeta.deadline_at))
                        : '-'}
                    </p>
                  </div>
                </div>
              )}
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
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink-800">{post.author_username}</p>
                  {showFollowButton && (
                    <button
                      type="button"
                      onClick={handleFollowToggle}
                      disabled={isFollowActionPending || followStatusLoading}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                        isFollowingAuthor
                          ? 'bg-ink-100 text-ink-700 border-ink-300 hover:bg-ink-200'
                          : 'bg-white text-ink-600 border-ink-200 hover:bg-paper-100'
                      }`}
                    >
                      {isFollowActionPending
                        ? '처리 중...'
                        : isFollowingAuthor
                          ? '팔로잉'
                          : '팔로우'}
                    </button>
                  )}
                </div>
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
                onClick={handleXShare}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-ink-950 text-white border border-ink-900 hover:bg-ink-900 active:scale-95"
              >
                <span className="text-xs font-bold">X</span>
                <span>트위터</span>
              </button>

              {isRecruitPost && !isAuthor && (
                <button
                  onClick={handleOpenApplyModal}
                  disabled={applyRecruitMutation.isPending || isRecruitClosed}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border active:scale-95 ${
                    isRecruitClosed
                      ? 'bg-paper-200 text-ink-400 border-ink-200 cursor-not-allowed'
                      : 'bg-ink-900 text-paper-50 border-ink-900 hover:bg-ink-800'
                  }`}
                >
                  <span>{isRecruitClosed ? '모집 마감' : '지원하기'}</span>
                </button>
              )}

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
          {isHtmlPostContent ? (
            <div
              className="rich-content max-w-none text-ink-800 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizedHtmlContent }}
            />
          ) : (
            <div className="max-w-none text-ink-800 leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {postContent}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {isRecruitPost && (isAuthor || isAdmin) && (
          <div className="px-6 sm:px-8 py-6 border-t border-ink-100">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-sm font-semibold text-ink-700">
                지원 현황 {recruitApplications.length}건
              </h2>
              <span className="text-xs text-ink-400">
                수락/거절은 작성자만 가능합니다.
              </span>
            </div>

            {recruitApplicationsLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
              </div>
            ) : recruitApplications.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-6">아직 지원자가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {recruitApplications.map((application) => (
                  <div key={application.id} className="rounded-xl border border-ink-200 bg-paper-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-800">
                          {application.applicant_username || `사용자 #${application.applicant_id}`}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-400">
                          {new Intl.DateTimeFormat('ko-KR', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(application.created_at))}
                        </p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        APPLICATION_STATUS_STYLES[application.status] || APPLICATION_STATUS_STYLES.PENDING
                      }`}
                      >
                        {APPLICATION_STATUS_LABELS[application.status] || application.status}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">
                      {application.message}
                    </p>
                    {application.link && (
                      <a
                        href={application.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex text-xs text-ink-600 underline underline-offset-2 hover:text-ink-900"
                      >
                        첨부 링크 열기
                      </a>
                    )}

                    {application.status === 'PENDING' && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateApplicationStatus(application.id, 'ACCEPTED')}
                          disabled={updateRecruitApplicationStatusMutation.isPending}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          수락
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateApplicationStatus(application.id, 'REJECTED')}
                          disabled={updateRecruitApplicationStatusMutation.isPending}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          거절
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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

      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="지원 모달 닫기"
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setShowApplyModal(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-ink-200 bg-white shadow-soft-lg p-5 sm:p-6 animate-scale-in">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-ink-900">모집 지원</h3>
                <p className="mt-1 text-xs text-ink-500">
                  간단한 소개와 포트폴리오 링크를 남겨주세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="text-ink-400 hover:text-ink-700"
                aria-label="닫기"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-3">
              <div>
                <label htmlFor="apply-message" className="block text-xs font-semibold text-ink-600 mb-1.5">
                  지원 메시지 <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="apply-message"
                  rows={5}
                  value={applyMessage}
                  onChange={(event) => setApplyMessage(event.target.value)}
                  className="input-field resize-none"
                  placeholder="본인 소개, 관심 분야, 참여 가능 시간을 적어주세요."
                  required
                />
              </div>

              <div>
                <label htmlFor="apply-link" className="block text-xs font-semibold text-ink-600 mb-1.5">
                  포트폴리오/깃허브 링크 (선택)
                </label>
                <input
                  id="apply-link"
                  type="url"
                  value={applyLink}
                  onChange={(event) => setApplyLink(event.target.value)}
                  className="input-field"
                  placeholder="https://..."
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="btn-secondary text-sm"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={applyRecruitMutation.isPending}
                  className="btn-primary text-sm"
                >
                  {applyRecruitMutation.isPending ? '지원 중...' : '지원 제출'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
