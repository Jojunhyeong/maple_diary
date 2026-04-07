# 메이플 재획 수익 추적 대시보드 - 최종 설계 (리팩토링)

**버전**: v2.0 (리팩토링)  
**날짜**: 2026년 4월  
**상태**: 리팩토링 완료, 구현 준비 단계

---

## 1. 최종 서비스 정의

### 서비스명
**Maple Diary** - 단일 루틴 재획 수익 추적기

### 한 줄 정의
**본캐 1개, 고정 루틴 1개를 기준으로 재획 수익과 누적 성과를 기록/분석하는 개인용 메이플 재획 대시보드**

### 핵심 전제 (변경 불가)
```
✅ 본캐 1개만 사용
✅ 고정 사냥 루틴 1개만 사용
✅ 개인용 기록 앱
✅ 비교형 앱 아님

❌ 캐릭터 선택 / 비교
❌ 맵 선택 / 비교
❌ 여러 루틴 추적
```

### 사용 시나리오
```
사용자 "홍"은:
1. 본캐: 루나 (고정)
2. 사냥터: 리스하드 스퀘어 (고정)
3. 루틴: "오전 사냥 → 저녁 사냥" (고정)

매일같이 이 루틴에서 얼마를 벌었는지 기록하고
"지난주랑 비교해서 효율이 좋았나?"
"목표 달성까지 얼마나 남았나?"
를 추적하는 것이 목적.
```

---

## 2. 최종 사용자 흐름

### 2.1 비로그인 사용자 흐름

```
앱 접속
  ↓
"로그인 없이 사용" 선택
  ↓
온보딩 (캐릭터 닉네임 입력 + 프로필 확인)
  ↓
로컬 저장 설정:
  - local_owner_id 생성 (UUID)
  - localStorage에 저장
  - IndexedDB에 기록 저장
  ↓
대시보드 사용
  ↓
기록 입력 → IndexedDB에 저장
기록 조회 → IndexedDB에서 로드
목표 설정 → localStorage에 저장
분석 조회 → IndexedDB 데이터로 계산
  ↓
✅ 완전히 로컬에서만 작동
❌ 서버 접근 없음
❌ 다른 기기에서 조회 불가
```

### 2.2 로그인 사용자 흐름

```
비로그인으로 사용 중
  ↓
설정 → "카카오 로그인"
  ↓
Supabase Auth + Kakao OAuth
  ↓
users 테이블에 사용자 생성:
  {
    id: [UUID, 앱 내부 사용자 ID],
    auth_id: [Supabase Auth ID],
    local_owner_id: 기존 로컬 ID (마이그레이션용),
    character_name, character_ocid, ...
  }
  ↓
로컬 기록 → 서버로 이전 (3가지 옵션)
  ↓
앞으로는:
  - 기록 입력 → 서버 기준 저장 + 로컬 캐시 (IndexedDB)
  - 다른 기기 접속 → Supabase에서 로드
  - 자동 동기화 (온라인 복귀 시)
  ↓
✅ 서버가 기준 저장소 (source of truth)
✅ 로컬은 캐시 역할
✅ 다른 기기에서도 데이터 확인 가능
```

### 2.3 로컬 → 서버 마이그레이션 흐름

```
[로그인 완료]
  ↓
로컬 기록 확인 (15개)
  ↓
마이그레이션 모달 표시:

┌─────────────────────────────────│
│ 저장된 로컬 기록이 있습니다      │
│                                 │
│ [1️⃣ 로컬 기록을 서버로 이전]     │
│    기존 로컬 기록 15개를 Supabase로 전송
│    → 로그인 후엔 서버 기록만 사용
│                                 │
│ [2️⃣ 서버 기록만 사용]            │
│    로컬 기록은 유지
│    새로운 기록은 서버에만 저장
│    → 로컬은 백업처럼 유지
│                                 │
│ [3️⃣ 두 데이터 병합]             │
│    로컬 + 서버 기록 모두 유지
│    → 가장 많은 기록 보존
│                                 │
│ [취소] (아직 로그아웃)            │
└─────────────────────────────────┘
  ↓
선택에 따라 실행:

옵션 1: 이전
  FOR EACH local_record:
    INSERT INTO records (user_id, ..., local_id)
  결과: 15개 기록이 서버로 이동

옵션 2: 서버만 사용
  (로컬 기록은 그대로, 새 기록은 서버에만)

옵션 3: 병합
  로컬 → 서버 전송
  + 서버 기록 → 로컬로 다운로드
  결과: 양쪽 모두 최신 데이터
  ↓
✅ 마이그레이션 완료
```

---

## 3. 최종 Information Architecture (IA)

### 페이지 구조 (8개 페이지)

```
Maple Diary (메인 진입)
│
├─ /onboarding
│  ├─ Step 1. 환영
│  ├─ Step 2. 닉네임 입력
│  ├─ Step 3. 캐릭터 조회 (MapleStory Open API)
│  └─ Step 4. 완료
│
├─ /dashboard (메인 큰시보드)
│
├─ /record (빠른 입력)
│
├─ /records (기록 목록)
│
├─ /analysis (수익 분석)
│
├─ /goals (목표)
│
├─ /settings (설정)
│
└─ /auth/login (카카오 로그인)
```

### 페이지별 특징

| 페이지 | 로그인 필요 | 데이터 출처 | 저장 위치 |
|--------|-----------|----------|---------|
| onboarding | ❌ | 입력값 | 로컬/서버 |
| dashboard | ❌ | localStorage/IndexedDB 또는 Supabase | 로컬/서버 |
| record | ❌ | 입력값 | 로컬/서버 |
| records | ❌ | IndexedDB 또는 Supabase | 로컬/서버 |
| analysis | ❌ | IndexedDB 또는 Supabase | 읽기 전용 |
| goals | ❌ | localStorage 또는 Supabase | 로컬/서버 |
| settings | ❌ | localStorage / 입력값 | 로컬/서버 |
| auth/login | ❌ | 카카오 OAuth | Supabase 저장 |

---

## 4. 페이지별 기능 정의

### 4.1 Onboarding

```
┌─────────────────────────────────┐
│ Step 1: 환영                    │
├─────────────────────────────────┤
│ 메이플 재획 수익 추적 대시보드  │
│ [시작하기]                      │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Step 2: 본캐 닉네임 입력         │
├─────────────────────────────────┤
│ 본캐 닉네임 입력 (필수)          │
│ 예: 홍길동                      │
│ [다음]                          │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Step 3: 캐릭터 확인             │
├─────────────────────────────────┤
│ MapleStory Open API로 프로필 조회          │
│ [이미지] 직업 레벨             │
│ "이 캐릭터 맞나요?"             │
│ [네] [아니오]                   │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Step 4: 완료                    │
├─────────────────────────────────┤
│ ✅ 설정이 완료되었습니다        │
│ [대시보드로 이동]               │
└─────────────────────────────────┘

[저장]
- local_owner_id → localStorage
- user_profile → localStorage
- IndexedDB 초기화
```

### 4.2 Dashboard

```
카드형 UI (다크모드):

┌──────────────────────────────────┐
│ 오늘 수익                        │
│ 💰 123.5M | ✨ 245개 | ⏱ 2h30m  │
└──────────────────────────────────┘

┌────────────────┐ ┌──────────────┐
│ 이번 주         │ │ 이번 달       │
│ 987.2M         │ │ 4.3B         │
└────────────────┘ └──────────────┘

┌──────────────────────────────────┐
│ 최근 3개 기록                    │
│ 04-06 | 123M | 2h30m            │
│ 04-05 | 98M  | 2h10m            │
│ 04-04 | 156M | 2h45m            │
│ [모든 기록 보기]                  │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ 7일 수익 추이                    │
│ (라인 차트)                      │
└──────────────────────────────────┘
```

### 4.3 Record (기록 입력)

```
빠른 입력 최적화:

┌──────────────────────────────────┐
│ 📅 날짜: 2026-04-06              │
│ ⏱ 시간: [2] 시간 [30] 분         │
│ 💰 메소: [123456789]              │
│ ✨ 조각: [245]                   │
│ 💸 소재비: [50000]               │
│ 📝 메모: (옵션)                   │
│                                  │
│ ┌──────────────────────────────┐│
│ │ ✅ 자동 계산                 ││
│ │ 조각 환산: 26.3M            ││
│ │ 순수익: 149.7M              ││
│ │ 시간당: 59.8M/h             ││
│ └──────────────────────────────┘│
│                                  │
│ [저장] [취소]                    │
└──────────────────────────────────┘

[동작]
① IndexedDB에 저장 (즉시)
② 로그인한 경우 Supabase에도 저장
③ toast 표시 후 대시보드로
```

### 4.4 Records (기록 목록)

```
필터 탭:
[📅 오늘] [🗓 주] [📆 월] [🔍 전체]

월별 그룹:
2026년 4월
─────────────
6일 (일) • 2회 | 312M | 150분
5일 (토) • 1회 | 98M  | 150분
4일 (금) • 2회 | 340M | 285분

클릭 → 상세보기 모달:
┌──────────────────┐
│ 2026-04-06       │
│ ⏱ 2h30m          │
│ 💰 123.5M        │
│ ✨ 245개         │
│ 💸 50K           │
│ 📊 순수익 149.7M │
│ [편집] [삭제]    │
└──────────────────┘
```

### 4.5 Analysis (분석)

```
┌──────────────────────────────────┐
│ 평균 통계                        │
│ 전체: 149.8M | 7회: 152.3M      │
│ 30일: 148.9M                   │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ 최고·최저                        │
│ 최고: 256M (2026-03-31)         │
│ 최저: 98M (2026-04-05)          │
│ 차이: 162% ⬆️                    │
└──────────────────────────────────┘

탭: [7일] [30일] [전체]

┌──────────────────────────────────┐
│ 30일 추이 그래프                 │
│ (라인 차트)                      │
│ 트렌드: +5.2% ⬆️                │
└──────────────────────────────────┘
```

### 4.6 Goals (목표)

```
┌──────────────────────────────────┐
│ 2026년 4월 목표                  │
├──────────────────────────────────┤
│ 💰 메소 목표: 3,000M             │
│ ████████░░ 61.6%                │
│ 진행: 1,849M / 3,000M           │
│ 남은: 1,150M                    │
│ 예상 달성: 4월 15일             │
│                                  │
│ ✨ 조각 목표: 5,000개            │
│ ██████░░░░ 64.9%                │
│ 진행: 3,245 / 5,000             │
│ 남은: 1,755개                   │
│ 예상 달성: 4월 16일             │
│                                  │
│ ⏱ 재획 시간 목표: 240시간        │
│ ███████░░░ 58.3%               │
│ 진행: 140시간 / 240시간         │
│ 남은: 100시간                   │
│ 예상 달성: 4월 14일             │
│                                  │
│ [목표 수정]                      │
└──────────────────────────────────┘
```

### 4.7 Settings

```
👤 프로필
─────────────────────────
캐릭터: 홍길동 (루나)
레벨: 288
[변경]

💹 시세 설정
─────────────────────────
조각 가격: 107,653 메소
[수동 설정]

📱 계정
─────────────────────────
상태: 로그아웃 상태
[카카오 로그인]

(로그인 후)
현재: user@kakao.com
[로그아웃] [계정 연결 해제]

💾 데이터 관리
─────────────────────────
로컬 저장: 15개 기록
[JSON 내보내기]

🚀 로컬 → 서버 마이그레이션
─────────────────────────
로그인 시 3가지 옵션 선택

🗑️ 위험 영역
─────────────────────────
[모든 로컬 데이터 삭제]
```

---

## 5. 최종 데이터 모델

### 5.1 로컬 저장만 사용 (비로그인)

#### localStorage
```json
{
  "maple_diary:local_owner_id": "uuid",
  "maple_diary:user_profile": {
    "character_name": "홍길동",
    "character_ocid": "ocid_xxx",
    "class": "Luna",
    "level": 288
  },
  "maple_diary:settings": {
    "shard_price": 107653,
    "shard_price_updated_at": "2026-04-06T00:00:00Z",
    "timezone": "Asia/Seoul"
  },
  "maple_diary:goals": {
    "current_month": "2026-04",
    "meso_goal": 3000000000,
    "shard_goal": 5000,
    "time_goal_minutes": 240
  }
}
```

#### IndexedDB (maple_diary DB)
```javascript
// Object Store: "records"
{
  id: "uuid",
  local_owner_id: "uuid",  // 비로그인 사용자 식별
  date: "2026-04-06",
  time_minutes: 150,
  meso: 123456789,
  shard_count: 245,
  material_cost: 50000,
  memo: "optional",
  created_at: "2026-04-06T14:30:00Z",
  updated_at: "2026-04-06T14:30:00Z"
}
```

### 5.2 로그인 후 (로컬 + 서버)

#### Supabase (PostgreSQL)

**ID 관계 명확화:**
- `auth.users.id`: Supabase Auth가 관리하는 인증용 ID (절대 변경되지 않음)
- `public.users.id`: 앱 내부에서 사용하는 사용자 PK (UUID)
- `public.users.auth_id`: `auth.users.id`와 연결되는 FK
- `records.user_id`: `public.users.id`를 참조 (앱 내부 사용자 ID)

**API에서 사용자 식별 순서:**
1. `auth.uid()`로 현재 로그인한 Supabase Auth ID 획득
2. `SELECT id FROM users WHERE auth_id = auth.uid()`로 앱 내부 사용자 ID 조회
3. 해당 ID로 records/goals/settings 테이블 접근

**users 테이블**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  local_owner_id UUID UNIQUE,  -- 마이그레이션용
  character_name VARCHAR(50),
  character_ocid VARCHAR(255),
  class VARCHAR(50),
  level INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**records 테이블**
```sql
CREATE TABLE records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE,
  time_minutes INT,
  meso BIGINT,
  shard_count INT,
  material_cost BIGINT DEFAULT 0,
  memo TEXT,
  local_id UUID,  -- 로컬 ID 추적 (마이그레이션)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_records_user_date ON records(user_id, date);
```

**goals 테이블**
```sql
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month VARCHAR(7),  -- "2026-04"
  meso_goal BIGINT,
  shard_goal INT,
  time_goal_minutes INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_goals_user_month ON goals(user_id, month);
```

**user_settings 테이블**
```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  shard_price BIGINT DEFAULT 107653,
  shard_price_updated_at TIMESTAMP DEFAULT NOW(),
  timezone VARCHAR(50) DEFAULT 'Asia/Seoul'
);
```

### 5.3 핵심 원칙

**모든 기록의 소유권**:
- 비로그인: `local_owner_id` 기준 (로컬 저장)
- 로그인: `user_id` (= auth_id) 기준 (서버 저장)
- **캐릭터 기준이 아님** (프로필일 뿐)

---

## 6. 최종 상태관리 구조 (Zustand)

### 6.1 Store 목록

```typescript
// 1. useAuthStore
// 상태: localOwnerId, authUser, isAuthenticated
// 역할: 로그인/로그아웃, local_owner_id 관리

// 2. useUserStore
// 상태: profile, settings
// 역할: 캐릭터 정보, 조각 시세 관리

// 3. useRecordStore
// 상태: records (로컬/서버)
// 역할: 기록 CRUD, 동기화

// 4. useGoalStore
// 상태: goals
// 역할: 목표 설정/조회

// 5. useDashboardStore
// 상태: 없음 (모두 파생값)
// 역할: 오늘/주간/월간 수익 자동 계산
```

### 6.2 데이터 흐름

```
┌─ useAuthStore ─────────────────────────┐
│ localOwnerId 또는 authUser 보유        │
└──────────┬───────────────────────────┘
           │
           ├─► useRecordStore
           │   (로컬 owner_id 또는 서버 user_id 기반)
           │
           ├─► useUserStore
           │   (프로필 + 설정)
           │
           └─► useGoalStore
               (목표)
               │
               └─► useDashboardStore
                   (파생값 계산)
```

### 6.3 Key Point

**비로그인 상태**:
- `useAuthStore.localOwnerId` 있음
- `useAuthStore.authUser` null
- IndexedDB 접근 (로컬 저장)
- Supabase API 호출 안 함

**로그인 상태**:
- `useAuthStore.authUser` 있음
- Supabase API 호출 (서버 저장)
- IndexedDB는 오프라인 캐시로만 사용
- 기록은 `user_id` 기준으로 저장

---

## 7. 최종 API 구조

### 7.1 로컬 API (로컬스토리지 / IndexedDB)

```
비로그인 사용자만 사용:
- 서버 호출 없음
- 모든 데이터 로컬에서 저장/조회
- 속도 빠름 (네트워크 지연 없음)
```

### 7.2 서버 API (Supabase)

**로그인한 사용자만**:

```
POST /api/records
  - 요청: Record 데이터
  - 응답: 생성된 Record + 계산값
  - 권한: auth.uid() = user_id 확인

GET /api/records
  - 쿼리: start_date, end_date, limit
  - 응답: Record[] (계산값 포함)
  - 권한: auth.uid() = user_id 확인

PUT /api/records/[id]
DELETE /api/records/[id]

POST /api/goals
GET /api/goals/current
PUT /api/goals/[id]

GET /api/analytics/summary?period=week|month|all

PUT /api/settings
```

### 7.3 외부 API

```
GET /v1/character?character_name={name}
  - Maple Story Open API
  - 온보딩 Step 3에서만 호출
  - 프로필 정보 조회 (ocid, 직업, 레벨)
```

### 7.4 주의사항

**Supabase API는 로그인 필수**:
```typescript
// 비로그인 사용자가 요청 → 401 Unauthorized 반환
// 클라이언트에서 auth token이 없으면 요청 자체를 안 함

if (!useAuthStore.getState().isAuthenticated) {
  // 로컬 IndexedDB에서만 조회
  const records = await getRecordsFromLocal();
} else {
  // Supabase API 호출
  const records = await fetch('/api/records');
}
```

---

## 8. 최종 DB + RLS 설계

### 8.1 스키마 (완전히 다시 설계)

**핵심 원칙**: 
- 모든 테이블은 `user_id` 기준으로 데이터 분리
- RLS 정책: `auth.uid() = user_id`만 허용
- `auth_id IS NULL` 같은 허슨 정책 사용 안 함

#### users 테이블 (변경 없음)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  local_owner_id UUID UNIQUE,  -- 마이그레이션: local_owner_id와 매핑
  character_name VARCHAR(50) NOT NULL,
  character_ocid VARCHAR(255),
  class VARCHAR(50),
  level INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_local_owner_id ON users(local_owner_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 자신의 레코드만 조회/수정 가능
CREATE POLICY users_select ON users FOR SELECT
  USING (auth.uid() = auth_id);

CREATE POLICY users_update ON users FOR UPDATE
  USING (auth.uid() = auth_id);
```

#### records 테이블
```sql
CREATE TABLE records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_minutes INT NOT NULL,
  meso BIGINT NOT NULL,
  shard_count INT NOT NULL,
  material_cost BIGINT NOT NULL DEFAULT 0,
  memo TEXT,
  local_id UUID,  -- 로컬 ID 추적용
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_records_user_date ON records(user_id, date);
CREATE INDEX idx_records_user_created ON records(user_id, created_at DESC);

ALTER TABLE records ENABLE ROW LEVEL SECURITY;

-- RLS: 해당 user_id의 기록만 조회/수정/삭제 가능
CREATE POLICY records_select ON records FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY records_insert ON records FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY records_update ON records FOR UPDATE
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY records_delete ON records FOR DELETE
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );
```

#### goals 테이블
```sql
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL,  -- "2026-04"
  meso_goal BIGINT,
  shard_goal INT,
  time_goal_minutes INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_goals_user_month ON goals(user_id, month);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY goals_select ON goals FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY goals_insert ON goals FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY goals_update ON goals FOR UPDATE
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY goals_delete ON goals FOR DELETE
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );
```

#### user_settings 테이블
```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  shard_price BIGINT NOT NULL DEFAULT 107653,
  shard_price_updated_at TIMESTAMP DEFAULT NOW(),
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Seoul',
  currency VARCHAR(3) NOT NULL DEFAULT 'KRW',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_select ON user_settings FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY settings_update ON user_settings FOR UPDATE
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );
```

### 8.2 권한 검증 흐름

```
사용자가 API 요청
  ↓
[1] auth token 검증
    (없으면 401 Unauthorized)
  ↓
[2] auth.uid() 추출
  ↓
[3] users 테이블에서 user_id 조회
    WHERE auth_id = auth.uid()
  ↓
[4] 요청 데이터의 user_id와 비교
    (다르면 403 Forbidden)
  ↓
[5] RLS 정책 자동 적용
    (같은 user_id의 데이터만 조회됨)
  ↓
✅ 안전하게 자신의 데이터만 접근
```

### 8.3 RLS 정책 엄격성

**변경 전 (느슨함)**:
```sql
-- ❌ 이렇게 하면 안 됨
CREATE POLICY records_select ON records FOR SELECT
  USING (auth_id IS NULL OR auth.uid() = auth_id);
  -- 대기: 비로그인 사용자도 접근 가능?
```

**변경 후 (엄격함)**:
```sql
-- ✅ 로그인 필수, user_id 기반
CREATE POLICY records_select ON records FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );
  -- 결과: 로그인해서 자신의 user_id만 접근 가능
```

---

## 9. MVP 범위 (수정됨)

### ✅ 포함 (필수)

```
온보딩
  ☑ 닉네임 입력
  ☑ MapleStory Open API 캐릭터 조회
  ☑ local_owner_id 생성 + localStorage 저장

로컬 저장 (비로그인)
  ☑ IndexedDB 기록 저장
  ☑ localStorage 설정 저장

기록 입력/조회/수정/삭제
  ☑ 빠른 입력 폼
  ☑ 자동 계산
  ☑ IndexedDB 또는 Supabase에 저장

대시보드
  ☑ 오늘/주간/월간 수익
  ☑ 최근 기록 3개
  ☑ 7일 그래프

분석
  ☑ 평균 통계
  ☑ 최고/최저 기록
  ☑ 30일 그래프

목표
  ☑ 목표 설정
  ☑ 달성률 표시

설정
  ☑ 프로필 관리
  ☑ 시세 설정
  ☑ JSON 내보내기

카카오 로그인 (선택)
  ☑ Supabase Auth + Kakao OAuth
  ☑ 로컬 → 서버 마이그레이션 (3가지 옵션)
  ☑ 서버 기반 기록 저장/조회
  ☑ 다른 기기에서 동기화
```

### ❌ 제외 (v2 이상)

```
복구 코드
  ❌ MVP에서 제외
  (로그인해서 백업하는 것으로 충분)

맵 관련 기능
  ❌ 맵 선택
  ❌ 맵 비교
  ❌ preferred_map 필드 (완전 제거)

캐릭터 선택/비교
  ❌ 여러 캐릭터 추적
  ❌ 캐릭터 비교

고급 기능
  ❌ PWA / 모바일 앱
  ❌ 커뮤니티 기능
  ❌ 실시간 메이플 API 연동
  ❌ 유저 간 랭킹
```

---

## 10. 추후 확장 기능 (Phase 2+)

### 10.1 복구 기능 (선택사항)

```
비로그인 사용자가 localStorage 삭제를 대비:

복구 코드 생성:
  - 로컬 데이터 → 암호화
  - 복구 코드 생성 (예: "MAPLE-2026-ABC123-XYZ789")
  - 사용자가 기록/저장

복구:
  - 새 기기에서 코드 입력
  - IndexedDB 복원
```

### 10.2 여러 캐릭터 / 맵 지원 (v2)

```
현재: 단일 캐릭터 + 단일 루틴
v2:   여러 캐릭터 + 여러 루틴

필요한 변경:
  - characters 테이블 (현재 users의 profile 정보 분리)
  - sessions 테이블 (루틴 단위 기록)
  - 캐릭터/루틴 선택 UI
  - 비교 분석 페이지
```

### 10.3 고급 분석 (v2)

```
6개월 추이, 1년 통계, 커스텀 기간 분석
월별 비교 차트
일일 평균 추이
```

### 10.4 커뮤니티 / 공유 (v3)

```
월간 리포트 이미지 공유
친구와 데이터 공유
그룹 도전 과제
```

---

## 11. 리팩토링 요약: 변경된 항목

### 🗑️ 제거됨

| 항목 | 이유 |
|------|------|
| 맵 선택 | 단일 루틴만 추적 |
| preferred_map 필드 | 맵 비교 필요 없음 |
| "맵 비교" 섹션 | 비교형 앱이 아님 |
| 복구 코드 (MVP) | 로그인해서 백업으로 충분 |
| 여러 캐릭터 지원 | 본캐 1개만 |
| Auth + Guest 이중 구조 | 명확히 분리 |

### 📝 수정됨

| 항목 | 변경 사항 |
|------|---------|
| 온보딩 | Step 3 → Step 4로 축소 (맵 설정 제거) |
| 데이터 모델 | local_owner_id와 auth_id로 명확히 분리 |
| RLS 정책 | 느슨한 정책 제거 (필수 로그인) |
| API 구조 | 로컬 저장 vs 서버 저장 명확히 분리 |
| 상태관리 | 로그인 상태에 따른 데이터 소스 명시 |
| 설정 UI | preferred_map 제거 |

### ✨ 명확해짐

| 항목 | 설명 |
|------|-----|
| 사용자 흐름 | 비로그인 vs 로그인 완전히 분리 |
| 데이터 소유권 | user_id 기반 (캐릭터 아님) |
| 마이그레이션 | 3가지 옵션 명확히 정의 |
| 서버 접근 | 로그인한 사용자만 |
| 보안 | RLS 정책 강화 |

---

## 12. 개발 시작 시 주의사항

### ✅ 확인 항목

```
[ ] 맵 관련 코드 완전 제거 확인
    - UI에 맵 선택 없음
    - DB에 preferred_map 없음
    - API에 map 파라미터 없음

[ ] 로컬/서버 저장 분리 확인
    - 비로그인: IndexedDB만
    - 로그인: Supabase DB
    - IndexedDB는 캐시 역할만

[ ] RLS 정책 설정 확인
    - 모든 테이블에 RLS 활성화
    - auth.uid() = user_id 기반
    - IS NULL 정책 없음

[ ] 권한 검증 확인
    - 모든 API 엔드포인트에서 auth token 확인
    - user_id 일치 여부 확인
    - 403 Forbidden 반환

[ ] 마이그레이션 로직 확인
    - Option 1: 로컬 → 서버 이전
    - Option 2: 서버만 사용
    - Option 3: 양쪽 병합
```

---

**최종 상태**: 리팩토링 완료, 구현 준비 완료 ✅
