import { Link } from 'react-router-dom';
import { useSeo } from '../utils/seo';

function TermsPage() {
  useSeo({
    title: '이용약관',
    description: 'Jion 서비스 이용약관',
    url: '/terms',
  });

  return (
    <div className="max-w-4xl mx-auto animate-fade-up">
      <div className="card overflow-hidden">
        <div className="px-6 sm:px-8 py-5 border-b border-ink-100">
          <h1 className="font-display text-xl font-bold text-ink-950 tracking-tight">이용약관</h1>
          <p className="text-xs text-ink-400 mt-1">최종 업데이트: 2026-03-02</p>
        </div>

        <div className="px-6 sm:px-8 py-6 text-sm text-ink-700 leading-relaxed space-y-5">
          <section>
            <h2 className="text-base font-semibold text-ink-900 mb-1.5">1. 목적</h2>
            <p>
              본 약관은 Jion 커뮤니티 서비스 이용과 관련하여 회사와 이용자의 권리, 의무 및 책임사항을
              규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink-900 mb-1.5">2. 서비스 이용</h2>
            <p>
              이용자는 관계 법령 및 본 약관을 준수하여 서비스를 이용해야 하며, 타인의 권리를 침해하거나
              서비스 운영을 방해하는 행위를 해서는 안 됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink-900 mb-1.5">3. 게시물 관리</h2>
            <p>
              이용자가 등록한 게시물의 책임은 이용자에게 있습니다. 회사는 법령 위반, 권리 침해, 스팸성
              콘텐츠 등 운영정책에 위반되는 게시물을 사전 통지 없이 제한 또는 삭제할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink-900 mb-1.5">4. 서비스 변경 및 중단</h2>
            <p>
              회사는 서비스 품질 향상 및 운영상 필요에 따라 서비스의 전부 또는 일부를 변경하거나 중단할
              수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink-900 mb-1.5">5. 책임 제한</h2>
            <p>
              회사는 천재지변, 시스템 장애 등 불가항력으로 인한 손해에 대해 책임을 지지 않으며, 이용자 간
              분쟁에 대해 법령이 정한 범위 내에서만 책임을 부담합니다.
            </p>
          </section>
        </div>

        <div className="px-6 sm:px-8 py-4 border-t border-ink-100 bg-paper-50">
          <Link to="/community" className="text-xs text-ink-500 hover:text-ink-800 transition-colors duration-200">
            커뮤니티로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default TermsPage;
