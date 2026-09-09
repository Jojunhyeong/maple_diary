'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useEconomy } from '@/shared/lib/hooks/useEconomy';
import { summarizeEconomy } from '@/shared/lib/utils/economy';
import { formatDate, formatMeso } from '@/shared/lib/utils/formatters';
import { IncomeSources, SignedMeso, SOURCE_META } from '@/shared/ui/EconomyOverview';
import ActivityAnalysis from '@/widgets/analytics/activity-analysis';

export default function AnalysisPage() {
  const economy = useEconomy();
  const [period, setPeriod] = useState('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const today = formatDate(economy.today);
  const startDate = new Date(economy.today);
  if (period === 'month') startDate.setDate(1);
  else startDate.setDate(startDate.getDate() - (period === '7' ? 6 : 29));
  const start = period === 'custom' ? customStart : formatDate(startDate);
  const end = period === 'custom' ? customEnd : today;
  const invalid = !start || !end || start > end || end > today;
  const stats = summarizeEconomy(economy.entries, start, end);
  const best = (Object.keys(SOURCE_META) as Array<keyof typeof SOURCE_META>).sort((a,b) => stats.sources[b] - stats.sources[a])[0];
  const categories = Object.entries(stats.categories).sort((a,b) => b[1] - a[1]);
  const points = economy.points.filter(entry => entry.date >= start && entry.date <= end).reduce((sum, entry) => sum + entry.amount, 0);
  const days = invalid ? 0 : Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86400000) + 1;
  const bucketDays = days > 60 ? Math.ceil(days / 30) : days > 14 ? 7 : 1;
  const trend = Array.from({ length: Math.ceil(days / bucketDays) }, (_,index) => {
    const from = new Date(`${start}T12:00:00`); from.setDate(from.getDate() + index * bucketDays);
    const to = new Date(from); to.setDate(to.getDate() + bucketDays - 1);
    return { date: formatDate(from), end: formatDate(to) < end ? formatDate(to) : end, net: summarizeEconomy(economy.entries, formatDate(from), formatDate(to) < end ? formatDate(to) : end).net };
  });
  const trendWithData = trend.filter(row => stats.entries.some(entry => entry.date >= row.date && entry.date <= row.end));
  const max = Math.max(1, ...trendWithData.map(row => Math.abs(row.net)));
  const totalSourceIncome = stats.sources.hunting + stats.sources.boss + stats.sources.gathering;
  const activityRows = (Object.keys(SOURCE_META) as Array<keyof typeof SOURCE_META>).map(kind => ({
    kind,
    amount: stats.sources[kind],
    percent: totalSourceIncome > 0 ? stats.sources[kind] / totalSourceIncome * 100 : 0,
    count: stats.entries.filter(entry => entry.kind === kind).length,
  }));
  return <main className="diary-analysis-page maple-fade-up">
    <div className="diary-page-heading"><div><div className="diary-eyebrow">기록으로 보는 메이플 경제</div><h1>분석</h1><p>사냥, 보스, 채집, 지출 기록을 바탕으로 메소 흐름을 확인해요.</p></div><span className="diary-scope">계정 전체</span></div>
    <div className="diary-period-bar"><div className="diary-tabs" aria-label="분석 기간">{[['7','7일'],['30','30일'],['month','이번 달'],['custom','직접 선택']].map(([value,label]) => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>)}</div>{period === 'custom' ? <div className="diary-date-inputs"><label>시작일<input type="date" max={customEnd || today} value={customStart} onChange={e => setCustomStart(e.target.value)} /></label><label>종료일<input type="date" min={customStart} max={today} value={customEnd} onChange={e => setCustomEnd(e.target.value)} /></label></div> : <span>{start} — {end}</span>}</div>
    {invalid ? <p className="diary-empty">오늘 이전의 시작일과 종료일을 선택해 주세요.</p> : economy.loading ? <p className="diary-empty" role="status">경제 기록을 불러오는 중…</p> : economy.error ? <p role="alert" className="diary-error">{economy.error.message}</p> : <>
      {!economy.isLoggedIn && <p className="diary-login-note">로컬 사냥 기록 기준입니다. <Link href="/login">로그인하여 전체 기록 연결 ↗</Link></p>}
      <section className="diary-analytics-summary" aria-label="기간 수익 요약"><div><span>총 수익</span><strong>{formatMeso(stats.income)}</strong></div><b aria-hidden="true">−</b><div><span>총 지출</span><strong className="diary-negative">{formatMeso(stats.expense)}</strong><small>재료비 포함</small></div><b aria-hidden="true">=</b><div className="result"><span>순수익</span><strong><SignedMeso value={stats.net} /></strong></div></section>
      <section className="diary-chart-panel"><div className="diary-section-heading"><div><h2>순수익 추이</h2><p>{bucketDays === 1 ? '일별' : `${bucketDays}일 단위`} 기록 · 메소</p></div><span className="diary-chart-legend">● 수익　<span className="diary-negative">● 손실</span></span></div>
        {trendWithData.length < 2 ? <div className="diary-analysis-empty"><strong>추이를 분석할 기록이 부족해요</strong><p>서로 다른 날짜나 기간에 기록이 두 번 이상 쌓이면 순수익 변화를 비교할 수 있어요.</p></div> : <div className="diary-chart" role="img" aria-label="실제 기록이 있는 기간의 순수익. 상세 수치는 아래 표에서 확인할 수 있습니다.">{trendWithData.map(row => <div className="diary-chart-column" key={row.date}><div className="diary-chart-half">{row.net >= 0 && <span style={{ height: `${row.net / max * 100}%` }} title={`${row.date} ~ ${row.end}: ${formatMeso(row.net)}`} />}</div><div className="diary-chart-half negative">{row.net < 0 && <span style={{ height: `${Math.abs(row.net) / max * 100}%` }} title={`${row.date} ~ ${row.end}: ${formatMeso(row.net)}`} />}</div><small>{row.date.slice(5).replace('-','/')}</small></div>)}</div>}
        {trendWithData.length > 0 && <details className="diary-chart-values"><summary>기간별 수치 보기</summary><table><caption className="sr-only">기간별 순수익</caption><thead><tr><th>기간</th><th>순수익</th></tr></thead><tbody>{trendWithData.map(row => <tr key={row.date}><td>{row.date} — {row.end}</td><td><SignedMeso value={row.net} /></td></tr>)}</tbody></table></details>}
        <p className="diary-footnote">보스는 실제 처치일이 아닌 저장된 주·월 정산 기준일에 반영됩니다. 조각·채집 수익은 평가액을 포함하며, 메이플포인트는 메소 합계에서 제외합니다.</p>
      </section>
      <div className="diary-analysis-grid"><section className="diary-chart-panel"><div className="diary-section-heading"><div><h2>수익 구성</h2><p>활동별 수익 비중</p></div><Link href="/boss">보스 상세 ↗</Link></div>{totalSourceIncome > 0 ? <IncomeSources sources={stats.sources} /> : <div className="diary-analysis-empty"><strong>수익 구성을 분석할 기록이 없어요</strong><p>사냥, 보스 또는 채집 수익을 기록해 주세요.</p></div>}</section><section className="diary-chart-panel"><div className="diary-section-heading"><div><h2>지출 구성</h2><p>카테고리별 메소 지출</p></div><Link href="/expenses">지출 기록 ↗</Link></div>{categories.length ? categories.map(([label,amount]) => <div className="diary-expense-bar" key={label}><div><span>{label}</span><strong>{formatMeso(amount)} <small>· {Math.round(amount / stats.expense * 100)}%</small></strong></div><progress max={stats.expense} value={amount} aria-label={label} /></div>) : <div className="diary-analysis-empty"><strong>지출 구성을 분석할 기록이 없어요</strong><p>스타포스, 장비 구매 등의 지출을 기록해 주세요.</p></div>}<p className="diary-footnote">별도 메이플포인트 지출: {points.toLocaleString('ko-KR')} P</p></section></div>
      <section className="diary-activity-comparison"><div className="diary-section-heading"><div><h2>활동별 비교</h2><p>선택한 기간의 수익과 기록 횟수</p></div></div><div className="diary-comparison-head"><span>활동</span><span>수익</span><span>비중</span><span>기록 횟수</span></div>{activityRows.map(row => <div className="diary-comparison-row" key={row.kind}><span><i style={{ background: SOURCE_META[row.kind].color }} />{SOURCE_META[row.kind].label}</span><strong>{formatMeso(row.amount)}</strong><span>{row.percent.toFixed(0)}%</span><span>{row.count}회</span></div>)}</section>
      <section className="diary-insight"><span>✧</span><div><strong>기록이 알려주는 이야기</strong><ul><li>{stats.income > 0 ? `선택한 기간의 가장 큰 수익원은 ${SOURCE_META[best].label}이며 전체 수익의 ${Math.round(stats.sources[best] / stats.income * 100)}%예요.` : '수익을 기록하면 가장 큰 수익원을 확인할 수 있어요.'}</li>{categories[0] && <li>메소 지출의 {Math.round(categories[0][1] / stats.expense * 100)}%를 {categories[0][0]}에 사용했어요.</li>}</ul></div></section>
    </>}
    <details className="diary-detail-analysis"><summary>사냥 효율 · 캐릭터 비교 상세 분석</summary><ActivityAnalysis /></details>
  </main>;
}
