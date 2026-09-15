'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useStoredCharacterProfile } from '@/shared/lib/hooks/useStoredCharacterProfile';
import { CharacterManager } from './CharacterManager';
import { BottomNav } from './BottomNav';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const profile = useStoredCharacterProfile();
  const dialog = useRef<HTMLDialogElement>(null);
  const isRecord = ['/record', '/records', '/expenses', '/gathering'].some(p => pathname === p);
  const section = isRecord ? '기록' : pathname === '/equipment-guide' ? '장비 가이드' : pathname === '/analysis' ? '분석' : pathname === '/goals' ? '목표' : pathname === '/boss' ? '보스 상세' : pathname === '/settings' ? '설정' : '홈';
  return (
    <div className="diary-shell">
      <a href="#page-content" className="diary-skip">본문으로 이동</a>
      <aside className="diary-sidebar">
        <Link href="/dashboard" className="diary-brand"><span className="diary-logo">🍁</span><span>메이플 다이어리<small>나의 메이플 기록</small></span></Link>
        <p className="diary-nav-caption">내 다이어리</p>
        <BottomNav />
        <Link href="/equipment-guide" className="diary-settings" aria-current={pathname === '/equipment-guide' ? 'page' : undefined}>◇ <span>장비 가이드</span></Link>
        <div className="diary-sidebar-note"><span>작은 기록, 더 가까운 목표.</span><p>메이플에서의 노력을<br />차곡차곡 모아보세요.</p><span className="diary-leaf">🍁</span></div>
        <Link href="/settings" className="diary-settings">⚙ <span>설정 및 계정</span></Link>
      </aside>
      <div className="diary-workspace">
        <header className="diary-header">
          <span className="diary-breadcrumb">내 다이어리 <span>/</span> <strong>{section}</strong></span>
          <div className="diary-header-actions">
            <button className="diary-character" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">
              <span className="diary-avatar">{profile?.image_url ? <Image src={profile.image_url} alt="" width={48} height={48} unoptimized /> : '🍁'}</span>
              <span><strong>{profile?.character_name || '캐릭터 선택'}</strong><small>{profile ? `${profile.character_level}레벨 · ${profile.character_class}${profile.character_world ? ` · ${profile.character_world}` : ''}` : '내 메이플 캐릭터를 연결해 보세요'}</small></span><span className="diary-chevron">⌄</span>
            </button>
            <Link href="/settings" className="diary-profile" aria-label="사용자 프로필 및 설정">⚙</Link>
          </div>
        </header>
        <div id="page-content" className={`diary-content ${isRecord ? 'diary-record-content' : ''}`}>
          {isRecord && <div className="diary-record-intro"><div className="diary-eyebrow">오늘도 차곡차곡</div><h1>오늘의 메이플 기록</h1><p>벌고, 쓰고, 모으는 모든 순간을 한곳에.</p><nav className="diary-tabs" aria-label="기록 종류">{[['/records', '사냥'], ['/expenses', '지출'], ['/gathering', '채집']].map(([href,label]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}</nav></div>}
          <Link href="/equipment-guide" className="mb-4 inline-block text-xs font-medium text-brand md:hidden">장비 가이드 →</Link>
          {children}
        </div>
      </div>
      <div className="diary-mobile-nav"><BottomNav /></div>
      <dialog ref={dialog} className="diary-character-dialog" aria-labelledby="character-dialog-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <button className="diary-character-close" aria-label="내 캐릭터 닫기" onClick={() => dialog.current?.close()}>✕</button>
        <CharacterManager variant="compact" headingId="character-dialog-title" />
      </dialog>
    </div>
  );
}
