/**
 * 메소를 만/억 단위로 포맷
 * 7_500_000 → "750만"
 * 200_000_000 → "2억"
 * 150_000_000 → "1억 5000만"
 */
export const formatMeso = (meso: number): string => {
  if (meso === 0) return '0';

  const sign = meso < 0 ? '-' : '';
  const abs = Math.abs(meso);

  const eok = Math.floor(abs / 100_000_000);
  const man = Math.floor((abs % 100_000_000) / 10_000);

  if (eok > 0 && man > 0) return `${sign}${eok}억 ${man}만`;
  if (eok > 0) return `${sign}${eok}억`;
  if (man > 0) return `${sign}${man}만`;
  return `${sign}${abs}`;
};

/**
 * 실제 메소 값 → 입력창용 만 단위 문자열
 * 7_500_000 → "750"
 * 200_000_000 → "20000"
 */
export const toManDisplay = (meso: number): string => {
  const man = Math.floor(Math.abs(meso) / 10_000);
  return man > 0 ? String(man) : '';
};

/**
 * 만 단위 입력값 → 실제 메소 값
 * "750" → 7_500_000
 * "20000" → 200_000_000
 */
export const fromManInput = (manStr: string): number => {
  const man = parseInt(manStr.replace(/,/g, '')) || 0;
  return man * 10_000;
};

/**
 * 정수를 포맷 (쉼표 추가)
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

/**
 * 분을 "2시간 30분" 형식으로 포맷
 */
export const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
};

/**
 * 날짜를 "2026-04-06" 형식으로
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 날짜를 "4월 6일 (일)" 형식으로
 */
export const formatDateKorean = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[d.getDay()];
  return `${month}월 ${day}일 (${dayName})`;
};

/**
 * 백분율 포맷
 */
export const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

/**
 * 예상 달성일을 "4월 15일" 형식으로
 */
export const formatExpectedDate = (dateString: string): string => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}월 ${day}일`;
};
