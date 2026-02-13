import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { mcpServersAPI, mcpPlaygroundAPI } from '../../services/api';

function McpPlayground() {
  const { serverId: urlServerId } = useParams();
  const [selectedServerId, setSelectedServerId] = useState(urlServerId || '');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [tools, setTools] = useState([]);
  const [serverName, setServerName] = useState('');
  const [selectedTool, setSelectedTool] = useState(null);
  const [argsJson, setArgsJson] = useState('{}');
  const [result, setResult] = useState(null);

  // Fetch available servers for the selector
  const { data: serversData } = useQuery({
    queryKey: ['mcp-servers-all'],
    queryFn: () => mcpServersAPI.getServers(1, 100),
  });

  const connectMutation = useMutation({
    mutationFn: (serverId) => mcpPlaygroundAPI.connect(serverId),
    onSuccess: (response) => {
      const data = response.data;
      if (data.status === 'connected') {
        setConnectionStatus('connected');
        setTools(data.tools || []);
        setServerName(data.server_name);
        setSelectedTool(null);
        setResult(null);
        setArgsJson('{}');
      } else {
        setConnectionStatus('error');
        toast.error(data.error || '연결에 실패했습니다.');
      }
    },
    onError: (error) => {
      setConnectionStatus('error');
      toast.error(error.response?.data?.detail || '연결에 실패했습니다.');
    },
  });

  const invokeMutation = useMutation({
    mutationFn: ({ serverId, toolName, args }) =>
      mcpPlaygroundAPI.invoke(serverId, toolName, args),
    onSuccess: (response) => {
      setResult(response.data);
    },
    onError: (error) => {
      setResult({
        error: error.response?.data?.detail || '실행에 실패했습니다.',
      });
    },
  });

  // Auto-connect if serverId is in URL
  useEffect(() => {
    if (urlServerId && connectionStatus === 'disconnected') {
      setSelectedServerId(urlServerId);
      connectMutation.mutate(parseInt(urlServerId));
    }
  }, [urlServerId]);

  const handleConnect = () => {
    if (!selectedServerId) return;
    setConnectionStatus('connecting');
    setTools([]);
    setSelectedTool(null);
    setResult(null);
    connectMutation.mutate(parseInt(selectedServerId));
  };

  const handleInvoke = () => {
    if (!selectedTool || !selectedServerId) return;
    let args = {};
    try {
      args = JSON.parse(argsJson);
    } catch {
      toast.error('올바른 JSON 형식이 아닙니다.');
      return;
    }
    setResult(null);
    invokeMutation.mutate({
      serverId: parseInt(selectedServerId),
      toolName: selectedTool.name,
      args,
    });
  };

  const handleToolSelect = (tool) => {
    setSelectedTool(tool);
    setResult(null);
    // Pre-fill with empty schema
    if (tool.input_schema) {
      const schema = tool.input_schema;
      const properties = schema.properties || {};
      const defaultArgs = {};
      for (const [key, val] of Object.entries(properties)) {
        if (val.type === 'string') defaultArgs[key] = '';
        else if (val.type === 'integer' || val.type === 'number') defaultArgs[key] = 0;
        else if (val.type === 'boolean') defaultArgs[key] = false;
        else defaultArgs[key] = null;
      }
      setArgsJson(JSON.stringify(defaultArgs, null, 2));
    } else {
      setArgsJson('{}');
    }
  };

  const servers = serversData?.data?.servers || [];

  const statusColors = {
    disconnected: 'bg-ink-300',
    connecting: 'bg-amber-400 animate-pulse',
    connected: 'bg-green-500',
    error: 'bg-red-500',
  };

  const statusLabels = {
    disconnected: '미연결',
    connecting: '연결 중...',
    connected: '연결됨',
    error: '오류',
  };

  return (
    <div className="animate-fade-up">
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

      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink-950 tracking-tight">
          플레이그라운드
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          MCP 서버에 연결하고 도구를 테스트하세요
        </p>
      </div>

      {/* Connection Panel */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-2.5 h-2.5 rounded-full ${statusColors[connectionStatus]}`} />
          <span className="text-sm font-medium text-ink-700">{statusLabels[connectionStatus]}</span>
          {connectionStatus === 'connected' && serverName && (
            <span className="text-sm text-ink-500">- {serverName}</span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedServerId}
            onChange={(e) => setSelectedServerId(e.target.value)}
            className="input-field flex-1"
          >
            <option value="">MCP 서버 선택&#x2026;</option>
            {servers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name} {server.tools?.length ? `(${server.tools.length} tools)` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={handleConnect}
            disabled={!selectedServerId || connectMutation.isLoading}
            className="btn-primary whitespace-nowrap"
          >
            {connectMutation.isLoading ? '연결 중\u2026' : '연결'}
          </button>
        </div>
      </div>

      {/* Demo video + Usage info */}
      {connectionStatus === 'connected' && (() => {
        const currentServer = servers.find(s => s.id === parseInt(selectedServerId));
        return currentServer?.demo_video_url ? (
          <div className="card p-4 mb-6 flex items-center gap-3">
            <svg className="w-5 h-5 text-ink-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
            <span className="text-sm text-ink-600">사용법이 궁금하다면</span>
            <Link to={`/marketplace/servers/${currentServer.id}`} className="text-sm font-medium text-ink-900 underline underline-offset-2">
              데모 영상 보기
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <span className="badge-default text-xs">무료</span>
            </div>
          </div>
        ) : (
          <div className="card p-4 mb-6 flex items-center justify-end">
            <span className="badge-default text-xs">무료</span>
          </div>
        );
      })()}

      {/* Main Playground Area */}
      {connectionStatus === 'connected' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tools Panel (left) */}
          <div className="lg:col-span-1">
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-ink-100 bg-paper-50">
                <h2 className="text-sm font-semibold text-ink-700">
                  사용 가능한 도구 ({tools.length})
                </h2>
              </div>
              <div className="divide-y divide-ink-50">
                {tools.map((tool) => (
                  <button
                    key={tool.name}
                    onClick={() => handleToolSelect(tool)}
                    className={`w-full text-left px-4 py-3 transition-colors duration-150 ${
                      selectedTool?.name === tool.name
                        ? 'bg-ink-100'
                        : 'hover:bg-paper-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-semibold text-ink-800">{tool.name}</code>
                    </div>
                    {tool.description && (
                      <p className="text-xs text-ink-500 mt-1" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>{tool.description}</p>
                    )}
                  </button>
                ))}
                {tools.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-ink-400">
                    사용 가능한 도구가 없습니다
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Invocation Panel (right) */}
          <div className="lg:col-span-2 space-y-4">
            {selectedTool ? (
              <>
                {/* Selected tool info */}
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-base font-semibold text-ink-900 bg-paper-200 px-2.5 py-1 rounded">
                      {selectedTool.name}
                    </code>
                  </div>
                  {selectedTool.description && (
                    <p className="text-sm text-ink-600 mb-4">{selectedTool.description}</p>
                  )}

                  {/* Schema reference */}
                  {selectedTool.input_schema && (
                    <details className="mb-4">
                      <summary className="text-xs font-semibold text-ink-500 cursor-pointer hover:text-ink-700">
                        Input Schema 보기
                      </summary>
                      <pre className="mt-2 bg-ink-950 text-paper-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                        {JSON.stringify(selectedTool.input_schema, null, 2)}
                      </pre>
                    </details>
                  )}

                  {/* Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-ink-700 mb-2">
                      파라미터 (JSON)
                    </label>
                    <textarea
                      value={argsJson}
                      onChange={(e) => setArgsJson(e.target.value)}
                      className="input-field font-mono text-sm resize-y"
                      rows="5"
                      placeholder='{"key": "value"}'
                    />
                  </div>

                  {/* Execute button */}
                  <button
                    onClick={handleInvoke}
                    disabled={invokeMutation.isLoading}
                    className="btn-accent flex items-center gap-2"
                  >
                    {invokeMutation.isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-paper-300 border-t-paper-50 rounded-full animate-spin" />
                        실행 중&#x2026;
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                        </svg>
                        실행
                      </>
                    )}
                  </button>
                </div>

                {/* Result */}
                {result && (
                  <div className="card p-5 animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-ink-700">실행 결과</h3>
                      {result.execution_time_ms != null && (
                        <span className="text-xs text-ink-400 font-mono">
                          {result.execution_time_ms}ms
                        </span>
                      )}
                    </div>
                    {result.error ? (
                      <div className="px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm">
                        {result.error}
                      </div>
                    ) : (
                      <pre className="bg-ink-950 text-paper-100 rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(result.result, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="card px-6 py-16 text-center">
                <div className="text-ink-300 mb-3">
                  <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384 3.208a.75.75 0 01-1.094-.697l.979-5.707a.75.75 0 00-.18-.556L1.3 7.115a.75.75 0 01.44-1.267l5.69-.828a.75.75 0 00.463-.268L11.07 1.15a.75.75 0 011.36 0l3.178 4.602a.75.75 0 00.463.268l5.69.828a.75.75 0 01.44 1.267l-4.441 4.303a.75.75 0 00-.18.556l.979 5.707a.75.75 0 01-1.094.697l-5.384-3.208a.75.75 0 00-.762 0z" />
                  </svg>
                </div>
                <p className="text-ink-500 font-medium">왼쪽에서 도구를 선택하세요</p>
                <p className="text-ink-400 text-sm mt-1">도구를 선택하면 파라미터를 입력하고 실행할 수 있습니다</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disconnected state placeholder */}
      {connectionStatus === 'disconnected' && (
        <div className="card px-6 py-16 text-center">
          <div className="text-ink-300 mb-3">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={0.75} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
            </svg>
          </div>
          <p className="text-ink-600 font-semibold text-lg mb-1">MCP 서버에 연결하세요</p>
          <p className="text-ink-400 text-sm">위에서 서버를 선택하고 연결 버튼을 누르면 도구를 테스트할 수 있습니다</p>
        </div>
      )}
    </div>
  );
}

export default McpPlayground;
