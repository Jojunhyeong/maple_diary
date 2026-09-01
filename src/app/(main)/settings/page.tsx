'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { useTheme } from '@/shared/ui/ThemeProvider';
import { CharacterManager } from '@/shared/ui/CharacterManager';
import {
  useNexonConnectionMutations,
  useNexonConnectionQuery,
} from '@/shared/lib/queries/useNexonConnectionQuery';

const STARFORCE_DISCOUNT_OPTIONS = [
  { value: 0, label: '추가 할인 없음' },
  { value: 3, label: '3% 할인' },
  { value: 5, label: '5% 할인' },
  { value: 10, label: '10% 할인' },
  { value: 15, label: '15% 할인' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { setTheme, isDark } = useTheme();
  const { data: session, status } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const [dark, setDark] = useState(false);
  const [nexonApiKey, setNexonApiKey] = useState('');
  const [starforceDiscountRate, setStarforceDiscountRate] = useState(0);
  const [isReplacingNexonKey, setIsReplacingNexonKey] = useState(false);
  const [nexonMessage, setNexonMessage] = useState('');
  const { data: nexonConnection, isLoading: isNexonQueryLoading } = useNexonConnectionQuery({
    userId: session?.user?.id,
    isLoggedIn,
  });
  const {
    connectNexon,
    updateDiscountRate,
    disconnectNexon,
    isPending: isNexonMutationPending,
  } = useNexonConnectionMutations({ isLoggedIn });
  const isNexonLoading = isNexonQueryLoading || isNexonMutationPending;

  useEffect(() => {
    setDark(isDark());
  }, [isDark]);

  useEffect(() => {
    if (nexonConnection) {
      setStarforceDiscountRate(nexonConnection.starforceDiscountRate ?? 0);
    }
  }, [nexonConnection]);

  const handleThemeToggle = (toDark: boolean) => {
    setTheme(toDark ? 'dark' : 'light');
    setDark(toDark);
  };

  const handleResetOnboarding = () => {
    if (!confirm('온보딩을 다시 시작하면 로컬 설정이 초기화됩니다. 계속하시겠습니까?')) return;
    const characterMigrationKeys = Array.from({ length: localStorage.length }, (_, index) =>
      localStorage.key(index),
    ).filter((key): key is string => key?.startsWith('maple_diary:migrated:characters:') ?? false);

    characterMigrationKeys.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem('maple_diary:onboarding_done');
    localStorage.removeItem('maple_diary:user_profile');
    localStorage.removeItem('maple_diary:characters');
    localStorage.removeItem('maple_diary:active_character_id');
    localStorage.removeItem('maple_diary:settings');
    localStorage.removeItem('maple_diary:local_owner_id');
    localStorage.removeItem('maple_diary:migrated');
    router.replace('/onboarding');
  };

  const handleNexonConnect = async () => {
    if (!nexonApiKey.trim()) return;
    setNexonMessage('');
    try {
      await connectNexon({ apiKey: nexonApiKey.trim(), starforceDiscountRate });
      setNexonApiKey('');
      setIsReplacingNexonKey(false);
      setNexonMessage('넥슨 API 키를 안전하게 연결했어요.');
    } catch (error) {
      setNexonMessage(error instanceof Error ? error.message : '넥슨 API 키를 연결하지 못했어요.');
    }
  };

  const handleDiscountChange = async (nextRate: number) => {
    setStarforceDiscountRate(nextRate);
    if (!nexonConnection?.connected) return;
    setNexonMessage('');
    try {
      await updateDiscountRate(nextRate);
      setNexonMessage('스타포스 할인 설정을 저장했어요.');
    } catch (error) {
      setNexonMessage(error instanceof Error ? error.message : '할인 설정을 저장하지 못했어요.');
    }
  };

  const handleNexonDisconnect = async () => {
    if (!confirm('넥슨 API 연결을 해제할까요? 이미 등록된 강화 지출은 유지됩니다.')) return;
    setNexonMessage('');
    try {
      await disconnectNexon();
      setNexonApiKey('');
      setIsReplacingNexonKey(false);
      setNexonMessage('넥슨 API 연결을 해제했어요.');
    } catch (error) {
      setNexonMessage(error instanceof Error ? error.message : '넥슨 연결을 해제하지 못했어요.');
    }
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

      <Card>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-t2">넥슨 강화 연동</p>
            <p className="mt-1 text-xs leading-5 text-t3">
              개인 Open API 키로 스타포스 이력을 불러와 계산 가능한 강화비를 지출에 추가합니다.
            </p>
          </div>
          {nexonConnection?.connected && (
            <span className="shrink-0 rounded-full bg-green-500/15 px-2 py-1 text-[10px] font-semibold text-green-600">
              연결됨
            </span>
          )}
        </div>

        {!session ? (
          <div className="rounded-xl bg-surface/60 px-3 py-4 text-center">
            <p className="text-sm text-t3">카카오 로그인 후 개인 API 키를 연결할 수 있어요.</p>
          </div>
        ) : isNexonLoading && nexonConnection === null ? (
          <p className="py-4 text-center text-sm text-t3">연결 상태를 확인하는 중...</p>
        ) : nexonConnection?.connected && !isReplacingNexonKey ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-line bg-surface/45 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-t3">연결된 API 키</p>
                  <p className="mt-1 text-sm font-semibold text-t1">•••• •••• {nexonConnection.apiKeyLast4}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsReplacingNexonKey(true);
                    setNexonMessage('');
                  }}
                  className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-t2"
                >
                  키 변경
                </button>
              </div>
              <p className="mt-2 text-[11px] text-t3">
                마지막 동기화{' '}
                {nexonConnection.lastSyncedAt
                  ? new Date(nexonConnection.lastSyncedAt).toLocaleString('ko-KR')
                  : '아직 없음'}
              </p>
            </div>

            <label className="text-xs font-medium text-t2">
              인게임 추가 할인
              <select
                value={starforceDiscountRate}
                onChange={(event) => void handleDiscountChange(Number(event.target.value))}
                disabled={isNexonLoading}
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-t1 focus:outline-none focus:ring-2 focus:ring-amber-400/30 disabled:opacity-60"
              >
                {STARFORCE_DISCOUNT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void handleNexonDisconnect()}
              disabled={isNexonLoading}
              className="self-start text-xs font-medium text-red-500 disabled:opacity-50"
            >
              연결 해제
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-t2">
              개인 넥슨 Open API 키
              <input
                type="password"
                autoComplete="off"
                value={nexonApiKey}
                onChange={(event) => setNexonApiKey(event.target.value)}
                placeholder="발급받은 API 키를 붙여 넣어 주세요"
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-t1 placeholder:text-t3 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              />
            </label>
            <label className="text-xs font-medium text-t2">
              인게임 추가 할인
              <select
                value={starforceDiscountRate}
                onChange={(event) => setStarforceDiscountRate(Number(event.target.value))}
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-t1 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              >
                {STARFORCE_DISCOUNT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => void handleNexonConnect()}
                disabled={!nexonApiKey.trim() || isNexonLoading}
              >
                {isNexonLoading ? '확인 중...' : nexonConnection?.connected ? '새 키로 연결' : 'API 키 연결'}
              </Button>
              {nexonConnection?.connected && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsReplacingNexonKey(false);
                    setNexonApiKey('');
                  }}
                >
                  취소
                </Button>
              )}
            </div>
            <a
              href="https://openapi.nexon.com/"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-amber-600 underline underline-offset-2"
            >
              넥슨 Open API에서 개인 키 발급하기
            </a>
          </div>
        )}

        <div className="mt-3 rounded-xl bg-amber-500/8 px-3 py-2.5">
          <p className="text-[11px] leading-5 text-t3">
            넥슨은 실제 차감 메소를 제공하지 않아 일반 스타포스 비용을 장비 레벨과 할인 조건으로 계산합니다.
            슈페리얼·주문서 사용·레벨 미확인 장비는 자동 지출에서 제외돼요.
          </p>
        </div>
        {nexonMessage && <p className="mt-2 text-xs text-t2">{nexonMessage}</p>}
      </Card>

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
