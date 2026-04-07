'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';

export default function OnboardingNicknamePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const handleNext = () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError('캐릭터 이름을 입력해주세요');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 12) {
      setError('캐릭터 이름은 2~12자여야 합니다');
      return;
    }

    // 임시 저장 (character 페이지에서 API로 검증)
    sessionStorage.setItem('onboarding:nickname', trimmed);
    router.push('/onboarding/character');
  };

  return (
    <div className="flex flex-col min-h-screen bg-app px-6 pt-16 pb-8 max-w-md mx-auto w-full">
      <div className="flex flex-col gap-2 mb-8">
        <p className="text-xs text-amber-400 font-medium uppercase tracking-widest">Step 2 / 3</p>
        <h1 className="text-2xl font-bold text-t1">캐릭터 이름</h1>
        <p className="text-t3">본캐릭터의 닉네임을 입력하세요</p>
      </div>

      <div className="flex flex-col gap-6 flex-1">
        <Input
          label="캐릭터 닉네임"
          placeholder="닉네임 입력"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleNext()}
          error={error}
          autoFocus
        />

        <p className="text-xs text-zinc-600">
          메이플스토리 Open API를 통해 캐릭터 정보를 불러옵니다.
          실제 닉네임을 정확하게 입력해주세요.
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => router.back()}
          className='whitespace-nowrap'
        >
          이전
        </Button>
        <Button
          size="lg"
          fullWidth
          onClick={handleNext}
          disabled={!nickname.trim()}
        >
          다음
        </Button>
      </div>
    </div>
  );
}
