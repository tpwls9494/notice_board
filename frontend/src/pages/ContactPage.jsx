import { Link } from 'react-router-dom';
import { useSeo } from '../utils/seo';

function ContactPage() {
  useSeo({
    title: '문의',
    description: 'Jion 서비스 문의 안내',
    url: '/contact',
  });

  return (
    <div className="max-w-4xl mx-auto animate-fade-up">
      <div className="card overflow-hidden">
        <div className="px-6 sm:px-8 py-5 border-b border-ink-100">
          <h1 className="font-display text-xl font-bold text-ink-950 tracking-tight">문의</h1>
          <p className="text-xs text-ink-400 mt-1">서비스 이용 중 문의사항을 접수할 수 있습니다.</p>
        </div>

        <div className="px-6 sm:px-8 py-6 text-sm text-ink-700 leading-relaxed space-y-5">
          <section>
            <h2 className="text-base font-semibold text-ink-900 mb-1.5">이메일 문의</h2>
            <p className="mb-1.5">아래 이메일로 문의 내용을 보내주세요.</p>
            <a
              href="mailto:tpwls9494@naver.com"
              className="inline-flex items-center text-ink-800 underline underline-offset-2 hover:text-ink-950"
            >
              tpwls9494@naver.com
            </a>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink-900 mb-1.5">응답 안내</h2>
            <p>
              접수된 문의는 순차적으로 확인하며, 영업일 기준 1~3일 이내 답변을 드리기 위해 노력합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink-900 mb-1.5">문의 작성 시 포함 정보</h2>
            <p>
              계정 정보(아이디), 문제 발생 시각, 재현 방법, 화면 캡처를 함께 보내주시면 더 빠르게 확인할 수
              있습니다.
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

export default ContactPage;
