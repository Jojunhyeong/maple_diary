'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/shared/ui/Button';

export default function LoginPage() {
  return (
    <div className="flex flex-col min-h-screen bg-app items-center justify-center px-6">
      <div className="flex flex-col items-center gap-8 text-center max-w-sm w-full">
        <div className="text-7xl">🍁</div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-t1">로그인</h1>
          <p className="text-t3 text-sm">로그인하면 여러 기기에서 데이터를 동기화할 수 있어요</p>
        </div>

        <button
          onClick={() => signIn('kakao', { callbackUrl: '/dashboard' })}
          className="w-full flex items-center justify-center gap-3 bg-[#FEE500] text-[#191919] font-semibold py-3.5 rounded-xl text-sm cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.305 0.5 0.5 3.472 0.5 7.125c0 2.34 1.553 4.392 3.9 5.572l-.99 3.69a.281.281 0 0 0 .432.307L7.9 14.18A10.44 10.44 0 0 0 9 14.25c4.695 0 8.5-2.972 8.5-6.625S13.695.5 9 .5z" fill="#191919"/>
          </svg>
          카카오로 시작하기
        </button>

        <Button variant="ghost" onClick={() => window.history.back()}>
          나중에 하기
        </Button>
      </div>
    </div>
  );
}
