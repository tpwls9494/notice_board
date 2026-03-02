import { Link } from 'react-router-dom';
import { useSeo } from '../utils/seo';

function PrivacyPage() {
  useSeo({
    title: '개인정보처리방침',
    description: 'Jion 서비스 개인정보처리방침',
    url: '/privacy',
  });

  return (
    <div className="max-w-4xl mx-auto animate-fade-up">
      <div className="card overflow-hidden">
        <div className="px-6 sm:px-8 py-5 border-b border-ink-100">
          <h1 className="font-display text-xl font-bold text-ink-950 tracking-tight">개인정보처리방침</h1>
          <p className="text-xs text-ink-400 mt-1">최종 업데이트: 2026-03-02</p>
        </div>

        <div className="px-6 sm:px-8 py-6 text-sm text-ink-700 leading-relaxed space-y-5">
          <section>
            <h2 className="text-base font-semibold text-ink-900 mb-1.5">1. 수집 항목</h2>
            <p>
              회원가입 및 서비스 제공을 위해 아이디, 이메일, 프로필 정보 등 최소한의 개인정보를 수집할 수
              있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink-900 mb-1.5">2. 이용 목적</h2>
            <p>
              수집된 정보는 회원 식별, 서비스 제공, 문의 응대, 서비스 개선 및 부정 이용 방지를 위해
              사용됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink-900 mb-1.5">3. 보관 및 파기</h2>
            <p>
              개인정보는 수집·이용 목적 달성 시 지체 없이 파기하며, 법령에 따라 보존이 필요한 경우 해당
              기간 동안 보관 후 파기합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink-900 mb-1.5">4. 제3자 제공</h2>
            <p>
              회사는 이용자의 동의 없이 개인정보를 외부에 제공하지 않으며, 법령에 따른 경우에 한해 예외로
              합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink-900 mb-1.5">5. 이용자 권리</h2>
            <p>
              이용자는 본인의 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있으며 관련 문의는 문의
              페이지를 통해 접수할 수 있습니다.
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

export default PrivacyPage;
