'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';

interface CharacterInfo {
  character_name: string;
  character_class: string;
  character_level: number;
  character_image: string;
}

export default function OnboardingCharacterPage() {
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const nickname = sessionStorage.getItem('onboarding:nickname');
    if (!nickname) {
      router.replace('/onboarding/nickname');
      return;
    }
    fetchCharacter(nickname);
  }, [router]);

  const fetchCharacter = async (nickname: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/maple/character?name=${encodeURIComponent(nickname)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '캐릭터를 찾을 수 없습니다');
      }
      const data = await res.json();
      setCharacter(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!character) return;

    // local_owner_id 생성
    const { initializeLocal } = useAuthStore.getState();
    initializeLocal();

    // 프로필 저장
    const profile = {
      character_name: character.character_name,
      character_class: character.character_class,
      character_level: character.character_level,
      image_url: character.character_image,
      profile_set_at: new Date().toISOString(),
    };
    localStorage.setItem('maple_diary:user_profile', JSON.stringify(profile));
    localStorage.setItem('maple_diary:onboarding_done', 'true');

    sessionStorage.removeItem('onboarding:nickname');

    router.push('/dashboard');
  };

  return (
    <div className="flex flex-col min-h-screen bg-app px-6 pt-16 pb-8 max-w-md mx-auto w-full">
      <div className="flex flex-col gap-2 mb-8">
        <p className="text-xs text-amber-400 font-medium uppercase tracking-widest">Step 3 / 3</p>
        <h1 className="text-2xl font-bold text-t1">캐릭터 확인</h1>
        <p className="text-t3">이 캐릭터가 맞나요?</p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-4 text-t3">
            <div className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p>캐릭터 정보를 불러오는 중...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-red-400">{error}</p>
            <Button
              variant="secondary"
              onClick={() => {
                const nickname = sessionStorage.getItem('onboarding:nickname') || '';
                fetchCharacter(nickname);
              }}
            >
              다시 시도
            </Button>
            <Button className='whitespace-nowrap' variant="ghost" onClick={() => router.push('/onboarding/nickname')}>
              이전
            </Button>
          </div>
        )}

        {character && !loading && (
          <Card className="w-full max-w-xs mx-auto">
            <div className="flex flex-col items-center gap-1 py-4">
              {character.character_image && (
                <div className="relative w-100 h-100">
                  <Image
                    src={character.character_image}
                    alt={character.character_name}
                    fill
                    unoptimized
                  />
                </div>
              )}
              <div className="text-center">
                <p className="text-xl font-bold text-t1">{character.character_name}</p>
                <p className="text-t3 text-sm mt-1">
                  {character.character_class} · Lv.{character.character_level}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="flex gap-3">
        <Button className="whitespace-nowrap" variant="secondary" size="lg" onClick={() => router.push('/onboarding/nickname')}>
          이전
        </Button>
        <Button size="lg" fullWidth onClick={handleConfirm} disabled={!character || loading}>
          시작하기
        </Button>
      </div>
    </div>
  );
}
