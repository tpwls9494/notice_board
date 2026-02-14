import { Link } from 'react-router-dom';

function EmptyState() {
  return (
    <div className="card px-6 py-16 text-center">
      <div className="text-ink-300 mb-3">
        <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <p className="text-ink-500 font-medium">게시글이 없습니다</p>
      <p className="text-ink-400 text-sm mt-1 mb-4">첫 번째 게시글을 작성해보세요</p>
      <div className="flex items-center justify-center gap-2">
        <Link to="/posts/new" className="btn-primary text-sm">
          글쓰기
        </Link>
      </div>
    </div>
  );
}

export default EmptyState;
