import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { mcpServersAPI, mcpReviewsAPI } from '../../services/api';
import useAuthStore from '../../stores/authStore';

function McpDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState('description');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [activeGuideClient, setActiveGuideClient] = useState(null);

  const { data: serverData, isLoading } = useQuery({
    queryKey: ['mcp-server', id],
    queryFn: () => mcpServersAPI.getServer(id),
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['mcp-reviews', id],
    queryFn: () => mcpReviewsAPI.getReviews(id),
    enabled: activeTab === 'reviews',
  });

  const createReviewMutation = useMutation({
    mutationFn: (data) => mcpReviewsAPI.createReview(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['mcp-reviews', id]);
      queryClient.invalidateQueries(['mcp-server', id]);
      setReviewContent('');
      setReviewRating(5);
    },
    onError: (error) => {
      alert(error.response?.data?.detail || '리뷰 작성에 실패했습니다.');
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId) => mcpReviewsAPI.deleteReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries(['mcp-reviews', id]);
      queryClient.invalidateQueries(['mcp-server', id]);
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
        <p className="text-sm text-ink-400">로딩 중&#x2026;</p>
      </div>
    );
  }

  const server = serverData?.data;
  if (!server) return null;

  const reviews = reviewsData?.data?.reviews || [];
  const guides = server.install_guides || [];
  const currentGuide = guides.find(g => g.client_name === activeGuideClient) || guides[0];

  if (guides.length > 0 && !activeGuideClient) {
    setActiveGuideClient(guides[0].client_name);
  }

  const handleReviewSubmit = (e) => {
    e.preventDefault();
    if (!reviewContent.trim()) return;
    createReviewMutation.mutate({
      server_id: parseInt(id),
      rating: reviewRating,
      content: reviewContent.trim(),
    });
  };

  const handleCopyConfig = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('설정이 클립보드에 복사되었습니다.');
    });
  };

  const tabs = [
    { key: 'description', label: '설명' },
    { key: 'tools', label: `도구 (${server.tools?.length || 0})` },
    { key: 'install', label: '설치 가이드' },
    { key: 'reviews', label: `리뷰 (${server.review_count || 0})` },
  ];

  return (
    <div className="max-w-4xl mx-auto animate-fade-up">
      {/* Back Navigation */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 mb-6 group"
        style={{ transition: 'color 0.2s ease-out' }}
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true" style={{ transition: 'transform 0.2s ease-out' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        마켓플레이스로
      </Link>

      {/* Server Header Card */}
      <div className="card overflow-hidden mb-6">
        <div className="px-6 sm:px-8 py-6">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-3">
            {server.category_name && (
              <span className="badge-default text-[11px]">{server.category_name}</span>
            )}
            {server.is_verified && (
              <span className="badge-accent text-[11px]">검증됨</span>
            )}
            {server.is_featured && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">추천</span>
            )}
          </div>

          {/* Name */}
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-950 tracking-tight leading-snug text-balance mb-2">
            {server.name}
          </h1>

          {/* Short description */}
          <p className="text-ink-600 mb-4">
            {server.short_description || server.description?.substring(0, 200)}
          </p>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-4 mb-5">
            <div className="flex items-center gap-1.5 text-sm text-ink-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              <span className="font-semibold">{server.github_stars?.toLocaleString() || 0}</span>
              <span>GitHub Stars</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-ink-500">
              <span className="text-amber-500 text-base">&#9733;</span>
              <span className="font-semibold">{(server.avg_rating || 0).toFixed(1)}</span>
              <span>({server.review_count || 0} 리뷰)</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-ink-500">
              <span className="font-semibold">{server.tools?.length || 0}</span>
              <span>도구</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={`/playground/${server.id}`}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              플레이그라운드에서 테스트
            </Link>
            {server.github_url && (
              <a
                href={server.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 px-6 sm:px-8">
          <div className="flex items-center gap-0 -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors duration-200 ${
                  activeTab === tab.key
                    ? 'border-ink-950 text-ink-950'
                    : 'border-transparent text-ink-500 hover:text-ink-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 sm:px-8 py-6">
          {/* Description Tab */}
          {activeTab === 'description' && (
            <div className="animate-fade-in">
              <div className="prose prose-ink max-w-none text-ink-800 leading-relaxed whitespace-pre-wrap">
                {server.github_readme || server.description}
              </div>
            </div>
          )}

          {/* Tools Tab */}
          {activeTab === 'tools' && (
            <div className="animate-fade-in space-y-3">
              {server.tools?.length === 0 ? (
                <p className="text-center py-8 text-sm text-ink-400">등록된 도구가 없습니다</p>
              ) : (
                server.tools?.map((tool) => (
                  <div key={tool.id} className="p-4 bg-paper-50 rounded-xl border border-ink-100">
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-sm font-semibold text-ink-800 bg-paper-200 px-2 py-0.5 rounded">
                        {tool.name}
                      </code>
                    </div>
                    {tool.description && (
                      <p className="text-sm text-ink-600 mb-3">{tool.description}</p>
                    )}
                    {tool.input_schema && (
                      <div>
                        <p className="text-xs font-semibold text-ink-500 mb-1.5">Input Schema</p>
                        <pre className="bg-ink-950 text-paper-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                          {JSON.stringify(JSON.parse(tool.input_schema), null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Install Tab */}
          {activeTab === 'install' && (
            <div className="animate-fade-in">
              {guides.length === 0 ? (
                <p className="text-center py-8 text-sm text-ink-400">등록된 설치 가이드가 없습니다</p>
              ) : (
                <>
                  {/* Install command */}
                  {server.install_command && (
                    <div className="mb-6">
                      <p className="text-sm font-semibold text-ink-700 mb-2">설치 명령어</p>
                      <div className="flex items-center gap-2 bg-ink-950 rounded-lg p-3">
                        <code className="flex-1 text-sm font-mono text-paper-100 overflow-x-auto">
                          {server.install_command}
                        </code>
                        <button
                          onClick={() => handleCopyConfig(server.install_command)}
                          className="text-paper-300 hover:text-paper-50 flex-shrink-0"
                          aria-label="복사"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Client tabs */}
                  <div className="flex items-center gap-2 mb-4">
                    {guides.map((guide) => (
                      <button
                        key={guide.client_name}
                        onClick={() => setActiveGuideClient(guide.client_name)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                          activeGuideClient === guide.client_name
                            ? 'bg-ink-950 text-paper-50'
                            : 'bg-paper-200 text-ink-600 hover:bg-paper-300'
                        }`}
                      >
                        {guide.client_name}
                      </button>
                    ))}
                  </div>

                  {/* Selected guide */}
                  {currentGuide && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-ink-700">설정 JSON</p>
                          <button
                            onClick={() => handleCopyConfig(currentGuide.config_json)}
                            className="text-xs text-ink-500 hover:text-ink-700 flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                            </svg>
                            복사
                          </button>
                        </div>
                        <pre className="bg-ink-950 text-paper-100 rounded-lg p-4 text-sm font-mono overflow-x-auto">
                          {currentGuide.config_json}
                        </pre>
                      </div>
                      {currentGuide.instructions && (
                        <div className="p-4 bg-paper-50 rounded-xl border border-ink-100">
                          <p className="text-sm text-ink-700 whitespace-pre-wrap">{currentGuide.instructions}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className="animate-fade-in">
              {/* Review Form */}
              {token && (
                <form onSubmit={handleReviewSubmit} className="mb-6 p-4 bg-paper-50 rounded-xl border border-ink-100">
                  <p className="text-sm font-semibold text-ink-700 mb-3">리뷰 작성</p>

                  {/* Star rating input */}
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className={`text-2xl transition-colors ${
                          star <= reviewRating ? 'text-amber-400' : 'text-ink-200'
                        }`}
                        aria-label={`${star}점`}
                      >
                        &#9733;
                      </button>
                    ))}
                    <span className="text-sm text-ink-500 ml-2">{reviewRating}점</span>
                  </div>

                  <textarea
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                    placeholder="이 MCP 서버에 대한 리뷰를 작성하세요&#x2026;"
                    className="input-field resize-none mb-3"
                    rows="3"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={createReviewMutation.isLoading || !reviewContent.trim()}
                      className="btn-primary text-sm"
                    >
                      {createReviewMutation.isLoading ? '작성 중\u2026' : '리뷰 작성'}
                    </button>
                  </div>
                </form>
              )}

              {/* Reviews List */}
              {reviews.length === 0 ? (
                <p className="text-center py-8 text-sm text-ink-400">아직 리뷰가 없습니다</p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="group p-4 bg-paper-50 rounded-xl" style={{ transition: 'background-color 0.2s ease-out' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-ink-200 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-ink-600">
                              {(review.author_username || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-ink-800">{review.author_username}</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span key={star} className={`text-xs ${star <= review.rating ? 'text-amber-400' : 'text-ink-200'}`}>&#9733;</span>
                            ))}
                          </div>
                          <span className="text-xs text-ink-400">
                            {new Intl.DateTimeFormat('ko-KR').format(new Date(review.created_at))}
                          </span>
                        </div>
                        {(user?.id === review.user_id || user?.is_admin) && (
                          <button
                            onClick={() => {
                              if (window.confirm('리뷰를 삭제하시겠습니까?')) {
                                deleteReviewMutation.mutate(review.id);
                              }
                            }}
                            className="text-xs text-ink-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                            style={{ transition: 'opacity 0.2s ease-out, color 0.2s ease-out' }}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                      {review.content && (
                        <p className="text-sm text-ink-700 pl-8 whitespace-pre-wrap">{review.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default McpDetail;
