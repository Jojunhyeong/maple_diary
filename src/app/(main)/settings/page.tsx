'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { useTheme } from '@/shared/ui/ThemeProvider';
import { CharacterManager } from '@/shared/ui/CharacterManager';

export default function SettingsPage() {
  const router = useRouter();
  const { setTheme, isDark } = useTheme();
  const { data: session, status } = useSession();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(isDark());
  }, [isDark]);

  const handleThemeToggle = (toDark: boolean) => {
    setTheme(toDark ? 'dark' : 'light');
    setDark(toDark);
  };

  const handleResetOnboarding = async () => {
    if (!confirm('온보딩을 다시 시작하면 로컬 설정이 초기화됩니다. 계속하시겠습니까?')) return;
    localStorage.removeItem('maple_diary:onboarding_done');
    localStorage.removeItem('maple_diary:user_profile');
    localStorage.removeItem('maple_diary:characters');
    localStorage.removeItem('maple_diary:active_character_id');
    localStorage.removeItem('maple_diary:settings');
    localStorage.removeItem('maple_diary:local_owner_id');
    localStorage.removeItem('maple_diary:migrated');
    if (session) {
      await signOut({ redirect: false });
    }
    router.replace('/onboarding');
  };

  return (
    <main className="maple-fade-up flex flex-col gap-5 px-4 pt-6 pb-4">
      <div>
        <h1 className="maple-title text-2xl font-bold text-t1">설정</h1>
        <p className="mt-1 text-xs text-t3">메이플 다이어리 계정/테마/데이터를 관리합니다</p>
      </div>

      {/* 계정 */}
      <Card>
        <p className="text-sm font-semibold text-t2 mb-3">계정</p>
        {status === 'loading' ? (
          <p className="text-sm text-t3">불러오는 중...</p>
        ) : session ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {session.user.image && (
                <Image
                  src={session.user.image}
                  alt="프로필"
                  width={36}
                  height={36}
                  className="rounded-full"
                />
              )}
              <div>
                <p className="text-sm font-semibold text-t1">{session.user.name}</p>
                <p className="text-xs text-t3">카카오 로그인</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/dashboard' })}
              className="text-xs text-red-400 font-medium cursor-pointer"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-t1">로그인하지 않음</p>
              <p className="text-xs text-t3 mt-0.5">로그인하면 기기 간 동기화 가능</p>
            </div>
            <button
              onClick={() => signIn('kakao', { callbackUrl: '/dashboard' })}
              className="text-xs text-amber-500 font-semibold cursor-pointer"
            >
              카카오 로그인
            </button>
          </div>
        )}
      </Card>

      <CharacterManager />

      {/* 화면 테마 */}
      <Card>
        <p className="text-sm font-semibold text-t2 mb-4">화면 테마</p>
        <div className="flex gap-3">
          <button
            onClick={() => handleThemeToggle(false)}
            className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-all cursor-pointer ${
              !dark ? 'border-amber-500 bg-amber-500 text-white shadow-[0_10px_18px_rgba(245,158,11,0.25)]' : 'border-line bg-surface text-t2 hover:bg-surface/70'
            }`}
          >
            ☀️ 라이트
          </button>
          <button
            onClick={() => handleThemeToggle(true)}
            className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-all cursor-pointer ${
              dark ? 'border-amber-500 bg-amber-500 text-white shadow-[0_10px_18px_rgba(245,158,11,0.25)]' : 'border-line bg-surface text-t2 hover:bg-surface/70'
            }`}
          >
            🌙 다크
          </button>
        </div>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-t2 mb-4">데이터 관리</p>
        <Button variant="secondary" onClick={handleResetOnboarding}>
          온보딩 다시 시작
        </Button>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-t2 mb-2">앱 정보</p>
        <p className="text-xs text-t3">Maple Diary v0.1.0</p>
        <p className="text-xs text-t3 mt-1">메이플스토리 재획 수익 추적 대시보드</p>
      </Card>
    </main>
  );
}
