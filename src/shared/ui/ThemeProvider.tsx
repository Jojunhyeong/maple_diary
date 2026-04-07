'use client';

import { useEffect } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem('maple_diary:theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // 저장값 우선, 없으면 라이트 모드 기본
    const isDark = saved === 'dark' || (saved === null && prefersDark === true && false);
    // false 처리: 저장값 없으면 항상 라이트 (요청사항)

    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  return <>{children}</>;
}

export function useTheme() {
  const toggle = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('maple_diary:theme', isDark ? 'dark' : 'light');
  };

  const setTheme = (theme: 'light' | 'dark') => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('maple_diary:theme', theme);
  };

  const isDark = () =>
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');

  return { toggle, setTheme, isDark };
}
