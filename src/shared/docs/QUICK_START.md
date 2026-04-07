# 메이플 재획 대시보드 - 개발 빠른 시작 가이드

---

## ID 관계 명확화

**Supabase Auth와 앱 내부 ID의 관계:**
- `auth.users.id`: Supabase Auth가 관리하는 인증용 ID (절대 변경되지 않음)
- `public.users.id`: 앱 내부에서 사용하는 사용자 PK (UUID)
- `public.users.auth_id`: `auth.users.id`와 연결되는 FK
- `records.user_id`: `public.users.id`를 참조 (앱 내부 사용자 ID)

**API에서 사용자 식별 순서:**
1. `auth.uid()`로 현재 로그인한 Supabase Auth ID 획득
2. `SELECT id FROM users WHERE auth_id = auth.uid()`로 앱 내부 사용자 ID 조회
3. 해당 ID로 records/goals/settings 테이블 접근

---

## 1. 프로젝트 초기화 체크리스트

### 1.1 외부 서비스 준비

- [ ] **Supabase 프로젝트** 생성
  - [ ] 조직 생성 또는 기존 조직 선택
  - [ ] 새 프로젝트 생성 (PostgreSQL)
  - [ ] 프로젝트 URL, Anon Key, Service Role Key 저장
  
- [ ] **Kakao Developers** 앱 등록
  - [ ] 개발자 계정 생성
  - [ ] 새 애플리케이션 생성
  - [ ] REST API Key, JavaScript Key 받기
  - [ ] 로그인 설정 → 리다이렉트 URI 등록
    ```
    http://localhost:3000/auth/callback
    https://yourdomain.com/auth/callback
    ```
  
- [ ] **Maple Story Open API** 키
  - [ ] Nexon Developers 계정 생성
  - [ ] API 키 발급
  - [ ] Rate limit 확인 (1일 10,000건)

### 1.2 로컬 환경 준비

```bash
# Node.js 18+ 확인
node --version

# 프로젝트 생성
npx create-next-app@latest maple_diary --typescript --tailwind --app

# 필수 패키지 설치
npm install \
  @supabase/auth-helpers-nextjs \
  @supabase/auth-helpers-react \
  zustand \
  @tanstack/react-query \
  axios \
  clsx \
  date-fns

# 개발용 패키지
npm install --save-dev \
  @types/node \
  @types/react \
  typescript
```

### 1.3 환경 변수 설정

**.env.local** 생성:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Supabase Service Role (서버 전용)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Kakao
NEXT_PUBLIC_KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_REDIRECT_URI=http://localhost:3000/auth/callback

# MapleStory Open API (Nexon Open API) 키
NEXT_PUBLIC_MAPLE_API_KEY=your_maple_api_key

# 기타
NEXT_PUBLIC_APP_ENV=development
```

### 1.4 Supabase 초기 설정

```bash
# 1. Supabase SQL Editor에서 모든 SQL 스크립트 실행
# DATABASE_API_GUIDE.md의 "Part 1. Supabase 스키마 마이그레이션" 참조

# 2. 인증 설정 in Supabase Dashboard
# - Authentication → Providers → Kakao 활성화
# - Client ID, Secret, Redirect URI 입력

# 3. RLS 정책 확인
# - all tables have correct RLS policies
```

---

## 2. 폴더 구조 생성

```bash
mkdir -p app/{onboarding,dashboard,record,records,analysis,goals,settings,auth/{login,callback},api/{records,goals,analytics,auth/maple}}
mkdir -p components/{layouts,cards,forms,charts,common,ui}
mkdir -p stores
mkdir -p hooks
mkdir -p lib/{db,api,utils,types}
mkdir -p public/{icons,images}
mkdir -p styles
```

---

## 3. 파일 작성 순서 (권장)

### Phase 1: 타입 정의 및 유틸 (1-2일)

```
1. lib/types/index.ts (IMPLEMENTATION_GUIDE.md Part 1)
2. lib/utils/calculations.ts (IMPLEMENTATION_GUIDE.md Part 2)
3. lib/utils/formatters.ts (IMPLEMENTATION_GUIDE.md Part 3)
4. lib/db/local.ts (IMPLEMENTATION_GUIDE.md Part 4)
```

### Phase 2: 상태 관리 (1-2일)

```
1. stores/useAuthStore.ts (IMPLEMENTATION_GUIDE.md Part 5)
2. stores/useRecordStore.ts (IMPLEMENTATION_GUIDE.md Part 5)
3. stores/useUserStore.ts (추가)
4. stores/useGoalStore.ts (추가)
5. stores/useDashboardStore.ts (IMPLEMENTATION_GUIDE.md Part 5)
```

### Phase 3: API 엔드포인트 (2-3일)

```
1. app/api/auth/callback/route.ts
2. app/api/records/route.ts
3. app/api/records/[id]/route.ts
4. app/api/goals/route.ts
5. app/api/analytics/summary/route.ts
6. app/api/maple/character/route.ts
```

### Phase 4: UI 컴포넌트 (3-4일)

```
1. components/ui/*.tsx (Button, Input, Card 등)
2. components/layouts/MainLayout.tsx
3. components/layouts/OnboardingLayout.tsx
4. components/common/Header.tsx
5. components/common/BottomNav.tsx
6. components/cards/RevenueCard.tsx
7. components/forms/RecordForm.tsx
8. components/charts/RevenueChart.tsx
```

### Phase 5: 페이지 구현 (4-5일)

```
1. app/onboarding/** (온보딩 flow)
2. app/dashboard/page.tsx
3. app/record/page.tsx
4. app/records/page.tsx
5. app/analysis/page.tsx
6. app/goals/page.tsx
7. app/settings/page.tsx
```

### Phase 6: 데이터 동기화 (2-3일)

```
1. hooks/useSyncData.ts
2. lib/migrations/localToServer.ts
3. app/auth/login/page.tsx
4. 마이그레이션 모달 컴포넌트
```

### Phase 7: 테스트 및 배포 (2-3일)

```
1. 기본 기능 테스트
2. 로컬 저장 테스트
3. 서버 동기화 테스트
4. Vercel 배포
```

---

## 4. 각 Phase별 핵심 구현 사항

### Phase 1: 온보딩

**파일**: `app/onboarding/**`

**필수 구현**:
```tsx
// app/onboarding/page.tsx (Step 1)
// ✅ 환영 페이지
// ✅ 다음 버튼

// app/onboarding/nickname/page.tsx (Step 2)
// ✅ 닉네임 입력 폼
// ✅ useAuthStore.setLocalOwnerId() 호출
// ✅ localStorage 저장

// app/onboarding/character/page.tsx (Step 3)
// ✅ MapleStory Open API 호출
// ✅ 캐릭터 정보 표시
// ✅ useUserStore.loadProfile() 호출

// app/onboarding/settings/page.tsx (Step 4)
// ✅ 기본 설정 입력 (시세, 목표)
// ✅ useUserStore.updateSettings()
// ✅ useGoalStore.setGoal()
// ✅ "완료" 버튼 → /dashboard로 리다이렉트
```

**테스트**:
```bash
# 온보딩 완료 후:
✅ localStorage에 local_owner_id 저장됨
✅ localStorage에 user_profile 저장됨
✅ localStorage에 settings 저장됨
✅ IndexedDB 'maple_diary' DB 생성됨
```

### Phase 2: 대시보드

**파일**: `app/dashboard/page.tsx`

**필수 구현**:
```tsx
// useRecordStore.loadRecords() 호출
// useDashboardStore에서 파생값 계산
const todayRevenue = useDashboardStore((state) => 
  state.todayRevenue(records)
);

// 카드 위젯 렌더링
<RevenueCard label="오늘" value={todayRevenue} />
<RevenueChart data={sevenDayStats} />
<RecordCard records={recentRecords} />
```

**성능 최적화**:
```tsx
// ✅ useMemo 사용 (계산값 메모이제이션)
const todayRevenue = useMemo(() => 
  calculateTodayRevenue(records, shardPrice),
  [records, shardPrice]
);

// ✅ React.memo로 자식 컴포넌트 최적화
export const RevenueCard = React.memo(({ label, value }) => ...)
```

### Phase 3: 기록 입력

**파일**: `app/record/page.tsx`

**필수 구현**:
```tsx
// RecordForm 컴포넌트
// - 숫자 입력 필드 (시간, 메소, 조각, 소재비)
// - 자동 계산 확인 UI
// - 저장 버튼

const handleSave = async (formData) => {
  // ✅ 로컬 저장 (IndexedDB)
  await useRecordStore.addRecord(formData);
  
  // ✅ 서버 연결 시 동기화
  if (isAuthenticated) {
    await useRecordStore.syncLocalToServer();
  }
  
  // ✅ 토스트 메시지 + 리다이렉트
  toast.success("기록이 저장되었습니다");
  await new Promise(r => setTimeout(r, 1000));
  router.push("/dashboard");
}
```

**입력 최적화**:
```tsx
// ✅ 이전 입력값 유지
const lastRecord = useRecordStore(state => state.records[0]);

<input 
  defaultValue={lastRecord?.time_minutes || ""} 
  placeholder="예: 150"
/>

// ✅ 자동 포맷팅
const handleMesoChange = (value) => {
  // "123456789" → "123,456,789"
  const formatted = formatNumber(parseInt(value));
  setMeso(formatted);
}
```

### Phase 4: 기록 목록 & 필터

**파일**: `app/records/page.tsx`

**필수 구현**:
```tsx
// 월별/주별/일일 필터링
const [filter, setFilter] = useState('month');
const filtered = useMemo(() => {
  return useRecordStore.getState()
    .records
    .filter(r => {
      if (filter === 'day') return r.date === today;
      if (filter === 'week') return r.date >= weekStart;
      return r.date >= monthStart;
    });
}, [filter, records]);

// 페이지네이션
const [page, setPage] = useState(0);
const PAGE_SIZE = 20;
const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
```

### Phase 5: 분석

**파일**: `app/analysis/page.tsx`

**필수 구현**:
```tsx
// 세 가지 탭
const [period, setPeriod] = useState('30');  // "7" | "30" | "all"

// API 호출
const { data: analytics } = useQuery({
  queryKey: ['analytics', period],
  queryFn: () => 
    fetch(`/api/analytics/summary?period=${period}`).then(r => r.json())
});

// 그래프 렌더링 (컴포넌트 라이브러리 선택 필요)
// 추천: recharts, chart.js, or plotly.js
<LineChart data={analytics.data}>
  <XAxis dataKey="date" />
  <YAxis />
  <Line type="monotone" dataKey="revenue" />
</LineChart>
```

### Phase 6: 로그인 및 마이그레이션

**파일**: `app/auth/login/page.tsx`, `components/MigrationModal.tsx`

**저장 전략**: 로그인 후 서버가 기준 저장소 (source of truth), IndexedDB는 캐시 역할

**필수 구현**:
```tsx
// 카카오 로그인 버튼
const handleLogin = async () => {
  window.location.href = `https://kauth.kakao.com/oauth/authorize?...`;
}

// 콜백 처리
// app/auth/callback/page.tsx
const params = useSearchParams();
const code = params.get('code');
await useAuthStore.loginWithKakao(code);

// 마이그레이션 모달
if (hasLocalData && !hasSyncedData) {
  <MigrationModal 
    onTransfer={() => migrateTransfer()}
    onServerOnly={() => {}}
    onMerge={() => migrateMerge()}
  />
}
```

---

## 5. 파일별 핵심 코드 스니펫

### 시간 입력 최적화 (중요)

```tsx
// components/forms/TimeInput.tsx
import { useState } from 'react';

export const TimeInput = ({ defaultValue = 150, onChange }) => {
  const [hours, setHours] = useState(Math.floor(defaultValue / 60));
  const [minutes, setMinutes] = useState(defaultValue % 60);

  const handleChange = (h: number, m: number) => {
    setHours(h);
    setMinutes(m);
    onChange(h * 60 + m);
  };

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <label>시간</label>
        <input
          type="number"
          min="0"
          max="24"
          value={hours}
          onChange={(e) => handleChange(parseInt(e.target.value), minutes)}
        />
      </div>
      <div className="flex-1">
        <label>분</label>
        <input
          type="number"
          min="0"
          max="59"
          value={minutes}
          onChange={(e) => handleChange(hours, parseInt(e.target.value))}
        />
      </div>
    </div>
  );
};
```

### 자동 계산 UI (중요)

```tsx
// components/forms/AutoCalculationDisplay.tsx
export const AutoCalculationDisplay = ({ 
  record, 
  shardPrice 
}: { 
  record: Record, 
  shardPrice: number 
}) => {
  const enriched = enrichRecordWithCalculations(record, shardPrice);

  return (
    <div className="bg-blue-950 p-4 rounded-lg mt-4 space-y-2">
      <h3 className="text-white font-bold">✅ 자동 계산</h3>
      
      <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
        <div>조각 환산: <span className="text-white">{formatMeso(enriched.shard_value)}</span></div>
        <div>총 수익: <span className="text-white">{formatMeso(enriched.total_revenue)}</span></div>
        <div>순수익: <span className="text-white">{formatMeso(enriched.net_revenue)}</span></div>
        <div>시간당: <span className="text-white">{formatMeso(enriched.net_per_hour)}</span>/h</div>
      </div>
    </div>
  );
};
```

### 목표 진행률 위젯

```tsx
// components/cards/GoalProgressCard.tsx
export const GoalProgressCard = ({ goal, progress }) => {
  const percentage = (progress.current / progress.goal) * 100;
  
  return (
    <div className="bg-gray-900 p-4 rounded-lg">
      <h4 className="text-white font-bold">{goal.label}</h4>
      
      <div className="mt-2">
        <div className="flex justify-between text-sm text-gray-400">
          <span>{formatMeso(progress.current)}</span>
          <span>{formatMeso(progress.goal)}</span>
        </div>
        
        <div className="w-full bg-gray-800 rounded h-2 mt-1">
          <div
            className="bg-blue-500 h-full rounded"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        
        <div className="text-xs text-gray-400 mt-2">
          {formatPercent(percentage)} 완료
          {progress.expected_date && (
            <> · 예상 달성: {formatExpectedDate(progress.expected_date)}</>
          )}
        </div>
      </div>
    </div>
  );
};
```

---

## 6. 배포 전 체크리스트

### 기능 완성도

- [ ] 온보딩 완료
- [ ] 기록 입력/조회/수정/삭제
- [ ] 대시보드 (오늘/주간/월간 수익)
- [ ] 분석 (평균, 추이, 최고/최저)
- [ ] 목표 설정/진행률
- [ ] 카카오 로그인
- [ ] 로컬→서버 마이그레이션
- [ ] 복구 코드 생성

### 성능

- [ ] Lighthouse 점수 > 80
- [ ] 초기 로딩 < 2초
- [ ] 기록 입력 < 500ms
- [ ] 번들 크기 < 500KB (gzipped)

**최적화 팁**:
```tsx
// 동적 임포트 (큰 차트 라이브러리)
const RevenueChart = dynamic(() => import('@/components/charts/RevenueChart'), {
  ssr: false,
  loading: () => <div>차트 로딩 중...</div>
});

// 이미지 최적화
import Image from 'next/image';
<Image 
  src={profileImage} 
  alt="프로필" 
  width={128} 
  height={128} 
  priority
/>
```

### 보안

- [ ] Row Level Security (RLS) 활성화
- [ ] API 호출 시 auth token 검증
- [ ] 민감 정보는 localStorage에 저장 금지
- [ ] HTTPS 적용 (배포 환경)
- [ ] CORS 설정 확인

### 모바일

- [ ] 반응형 디자인 테스트 (iOS, Android)
- [ ] 터치 타겟 크기 > 48px
- [ ] 입력 필드 자동 포커스 여부 확인

---

## 7. 트러블슈팅

### "localStorage가 비워짐" 에러

```tsx
// 원인: 비공개 창이거나 localStorage 비활성화
// 해결: try-catch로 감싸기

const getLocalOwner = () => {
  try {
    return localStorage.getItem("maple_diary:local_owner_id");
  } catch {
    // IndexedDB fallback
    return getFromIndexedDB("local_owner_id");
  }
};
```

### "IndexedDB 쿼리 느림"

```tsx
// 원인: 인덱스 미생성 또는 대량 데이터
// 해결: 페이지네이션 + 인덱스 활용

// ✅ 좋음
records.filter(r => r.date >= startDate).slice(0, 20);

// ❌ 나쁨
records.filter(r => r.created_at.includes("2026"));
```

### "Supabase 동기화 실패"

```tsx
// 원인: RLS 정책 미설정 또는 auth token 만료
// 해결: RLS 정책 확인 + 토큰 갱신

if (response.status === 401) {
  // 토큰 갱신
  const { data } = await supabase.auth.refreshSession();
  // 재시도
}
```

---

## 8. 확장 아이디어 (Phase 2)

```typescript
// 잠깐 구현하면 좋을 기능들

// 1. PWA 설정
// ✅ web manifest
// ✅ service worker
// ✅ offline 모드

// 2. 다크/라이트 모드
// ✅ next-themes
// ✅ tailwind dark mode

// 3. 알림
// ✅ toast notifications
// ✅ browser notifications

// 4. 데이터 내보내기
// ✅ CSV export
// ✅ JSON export
// ✅ PDF report

// 5. 스크린샷 공유
// ✅ html2canvas
// ✅ share API
```

---

## 9. 참고 리소스

- [Supabase Docs](https://supabase.com/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Zustand](https://github.com/pmndrs/zustand)
- [React Query](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Kakao Developers](https://developers.kakao.com)

---

## 10. 시간 추정

| Phase | 시간 | 난이도 |
|-------|------|--------|
| 초기화 | 4h | ⭐ |
| 타입/유틸 | 8h | ⭐ |
| 상태관리 | 8h | ⭐⭐ |
| API | 12h | ⭐⭐ |
| UI 기본 | 16h | ⭐⭐ |
| 온보딩 | 8h | ⭐⭐ |
| 기록 입력 | 8h | ⭐⭐ |
| 대시보드 | 8h | ⭐⭐ |
| 분석 | 12h | ⭐⭐⭐ |
| 로그인/동기화 | 12h | ⭐⭐⭐ |
| 테스트 | 8h | ⭐ |
| 배포 | 4h | ⭐ |
| **총계** | **~120h** | |

**주당 20시간 개발** = **약 6주**

