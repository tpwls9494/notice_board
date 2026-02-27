import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { mcpServersAPI, mcpReviewsAPI } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { useConfirm } from '../../components/ConfirmModal';
import { getAvatarInitial, resolveProfileImageUrl } from '../../utils/userProfile';

// --- Inline SVG Icon Map (no library needed) ---
const ICONS = {
  'folder-search': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  'edit': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  ),
  'zap': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  'database': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  ),
  'globe': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  'users': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  'shield': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  'clock': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

function HighlightIcon({ name }) {
  return ICONS[name] || ICONS['zap'];
}

function McpDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [activeGuideClient, setActiveGuideClient] = useState(null);
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [visibleSteps, setVisibleSteps] = useState(1);
  const [expandedTools, setExpandedTools] = useState({});
  const confirm = useConfirm();

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
      toast.error(error.response?.data?.detail || '리뷰 작성에 실패했습니다.');
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId) => mcpReviewsAPI.deleteReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries(['mcp-reviews', id]);
      queryClient.invalidateQueries(['mcp-server', id]);
    },
  });

  // Parse showcase_data
  const showcase = useMemo(() => {
    if (!serverData?.data?.showcase_data) return null;
    try {
      return JSON.parse(serverData.data.showcase_data);
    } catch {
      return null;
    }
  }, [serverData]);

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
  const highlights = showcase?.highlights || [];
  const useCases = showcase?.use_cases || [];
  const scenarios = showcase?.scenarios || [];

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
      toast.success('클립보드에 복사되었습니다.');
    });
  };

  const toggleToolOutput = (toolId) => {
    setExpandedTools(prev => ({ ...prev, [toolId]: !prev[toolId] }));
  };

  const parseSampleOutput = (sampleOutput) => {
    if (!sampleOutput) return null;
    try {
      const parsed = JSON.parse(sampleOutput);
      return parsed?.content?.[0]?.text || JSON.stringify(parsed, null, 2);
    } catch {
      return sampleOutput;
    }
  };

  const tabs = [
    { key: 'overview', label: '개요' },
    ...(scenarios.length > 0 ? [{ key: 'scenarios', label: '시나리오 체험' }] : []),
    ...(server.demo_video_url ? [{ key: 'demo', label: '데모' }] : []),
    { key: 'tools', label: `도구 (${server.tools?.length || 0})` },
    { key: 'install', label: '설치 가이드' },
    { key: 'reviews', label: `리뷰 (${server.review_count || 0})` },
  ];

  return (
    <div className="max-w-4xl mx-auto animate-fade-up">
      {/* Back Navigation */}
      <Link
        to="/marketplace"
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
              to={`/marketplace/playground/${server.id}`}
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
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="animate-fade-in">
              {/* Description */}
              <div className="prose prose-ink max-w-none text-ink-800 leading-relaxed whitespace-pre-wrap mb-8">
                {server.github_readme || server.description}
              </div>

              {/* Highlights */}
              {highlights.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-4">
                    주요 기능
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {highlights.map((h, i) => (
                      <div key={i} className="p-4 bg-paper-50 rounded-xl border border-ink-100">
                        <div className="w-9 h-9 rounded-lg bg-ink-100 flex items-center justify-center mb-3 text-ink-600">
                          <HighlightIcon name={h.icon} />
                        </div>
                        <h4 className="font-semibold text-ink-900 text-sm mb-1">{h.title}</h4>
                        <p className="text-xs text-ink-500 leading-relaxed">{h.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Use Cases */}
              {useCases.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-4">
                    이런 분께 추천합니다
                  </h3>
                  <div className="space-y-3">
                    {useCases.map((uc, i) => (
                      <div key={i} className="flex items-start gap-4 p-4 bg-paper-50 rounded-xl border border-ink-100">
                        <span className="badge-default text-[11px] flex-shrink-0 mt-0.5">{uc.persona}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-ink-700">{uc.scenario}</p>
                        </div>
                        <span className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap">
                          {uc.benefit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scenario Showcase Tab */}
          {activeTab === 'scenarios' && (
            <div className="animate-fade-in">
              {scenarios.length === 0 ? (
                <p className="text-center py-8 text-sm text-ink-400">등록된 시나리오가 없습니다</p>
              ) : (
                <div className="space-y-6">
                  {/* Scenario selector */}
                  {scenarios.length > 1 && (
                    <div className="flex gap-2">
                      {scenarios.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => { setCurrentScenarioIndex(i); setVisibleSteps(1); }}
                          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                            currentScenarioIndex === i
                              ? 'bg-ink-950 text-paper-50'
                              : 'bg-paper-200 text-ink-600 hover:bg-paper-300'
                          }`}
                        >
                          {s.title}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Active scenario */}
                  {(() => {
                    const currentScenario = scenarios[currentScenarioIndex];
                    if (!currentScenario) return null;

                    return (
                      <div>
                        <h3 className="font-semibold text-ink-900 text-lg mb-1">
                          {currentScenario.title}
                        </h3>
                        <p className="text-sm text-ink-500 mb-6">{currentScenario.description}</p>

                        {/* Steps timeline */}
                        <div className="relative pl-7 border-l-2 border-ink-200 space-y-6">
                          {currentScenario.steps.slice(0, visibleSteps).map((step, stepIdx) => {
                            const toolData = server.tools?.find(t => t.name === step.tool_name);
                            const outputText = parseSampleOutput(toolData?.sample_output);

                            return (
                              <div key={stepIdx} className="relative animate-fade-up" style={{ animationDelay: `${stepIdx * 100}ms` }}>
                                {/* Timeline dot */}
                                <div className="absolute -left-[calc(0.875rem+1px)] top-0 w-4 h-4 rounded-full bg-ink-950 border-2 border-white" />

                                {/* Narration */}
                                <div className="mb-3">
                                  <span className="text-xs font-semibold text-ink-400 uppercase tracking-wider">
                                    Step {stepIdx + 1}
                                  </span>
                                  <p className="text-sm font-medium text-ink-800 mt-1">
                                    {step.narration}
                                  </p>
                                </div>

                                {/* Tool call */}
                                <div className="bg-ink-950 rounded-lg p-3 mb-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Tool Call</span>
                                    <code className="text-xs text-green-400 font-mono">
                                      {step.tool_name}
                                    </code>
                                  </div>
                                  <pre className="text-xs text-paper-300 font-mono overflow-x-auto">
                                    {JSON.stringify(step.sample_args, null, 2)}
                                  </pre>
                                </div>

                                {/* Output */}
                                {outputText && (
                                  <div className="bg-paper-50 border border-ink-100 rounded-lg p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-2">
                                      실행 결과
                                    </p>
                                    <pre className="text-xs text-ink-700 font-mono whitespace-pre-wrap overflow-x-auto">
                                      {outputText}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Next step button */}
                        {visibleSteps < currentScenario.steps.length && (
                          <button
                            onClick={() => setVisibleSteps(v => v + 1)}
                            className="mt-6 ml-7 btn-secondary text-sm flex items-center gap-2"
                          >
                            다음 단계 보기
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                            </svg>
                          </button>
                        )}

                        {/* CTA after all steps */}
                        {visibleSteps >= currentScenario.steps.length && (
                          <div className="mt-6 ml-7 p-5 bg-paper-50 rounded-xl border border-ink-100 text-center">
                            <p className="text-sm font-semibold text-ink-700 mb-3">
                              직접 체험해 보세요
                            </p>
                            <Link
                              to={`/marketplace/playground/${server.id}`}
                              className="btn-primary text-sm inline-flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                              </svg>
                              플레이그라운드에서 실행하기
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Demo Tab */}
          {activeTab === 'demo' && server.demo_video_url && (
            <div className="animate-fade-in">
              <div className="aspect-video rounded-xl overflow-hidden bg-ink-950">
                <iframe
                  src={server.demo_video_url}
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  title={`${server.name} 데모 영상`}
                />
              </div>
              <p className="text-sm text-ink-500 mt-3 text-center">
                이 MCP 서버의 사용 방법을 확인하세요
              </p>
            </div>
          )}

          {/* Tools Tab */}
          {activeTab === 'tools' && (
            <div className="animate-fade-in space-y-3">
              {server.tools?.length === 0 ? (
                <p className="text-center py-8 text-sm text-ink-400">등록된 도구가 없습니다</p>
              ) : (
                server.tools?.map((tool) => {
                  const outputText = parseSampleOutput(tool.sample_output);
                  const isExpanded = expandedTools[tool.id];

                  return (
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
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-ink-500 mb-1.5">Input Schema</p>
                          <pre className="bg-ink-950 text-paper-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                            {JSON.stringify(JSON.parse(tool.input_schema), null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Sample Output */}
                      {outputText && (
                        <div>
                          <button
                            onClick={() => toggleToolOutput(tool.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-700 transition-colors"
                          >
                            <svg
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                            예시 출력
                          </button>
                          {isExpanded && (
                            <pre className="mt-2 bg-paper-100 border border-ink-100 text-ink-700 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap animate-fade-in">
                              {outputText}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
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
                  {reviews.map((review) => {
                    const reviewProfileImageUrl = resolveProfileImageUrl(review.author_profile_image_url);

                    return (
                      <div key={review.id} className="group p-4 bg-paper-50 rounded-xl" style={{ transition: 'background-color 0.2s ease-out' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-ink-200 overflow-hidden flex items-center justify-center">
                              {reviewProfileImageUrl ? (
                                <img
                                  src={reviewProfileImageUrl}
                                  alt={`${review.author_username || '작성자'} 프로필`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[10px] font-bold text-ink-600">
                                  {getAvatarInitial(review.author_username)}
                                </span>
                              )}
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
                              onClick={async () => {
                                if (await confirm({ title: '리뷰 삭제', message: '리뷰를 삭제하시겠습니까?', confirmText: '삭제' })) {
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
                    );
                  })}
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
