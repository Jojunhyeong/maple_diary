'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/Button';

export default function OnboardingWelcomePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen bg-app items-center justify-center px-6">
      <div className="flex flex-col items-center gap-8 text-center max-w-sm w-full">
        <div className="text-7xl">🍁</div>

        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold text-t1">Maple Diary</h1>
          <p className="text-t3 text-base leading-relaxed">
            메이플스토리 재획 수익을 기록하고<br />
            성과를 분석하는 개인용 대시보드
          </p>
        </div>

        <div className="flex flex-col gap-2 w-full text-sm text-t3">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">✓</span>
            <span>로그인 없이 바로 사용</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400">✓</span>
            <span>데이터는 내 기기에 저장</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400">✓</span>
            <span>수익·조각·소재비 자동 계산</span>
          </div>
        </div>

        <Button
          size="lg"
          fullWidth
          onClick={() => router.push('/onboarding/nickname')}
        >
          시작하기
        </Button>
      </div>
    </div>
  );
}
