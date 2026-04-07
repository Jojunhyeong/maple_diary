'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { useTheme } from '@/shared/ui/ThemeProvider';

export default function SettingsPage() {
  const router = useRouter();
  const { setTheme, isDark } = useTheme();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(isDark());
  }, [isDark]);

  const handleThemeToggle = (toDark: boolean) => {
    setTheme(toDark ? 'dark' : 'light');
    setDark(toDark);
  };

  const profile = (() => {
    try {
      return JSON.parse(localStorage.getItem('maple_diary:user_profile') || 'null');
    } catch {
      return null;
    }
  })();

  const handleResetOnboarding = () => {
    if (!confirm('온보딩을 다시 시작하면 로컬 설정이 초기화됩니다. 계속하시겠습니까?')) return;
    localStorage.removeItem('maple_diary:onboarding_done');
    localStorage.removeItem('maple_diary:user_profile');
    localStorage.removeItem('maple_diary:settings');
    router.replace('/onboarding');
  };

  return (
    <main className="flex flex-col gap-5 px-4 pt-6 pb-4">
      <h1 className="text-xl font-bold text-t1">설정</h1>

      {profile && (
        <Card>
          <p className="text-sm font-semibold text-t2 mb-3">캐릭터</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-lg">
              🍁
            </div>
            <div>
              <p className="text-t1 font-semibold">{profile.character_name}</p>
              <p className="text-xs text-t3">{profile.class} · Lv.{profile.level}</p>
            </div>
          </div>
        </Card>
      )}

      {/* 화면 테마 */}
      <Card>
        <p className="text-sm font-semibold text-t2 mb-4">화면 테마</p>
        <div className="flex gap-3">
          <button
            onClick={() => handleThemeToggle(false)}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${
              !dark
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-surface text-t2 border-line'
            }`}
          >
            ☀️ 라이트
          </button>
          <button
            onClick={() => handleThemeToggle(true)}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${
              dark
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-surface text-t2 border-line'
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
