# 메이플스토리 재획 수익 추적 대시보드 - MVP 설계 문서

**⚠️ DEPRECATED 문서**  
**이 문서는 최신 설계가 아닙니다. [DESIGN_REFACTORED.md](./DESIGN_REFACTORED.md)를 참고하세요.**

**참고: ID 관계**  
- `auth.users.id`: Supabase Auth ID  
- `public.users.id`: 앱 내부 사용자 PK  
- `public.users.auth_id`: Auth 연결 FK  
- `records.user_id`: 앱 내부 사용자 ID 참조

**서비스명**: Maple Diary  
**목적**: 본캐 1개, 고정 사냥터 기준 재획 수익 및 누적 성과 추적  
**날짜**: 2026년 4월  

---

## 1. 서비스 아키텍처

### 1.1 시스템 전체 구조

```
┌─────────────────────────────────────────────────────┐
│                Frontend (Next.js)                   │
│  - Pages: Dashboard, Record, Analysis, etc.        │
│  - State: Zustand + React Query                    │
│  - Storage: localStorage + IndexedDB               │
└────────┬────────────────────────────────┬──────────┘
         │                                │
    ┌────▼─────────────────┐    ┌────────▼─────────┐
    │  Local Storage Layer  │    │  Supabase Auth   │
    │  (non-authenticated)  │    │  (Optional)      │
    │  - local_owner_id     │    └────────┬─────────┘
    │  - IndexedDB (backup) │             │
    └──────────────────────┘    ┌────────▼──────────────┐
                                 │  Supabase DB         │
                                 │  (authenticated)     │
                                 │  - user_auth_id      │
                                 │  - records           │
                                 │  - goals             │
                                 └──────────────────────┘
         ┌────────────────────────────┐
         │  Maple Story Open API      │
         │  - Character Profile       │
         │  - ocid lookup             │
         └────────────────────────────┘
```

### 1.2 배포 및 환경

- **Frontend**: Vercel
- **Backend**: Supabase (PostgreSQL + Auth)
- **Storage**: Supabase Storage (선택)
- **MapleStory Open API (Nexon Open API)**: 캐릭터 프로필 조회

---

## 2. Information Architecture (IA)

### 2.1 페이지 구조

```
Maple Diary
├── /onboarding
│   ├── 1. 환영 (역할/목표)
│   ├── 2. 닉네임 입력
│   ├── 3. 캐릭터 조회 (Maple API)
│   ├── 4. 기본 설정 (목표)
│   └── 5. 완료 → /dashboard
├── /dashboard
│   ├── 오늘 수익 카드
│   ├── 주간 수익 카드
│   ├── 월간 수익 카드
│   ├── 최근 기록 3개
│   └── 7일 그래프
├── /record
│   ├── 빠른 입력 폼
│   ├── 재획 기록 입력
│   ├── 자동 계산 표시
│   └── 저장 → 카드 애니메이션
├── /records
│   ├── 기록 목록 (날짜순)
│   ├── 필터 (날짜, 기간)
│   ├── 편집/삭제
│   └── 월별 요약
├── /analysis
│   ├── 전체 평균
│   ├── 최근 7회 평균
│   ├── 최근 30일 평균
│   ├── 최고/최저 기록
│   └── 추이 그래프 (7일, 30일, 전체)
├── /goals
│   ├── 목표 설정
│   ├── 달성률 표시
│   ├── 남은 수치 계산
│   └── 예상 달성일
├── /report
│   ├── 월간 리포트
│   └── 월별 비교
├── /settings
│   ├── 프로필 (닉네임, 캐릭터)
│   ├── 시세 설정 (조각)
│   ├── 로그인/로그아웃
│   ├── 데이터 백업/복구
│   └── 기타 설정
└── /auth
    └── 로그인/회원가입 (카카오)
```

---

## 3. 화면별 기능 상세

### 3.1 Onboarding Flow

#### 페이지 1: 환영과 역할
```
┌─────────────────────────────────────┐
│      메이플 수익 추적 대시보드       │
│                                     │
│  🎮 메이플스토리 유저를 위한        │
│  재획 수익 기록 및 분석 도구         │
│                                     │
│  • 반복 루틴 최적화                 │
│  • 수익 추이 분석                   │
│  • 목표 달성 추적                   │
│                                     │
│  [시작하기]                         │
└─────────────────────────────────────┘
```

#### 페이지 2: 닉네임 입력
```
Input: 본캐 닉네임 입력
- 텍스트 입력 필드
- 예: "홍길동" or "Luna"
```

#### 페이지 3: 캐릭터 조회
```
// Maple API 호출
GET /v1/character?character_name={닉네임}
→ ocid, 직업, 레벨, 이미지 조회

표시:
- 캐릭터 프로필 이미지
- 직업 / 레벨
- "이 캐릭터 맞나요?" [예] [아니오]

아니오 → 다시 입력
```

#### 페이지 4: 기본 설정
```
• 조각 시세: (기본값 가능)
• 목표 설정: (스킵 가능)
  - 월간 목표 메소
  - 월간 목표 조각
  - 월간 목표 시간
```

#### 페이지 5: 완료
```
✅ 설정이 완료되었습니다!
[대시보드로 이동]

→ local_owner_id 생성 및 localStorage 저장
```

### 3.2 Dashboard (메인 화면)

#### 상단 헤더
```
┌─────────────────────────────────┐
│ 메이플 다이어리                 │
│ 프로필: 홍길동 (루나)  [설정]    │
└─────────────────────────────────┘
```

#### 오늘 수익 카드
```
┌────────────────────────┐
│    오늘의 수익          │
│                        │
│    💰 123,456,789 메소 │
│    ✨ 245 조각         │
│                        │
│    ⏱ 2시간 30분        │
│    📊 시간당 49M       │
└────────────────────────┘
```

#### 주간/월간 카드 (병렬)
```
┌──────────────────┐  ┌────────────────────┐
│  이번 주 수익     │  │  이번 달 수익       │
│  💰 987,654,321  │  │  💰 4,567,890,123  │
│  월-금: 5회 기록  │  │  15회 기록         │
└──────────────────┘  └────────────────────┘
```

#### 최근 기록 (카드형)
```
┌─────────────────────────────────┐
│  최근 기록                      │
├─────────────────────────────────┤
│ 2026-04-06 | 2시간 30분          │
│ 💰 123.5M | ✨ 245개 | 📊 49M    │
├─────────────────────────────────┤
│ 2026-04-05 | 2시간 10분          │
│ 💰 98.2M | ✨ 180개 | 📊 45M     │
├─────────────────────────────────┤
│ 2026-04-04 | 2시간 45분          │
│ 💰 156.8M | ✨ 320개 | 📊 57M    │
├─────────────────────────────────┤
│ [모든 기록 보기]                 │
└─────────────────────────────────┘
```

#### 7일 그래프
```
수익 추이 (7일)

월    화    수    목    금    토    일
███  ████ ███  █████ ███  ███  ████
125M 198M 123M 256M 145M 167M 189M

[평균: 157M]
```

#### 하단 네비게이션
```
┌──────────────────────────────┐
│ 🏠       📝      📊      ⚙️   │
│ 대시   기록    분석    설정   │
└──────────────────────────────┘
```

### 3.3 Record (기록 입력)

#### 입력 폼 - 필수 항목
```
┌─────────────────────────────────┐
│  재획 기록 입력                  │
├─────────────────────────────────┤
│
│ 📅 날짜: 2026-04-06 (오늘)
│
│ ⏱ 사냥 시간: [2] 시간 [30] 분
│
│ 💰 메소 획득: [123456789] ⭐
│
│ ✨ 조각 개수: [245]
│
│ 💸 소재비: [50000]
│
│ 📝 메모 (선택): [...]
│
├─────────────────────────────────┤
│ ✅ 자동 계산                     │
│                                 │
│ 조각 환산가: 26,375,000         │
│   (조각 245개 × 107,653/개)     │
│                                 │
│ 총 수익: 149,831,789            │
│ 순수익: 149,781,789             │
│ 시간당 메소: 59,890,896          │
│ 시간당 순수익: 59,890,896        │
│                                 │
├─────────────────────────────────┤
│ [저장] [취소]                    │
└─────────────────────────────────┘
```

#### 입력 최적화
- 숫자 입력: 기본값 유지 (이전 입력값)
- 시간: 슬라이더 또는 ±버튼
- 메소: 쉼표 자동 표시
- 저장 후 "저장 완료" 토스트 + 2초 후 대시보드로

#### 선택 항목 (펼칠 수 있음)
```
[▼ 고급 설정]
- 재획비: [20%]
- 유니온 부: [5%]
- MVP: [없음]
- 컨디션: [일반]
```

### 3.4 Records (기록 목록)

#### 목록 뷰
```
┌─────────────────────────────────┐
│  모든 기록 (15개)                │
├─────────────────────────────────┤
│
│ 2026년 4월
│ ───────────────────────────────
│ 6일 (일)        2회 | 312M | 312분
│ 5일 (토)        1회 | 98M  | 150분
│ 4일 (금)        2회 | 340M | 285분
│
│ 2026년 3월
│ ───────────────────────────────
│ 31일 (일)       2회 | 298M | 310분
│ ...
│
└─────────────────────────────────┘
```

#### 필터 옵션
```
[📅 오늘] [🗓 이번주] [📆 이번달] [🔍 전체]
```

#### 기록 카드 클릭 → 상세보기/편집
```
┌───────────────────────────────────┐
│ 2026-04-06 기록                   │
├───────────────────────────────────┤
│ ⏱ 2시간 30분                      │
│ 💰 메소: 123,456,789             │
│ ✨ 조각: 245개                    │
│ 💸 소재비: 50,000                │
│                                   │
│ 📊 결과:                          │
│ - 조각 환산: 26.3M               │
│ - 순수익: 149.7M                 │
│ - 시간당: 59.8M                  │
│                                   │
│ 📝 메모: (없음)                   │
├───────────────────────────────────┤
│ [편집] [삭제] [닫기]              │
└───────────────────────────────────┘
```

### 3.5 Analysis (분석)

```
┌─────────────────────────────────┐
│  수익 분석                       │
├─────────────────────────────────┤
│
│ 📊 평균 통계
│ ─────────────────────────────────
│ 전체 평균:     149.8M / 세션
│ 최근 7회 평균:  152.3M / 세션
│ 최근 30일 평균: 148.9M / 세션
│
│ 🎯 최고·최저
│ ─────────────────────────────────
│ 최고 기록: 256M (2026-03-31)
│ 최저 기록: 98M (2026-04-05)
│ 차이: 158M (162% 향상)
│
│ 📈 추이 그래프
│ ─────────────────────────────────
│ [7일] [30일] [전체] 탭
│
│ 30일 기준:
│ 
│ 160M ┤     ╱╲
│ 140M ┤ ╱╲ ╱  ╲╱
│ 120M ┤ └─────────
│ 100M ┝
│      └─────────────────────────
│        1   7   14  21  28  30일
│
│ 트렌드: 📈 +5.2% (한 달 기준)
│
│ ⏱ 세션 길이
│ ─────────────────────────────────
│ 평균: 2시간 32분
│ 최대: 3시간 15분
│ 최소: 1시간 50분
│
│ ✨ 조각 효율
│ ─────────────────────────────────
│ 평균 습득: 220개 / 세션
│ 평균 가치: 23.6M (시세 기준)
│
└─────────────────────────────────┘
```

### 3.6 Goals (목표)

```
┌─────────────────────────────────┐
│  2026년 4월 목표                 │
├─────────────────────────────────┤
│
│ 🎯 메소 목표: 3,000M
│ ──────────────────────────────
│ 진행: 1,849.5M / 3,000M
│ 달성률: ████████░░ 61.6%
│ 남은 수익: 1,150.5M
│ 예상 달성일: 2026-04-15
│
│ ✨ 조각 목표: 5,000개
│ ──────────────────────────────
│ 진행: 3,245 / 5,000
│ 달성률: ██████░░░░ 64.9%
│ 남은 개수: 1,755개
│ 예상 달성일: 2026-04-16
│
│ ⏱ 시간 목표: 60시간
│ ──────────────────────────────
│ 진행: 39시간 20분 / 60시간
│ 달성률: ██████░░░░ 65.3%
│ 남은 시간: 20시간 40분
│ 예상 달성일: 2026-04-18
│
├─────────────────────────────────┤
│ [목표 수정] [새로운 목표] [초기화]│
└─────────────────────────────────┘
```

### 3.7 Report (월간 리포트)

```
┌─────────────────────────────────┐
│  2026년 3월 리포트               │
├─────────────────────────────────┤
│
│ 📊 3월 요약
│ ─────────────────────────────────
│ • 총 세션: 28회
│ • 총 시간: 72시간 15분
│ • 총 수익: 4,276.5M
│ • 평균 효율: 152.7M / 세션
│ • 총 조각: 5,890개
│
│ 📈 월별 비교
│ ─────────────────────────────────
│        2월        3월       변화
│ ─────────────────────────────────
│ 수익:  4.1M      4.3M    📈 +4.8%
│ 조각:  5,600     5,890   📈 +5.2%
│ 시간:  70시간    72시간  📈 +2.9%
│ 효율:  151M      152.7M  📈 +1.1%
│
│ 🏆 기타 통계
│ ─────────────────────────────────
│ • 최고 기록: 256M (3월 31일)
│ • 최저 기록: 98M (3월 5일)
│ • 가장 높은 평균: 152.7M
│ • 연속 기록일: 18일
│
│ ✨ 주목할 만한 일:
│ • 3월 25-31일: 평균 162M (7일 기준)
│ • 지난달 대비 4.8% 효율 증가
│
└─────────────────────────────────┘
```

### 3.8 Settings (설정)

```
┌─────────────────────────────────┐
│  설정                            │
├─────────────────────────────────┤
│
│ 👤 프로필
│ ─────────────────────────────────
│ 캐릭터 닉네임: 홍길동
│ 캐릭터 직업: 루나
│ 레벨: 288
│ [변경하기]
│
│ 💹 시세 설정
│ ─────────────────────────────────
│ 조각 1개 가격: 107,653 메소
│ (메이플 시세 기준 / 자동 업데이트)
│ [수동 설정]
│
│ 📱 계정
│ ─────────────────────────────────
│ 로그인 상태: 로그아웃 상태
│ [카카오 로그인] [회원가입]
│
│  또는 로그인 시:
│ 현재 사용자: user@kakao.com
│ [로그아웃] [계정 연결 해제]
│
│ 💾 데이터 관리
│ ─────────────────────────────────
│ • 로컬 저장 데이터: 2.3 MB (15개 기록)
│ • 서버 저장 데이터: 없음
│
│ [📥 데이터 내보내기]  (JSON)
│
│ 🔄 로컬 → 서버 마이그레이션
│ ─────────────────────────────────
│ 로그인 시 선택:
│ [1. 로컬 기록 서버로 이전]
│ [2. 서버 기록만 사용]
│ [3. 두 데이터 병합]
│
│ 🗑️ 위험 영역
│ ─────────────────────────────────
│ [모든 로컬 데이터 삭제]
│ [계정 탈퇴]
│
│ ℹ️ 정보
│ ─────────────────────────────────
│ 앱 버전: 1.0.0
│ 마지막 업데이트: 2026-04-06
│ 작가: Maple Diary Contributors
│ [개인정보보호정책] [이용약관]
│
└─────────────────────────────────┘
```

---

## 4. 데이터 모델

### 4.1 로컬 저장 구조 (localStorage + IndexedDB)

#### localStorage (작은 데이터)
```json
{
  "maple_diary:local_owner_id": "local_uuid_v4_here",
  "maple_diary:user_profile": {
    "character_name": "홍길동",
    "character_ocid": "ocid_here (optional)",
    "class": "Luna",
    "level": 288,
    "image_url": "https://...",
    "profile_set_at": "2026-04-06T00:00:00Z"
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
    "time_goal_minutes": 3600
  },
  "maple_diary:last_sync": "2026-04-06T12:00:00Z"
}
```

#### IndexedDB (기록 데이터)
```json
// Database: "maple_diary"
// Object Stores:

// 1. records
{
  "id": "uuid",
  "local_owner_id": "local_uuid",
  "date": "2026-04-06",
  "time_minutes": 150,
  "meso": 123456789,
  "shard_count": 245,
  "material_cost": 50000,
  "memo": "(선택사항)",
  "created_at": "2026-04-06T14:30:00Z",
  "updated_at": "2026-04-06T14:30:00Z",
  "sync_status": "local" | "synced" | "pending"
}

// 2. sessions (재획 타이머용)
{
  "id": "uuid",
  "local_owner_id": "local_uuid",
  "start_time": "2026-04-06T14:00:00Z",
  "end_time": "2026-04-06T16:30:00Z",
  "elapsed_minutes": 150,
  "status": "completed" | "in_progress"
}

// 3. backups
{
  "id": "uuid",
  "local_owner_id": "local_uuid",
  "backup_code": "RESTORE-CODE-RAND-STRING",
  "data": "{...compressed JSON...}",
  "created_at": "2026-04-06T00:00:00Z",
  "expires_at": "2026-07-06T00:00:00Z"
}
```

### 4.2 서버 저장 구조 (Supabase)

#### PostgreSQL 테이블

##### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  local_owner_id UUID UNIQUE,  -- 로컬에서 로그인할 때 연결용
  username VARCHAR(50) NOT NULL,
  character_name VARCHAR(50) NOT NULL,
  character_ocid VARCHAR(255),
  class VARCHAR(50),
  level INT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  synced_local_at TIMESTAMP
);

CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_local_owner_id ON users(local_owner_id);
```

##### records
```sql
CREATE TABLE records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_minutes INT NOT NULL,
  meso BIGINT NOT NULL,
  shard_count INT NOT NULL,
  material_cost BIGINT,
  memo TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  local_id UUID  -- 로컬 ID 추적용 (마이그레이션)
);

CREATE INDEX idx_records_user_id ON records(user_id);
CREATE INDEX idx_records_date ON records(date);
CREATE INDEX idx_records_user_date ON records(user_id, date);
```

##### goals
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
```

##### user_settings
```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  shard_price BIGINT DEFAULT 107653,
  shard_price_updated_at TIMESTAMP DEFAULT NOW(),
  timezone VARCHAR(50) DEFAULT 'Asia/Seoul',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. 계산식

### 5.1 기본 계산

```typescript
// 조각 환산가
shardValue = shardCount * shardPrice

// 총 수익
totalRevenue = meso + shardValue

// 순수익
netRevenue = meso + shardValue - materialCost

// 시간당 메소
mesoPerHour = meso / (timeMinutes / 60)

// 시간당 순수익
netPerHour = netRevenue / (timeMinutes / 60)

// 시간당 조각
shardPerHour = shardCount / (timeMinutes / 60)
```

### 5.2 대시보드 캘린더 기반 계산

```typescript
// 오늘 수익
todayRevenue = SUM(netRevenue) WHERE date = TODAY()

// 이번 주 수익 (월~일)
weeklyRevenue = SUM(netRevenue) WHERE date >= MONDAY AND date <= SUNDAY

// 이번 달 수익
monthlyRevenue = SUM(netRevenue) WHERE YEAR_MONTH = CURRENT_MONTH

// 평균값
weeklyAverage = totalRevenue / recordCount (최근 7회)
monthlyAverage = totalRevenue / recordCount (최근 30일)
allTimeAverage = totalRevenue / recordCount
```

### 5.3 목표 계산

```typescript
// 달성률
progress = (currentValue / goalValue) * 100

// 남은 수치
remaining = goalValue - currentValue

// 예상 달성일
daysInMonth = 30
recordsPerDay = totalRecords / daysInMonth
daysNeeded = remaining / (dailyAverage)
expectedDate = TODAY() + daysNeeded days

// 현재 페이스
currentPace = (currentValue / daysPassed) * totalDaysInMonth
isPaceOK = currentPace >= goalValue
```

### 5.4 분석 계산

```typescript
// 7회 평균
recent7Avg = SUM(netRevenue of last 7 records) / 7

// 30일 평균
last30DaysAvg = SUM(netRevenue of last 30 days) / COUNT(records)

// 최고/최저
maxRecord = MAX(netRevenue)
minRecord = MIN(netRevenue)
variance = maxRecord - minRecord
variancePercent = (variance / average) * 100

// 추이 (선형 회귀)
// 간단한 방식: 이전 반절 평균 vs 현재 반절 평균
previousHalf = AVG(records[0:mid])
currentHalf = AVG(records[mid:end])
trend = ((currentHalf - previousHalf) / previousHalf) * 100
```

---

## 6. 상태관리 구조 (Zustand)

### 6.1 Store 설계

```typescript
// stores/useAuthStore.ts
export const useAuthStore = create((set) => ({
  // State
  localOwnerId: null,
  authUser: null,
  isAuthenticated: false,
  
  // Actions
  initializeLocal: () => { /* ... */ },
  loginWithKakao: async () => { /* ... */ },
  logout: () => { /* ... */ },
  linkLocalToServer: async (migrationOption) => { /* ... */ }
}));

// stores/useRecordStore.ts
export const useRecordStore = create((set, get) => ({
  // State
  records: [],
  loading: false,
  error: null,
  lastSyncTime: null,
  
  // Actions
  loadRecords: async (filter) => { /* ... */ },
  addRecord: async (record) => { /* ... */ },
  updateRecord: async (id, data) => { /* ... */ },
  deleteRecord: async (id) => { /* ... */ },
  syncLocalToServer: async () => { /* ... */ }
}));

// stores/useGoalStore.ts
export const useGoalStore = create((set) => ({
  // State
  goals: {},  // { "2026-04": GoalData }
  
  // Actions
  setGoal: async (month, goal) => { /* ... */ },
  getGoalProgress: (month) => { /* ... */ }
}));

// stores/useUserStore.ts
export const useUserStore = create((set) => ({
  // State
  profile: null,
  settings: null,
  
  // Actions
  loadProfile: async () => { /* ... */ },
  updateProfile: async (data) => { /* ... */ },
  updateSettings: async (settings) => { /* ... */ }
}));

// stores/useDashboardStore.ts
export const useDashboardStore = create((set, get) => ({
  // Computed values
  todayRevenue: () => { /* ... */ },
  weeklyRevenue: () => { /* ... */ },
  monthlyRevenue: () => { /* ... */ },
  recentRecords: () => { /* ... */ },
  sevenDayStats: () => { /* ... */ }
}));
```

### 6.2 상태 흐름

```
App
├── useAuthStore (로그인 상태)
├── useUserStore (프로필, 설정)
│   ├── 온보딩 중 업데이트
│   └── 설정 페이지에서 업데이트
├── useRecordStore (기록)
├── useGoalStore (목표)
└── useDashboardStore (파생 상태)
    ├── todayRevenue = useRecordStore의 파생값
    ├── weeklyRevenue = useRecordStore의 파생값
    └── recentRecords = useRecordStore의 파생값
```

---

## 7. 온보딩 우저 흐름 상세

### 7.1 비로그인 사용자 (로컬 저장 only)

```
비로그인 사용자는 로그인 없이 바로 사용 가능하며,
모든 데이터가 로컬(localStorage + IndexedDB)에만 저장됩니다.

[사용자 흐름]
앱 접속 → 온보딩 → 로컬 저장 설정 → 대시보드 사용
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

### 7.2 로그인 사용자 (로컬 + 서버 동기화)

```
로그인은 선택사항이며, 카카오 OAuth를 통해 Supabase Auth를 사용합니다.

[사용자 흐름]
비로그인으로 사용 중 → 설정 → "카카오 로그인"
  ↓
Supabase Auth + Kakao OAuth
  ↓
users 테이블에 사용자 생성:
  {
    id: auth_id (Supabase Auth ID),
    local_owner_id: 기존 로컬 ID (마이그레이션용),
    character_name, character_ocid, ...
  }
  ↓
로컬 기록 → 서버로 이전 (3가지 옵션)
  ↓
앞으로는:
  - 기록 입력 → IndexedDB + Supabase 동시 저장
  - 다른 기기 접속 → Supabase에서 로드
  - 자동 동기화 (온라인 복귀 시)
  ↓
✅ 로컬 + 서버 양쪽 동기화
✅ 다른 기기에서도 데이터 확인 가능
```
      meso: input,
      shard_count: input,
      material_cost: input,
      memo: input,
      sync_status: "local"
    }
           │
           ▼
    IndexedDB 저장
           │
           ▼
    useRecordStore 업데이트 (Zustand)
           │
           ▼
    Dashboard 재렌더링
    (useDashboardStore 자동 계산)
           │
           ▼
    [저장 완료] 토스트
    2초 후 대시보드로 이동
```

---

## 8. 로컬 ↔ 서버 마이그레이션 흐름

### 8.1 초기 로그인 시나리오

```
┌─────────────────────────────────────────────┐
│  사용자가 카카오 로그인 클릭                  │
└────────────────┬────────────────────────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │  Supabase Auth       │
      │  카카오 연동         │
      └────────┬─────────────┘
               │
               ▼
      ┌──────────────────────┐
      │  로그인 성공         │
      │  auth_user 획득      │
      └────────┬─────────────┘
               │
               ▼
      ┌──────────────────────────────────┐
      │  로컬 데이터 존재 여부 확인       │
      │  localStorage.local_owner_id?    │
      └────┬──────────────────┬──────────┘
           │                  │
      [예]▼                  ▼[아니오]
           │              새 사용자
      로컬 데이터          서버만 사용
      존재함              (기록 없음)
           │
           ▼
      ┌───────────────────────────────┐
      │  마이그레이션 옵션 제시        │
      │  모달 팝업                     │
      └────────────────────────────────┘
           │
    ┌──────┼──────┬──────────┐
    │      │      │          │
   [1]    [2]    [3]        [취소]
   로컬   서버   병합        (로그아웃)
   이전   만     
           │
           ▼
      옵션 실행
```

### 8.2 옵션 1: 로컬 기록 서버로 이전

```
Step 1: 로컬 IndexedDB 조회
- 모든 records 로드

Step 2: User 레코드 서버에 생성
INSERT INTO users (
  auth_id, local_owner_id, character_name, ...
)

Step 3: Records 마이그레이션
FOR EACH local_record:
  INSERT INTO records (
    user_id, date, time_minutes, meso, ..., local_id
  )
  SET sync_status = "synced"

Step 4: IndexedDB 동기화
UPDATE local_record.sync_status = "synced"

Step 5: 확인 메시지
"15개 기록이 서버로 이전되었습니다!"
```

### 8.3 옵션 2: 서버 기록만 사용

```
Step 1: 로컬 IndexedDB 데이터 유지
(서버 기록만 조회, 새 기록은 서버에 저장)

Step 2: 향후 동기화 설정
- 새 기록은 항상 서버에 먼저 저장
- 로컬은 서버에서 pull

Step 3: 알림
"로컬 데이터는 보존되지만, 새로운 기록은 서버에만 저장됩니다"
```

### 8.4 옵션 3: 데이터 병합

```
Step 1: 로컬 레코드 → 서버로 전송
(옵션 1과 동일)

Step 2: 서버 레코드 → 로컬로 pull
- 기존 서버 레코드를 IndexedDB에 추가
- local_id가 없는 서버 레코드에 로컬 ID 생성

Step 3: 동기화 상태 설정
- all records.sync_status = "synced"
- lastSyncTime 업데이트

Step 4: 양쪽 모두 최신 데이터 보유
```

### 8.5 데이터 백업 및 복구 (오프라인)

```
---

## 9. MVP 범위

### 9.1 포함 기능 (필수)

#### Phase 1: 기본 구조
- ✅ 온보딩 (닉네임 입력 + Maple API 조회)
- ✅ localStorage + IndexedDB 로컬 저장
- ✅ 기본 프로필 설정

#### Phase 2: 기록 입력
- ✅ 빠른 입력 폼 (시간, 메소, 조각, 소재비)
- ✅ 자동 계산 (순수익, 시간당 효율)
- ✅ 기록 저장 → 카드 UI 표시

#### Phase 3: 대시보드
- ✅ 오늘/주간/월간 수익 카드
- ✅ 최근 기록 3개
- ✅ 7일 그래프

#### Phase 4: 기록 관리
- ✅ 기록 목록 (날짜순)
- ✅ 기록 편집/삭제
- ✅ 월별 필터

#### Phase 5: 분석
- ✅ 평균 통계 (전체, 7회, 30일)
- ✅ 최고/최저 기록
- ✅ 30일 그래프

#### Phase 6: 목표
- ✅ 목표 설정 (메소, 조각, 시간)
- ✅ 달성률 표시
- ✅ 남은 수치 + 예상 달성일

#### Phase 7: 설정 & 인증
- ✅ 프로필 관리
- ✅ 시세 설정
- ✅ 로그아웃
- ✅ 로컬 데이터 내보내기

#### Phase 8: 선택적 로그인
- ✅ 카카오 로그인 (Supabase Auth)
- ✅ 로컬 → 서버 마이그레이션 (3가지 옵션)
- ✅ 서버 데이터 조회

### 9.2 제외 기능 (v2 이상)

```
❌ 안 함 (MVP):
- 캐릭터 선택 / 비교
- 맵 선택 / 비교
- 여러 루틴 추적
- 솔 에르다 추적
- 커뮤니티 기능
- 모바일 앱 (네이티브)
- 메이플 실시간 API 연동
- 자동 기록 입력
- 유저 간 랭킹
- 구글 스프레드시트 연동
```

---

## 10. 확장 로드맵 (v2 이상)

### 10.1 Phase 2 (기본 기능 강화)
```
✨ 엔드게임 콘텐츠
- 선택 조각 추적
- 에르다 추적
- 알파벳 부위 추적

📱 모바일 최적화
- PWA 설정
- 오프라인 모드 강화
- 앱 설치 가능

📊 고급 분석
- 장기 추이 (6개월, 1년)
- 월별 비교 (더 상세)
- 커스텀 기간 분석
```

### 10.2 Phase 3 (다중 지원)
```
👥 캐릭터 비교
- 여러 캐릭터 추적
- 캐릭터별 효율 비교
- 동기 부여

🗺️ 맵 비교
- 같은 맵 다른 루틴
- 최적 루틴 찾기
- 맵별 시세

🎯 고급 목표
- 주간 목표
- 커스텀 기간 목표
- 번 단위 목표
```

### 10.3 Phase 4 (커뮤니티)
```
🌐 커뮤니티 기능
- 유저 간 팁 공유
- 월간 랭킹 (선택)
- 그룹 도전 과제

📤 공유 기능
- 월간 리포트 공유 (이미지)
- 친구 초대 기능
- 디스코드 봇 연동
```

### 10.4 Phase 5 (자동화)
```
🤖 자동 기록
- 게임 로그 파싱
- 실시간 메이플 API 연동
- 자동 재획 인식

⏱️ 타이머 기능
- 빌트인 재획 타이머
- 세션 추적
- 휴식 알림
```

---

## 11. 와이어프레임 설명 (텍스트 기반)

### 11.1 온보딩 플로우

**Step 1: 환영**
- 풀스크린 이미지 또는 배경
- 중앙 텍스트: "메이플 수익 추적"
- 하단 버튼: "시작하기"

**Step 2: 닉네임 입력**
- 단순 텍스트 입력
- 플레이스홀더: "본캐 닉네임"
- 버튼: "조회"

**Step 3: 캐릭터 선택**
- 캐릭터 이미지 (API에서)
- 이름, 직업, 레벨
- 버튼: "맞습니다" / "다시 입력"

**Step 4: 기본 설정**
- 시세 입력 (기본값 제공)
- 목표 설정 (선택사항)
- 버튼: "설정 완료"

**Step 5: 완료**
- 체크마크 애니메이션
- 텍스트: "준비되었습니다!"
- 버튼: "대시보드로"

### 11.2 대시보드 레이아웃

```
┌─────────────────────────────────────┐
│ 헤더 (프로필 + 설정)                 │
├─────────────────────────────────────┤
│                                     │
│ ┌──────────────────────────────┐   │
│ │ 오늘 수익 (큰 카드)          │   │
│ │ 💰 123.5M / ✨ 245개         │   │
│ └──────────────────────────────┘   │
│                                     │
│ ┌──────────────────┐ ┌────────────┐│
│ │ 이번주 수익 (중) │ │이번달 수익 ││
│ │ 987M            │ │4.5B      ││
│ └──────────────────┘ └────────────┘│
│                                     │
│ ┌──────────────────────────────┐   │
│ │ 최근 기록 (리스트)            │   │
│ │ • 04-06 | 2h30m | 123M      │   │
│ │ • 04-05 | 2h10m | 98M       │   │
│ │ • 04-04 | 2h45m | 156M      │   │
│ └──────────────────────────────┘   │
│                                     │
│ ┌──────────────────────────────┐   │
│ │ 7일 추이 그래프               │   │
│ │ (간단한 라인 또는 바 차트)    │   │
│ └──────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│ 하단 네비게이션 (5개 탭)              │
└─────────────────────────────────────┘
```

### 11.3 기록 입력 폼

```
┌─────────────────────────────────────┐
│ [◀] 기록 입력 [설정]                 │
├─────────────────────────────────────┤
│                                     │
│ 📅 날짜: [2026-04-06 ▶]             │
│                                     │
│ ⏱ 시간: [2] 시간 [30] 분            │
│   (슬라이더 또는 +/- 버튼)           │
│                                     │
│ 💰 메소: [123,456,789]              │
│   (포맷 자동, 쉼표 표시)             │
│                                     │
│ ✨ 조각: [245]                      │
│                                     │
│ 💸 소재비: [50,000]                 │
│                                     │
│ 📝 메모: [...]                     │
│   (선택사항, 3줄 텍스트)             │
│                                     │
│ [▼ 고급 설정]                       │
│                                     │
│ ┌─────────────────────────────┐   │
│ │ 📊 자동 계산                 │   │
│ │                             │   │
│ │ 조각 환산: 26.3M            │   │
│ │ 총 수익: 149.8M             │   │
│ │ 순수익: 149.7M              │   │
│ │ 시간당: 59.8M               │   │
│ └─────────────────────────────┘   │
│                                     │
│ [저장] [취소]                        │
│                                     │
└─────────────────────────────────────┘
```

### 11.4 기록 목록

```
┌─────────────────────────────────────┐
│ [◀] 모든 기록 (15개)                │
├─────────────────────────────────────┤
│ [📅 오늘] [🗓 주] [📆 월] [모두]    │
├─────────────────────────────────────┤
│                                     │
│ ▼ 2026년 4월                        │
│ ─────────────────────────────────   │
│                                     │
│ ┌──────────────────────────────┐  │
│ │ 6일 (일) • 2회 | 312M | 150분 │  │
│ │                              │  │
│ │  > 14:00 | 2h30m | 123.5M   │  │
│ │  > 18:00 | 1h30m | 188.5M   │  │
│ └──────────────────────────────┘  │
│                                     │
│ ┌──────────────────────────────┐  │
│ │ 5일 (토) • 1회 | 98M | 150분  │  │
│ │                              │  │
│ │  > 14:00 | 2h30m | 98M      │  │
│ └──────────────────────────────┘  │
│                                     │
│ ▼ 2026년 3월                        │
│ ─────────────────────────────────   │
│ (지난달 기록들)                     │
│                                     │
└─────────────────────────────────────┘
```

### 11.5 분석 화면

```
┌─────────────────────────────────────┐
│ [◀] 수익 분석                        │
├─────────────────────────────────────┤
│                                     │
│ 📊 평균 통계 카드                   │
│ ┌──────────────────────────────┐  │
│ │ 전체: 149.8M                 │  │
│ │ 7회: 152.3M                  │  │
│ │ 30일: 148.9M                 │  │
│ └──────────────────────────────┘  │
│                                     │
│ 🎯 최고/최저 카드                   │
│ ┌──────────────────────────────┐  │
│ │ 최고: 256M (3월 31일)        │  │
│ │ 최저: 98M (4월 5일)          │  │
│ │ 차이: 162% ⬆️                │  │
│ └──────────────────────────────┘  │
│                                     │
│ 📈 추이 그래프 탭                   │
│ [7일] [30일] [전체]                │
│                                     │
│ ┌──────────────────────────────┐  │
│ │ 30일 라인 차트               │  │
│ │ (Y축: 메소, X축: 날짜)        │  │
│ │                              │  │
│ │ 트렌드: 📈 +5.2%              │  │
│ └──────────────────────────────┘  │
│                                     │
│ ⏱ 세션 길이 카드                   │
│ ┌──────────────────────────────┐  │
│ │ 평균: 2h32m | 최대: 3h15m   │  │
│ │ 최소: 1h50m                  │  │
│ └──────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

### 11.6 목표 화면

```
┌─────────────────────────────────────┐
│ [◀] 2026년 4월 목표                 │
├─────────────────────────────────────┤
│                                     │
│ 🎯 메소 목표                        │
│ ┌──────────────────────────────┐  │
│ │ 3,000M 목표                  │  │
│ │ ████████░░ 61.6% (1,849M)    │  │
│ │ 남은 수익: 1,150M            │  │
│ │ 예상 달성: 4월 15일          │  │
│ └──────────────────────────────┘  │
│                                     │
│ ✨ 조각 목표                        │
│ ┌──────────────────────────────┐  │
│ │ 5,000개 목표                 │  │
│ │ ██████░░░░ 64.9% (3,245개)   │  │
│ │ 남은 개수: 1,755개           │  │
│ │ 예상 달성: 4월 16일          │  │
│ └──────────────────────────────┘  │
│                                     │
│ ⏱ 시간 목표                        │
│ ┌──────────────────────────────┐  │
│ │ 60시간 목표                  │  │
│ │ ██████░░░░ 65.3% (39h20m)    │  │
│ │ 남은 시간: 20시간 40분       │  │
│ │ 예상 달성: 4월 18일          │  │
│ └──────────────────────────────┘  │
│                                     │
│ [목표 수정] [새 목표] [초기화]       │
│                                     │
└─────────────────────────────────────┘
```

---

## 12. API 설계

### 12.1 Maple Story Open API (클라이언트 사이드)

#### 엔드포인트

```
GET /v1/character?character_name={닉네임}
```

**응답**:
```json
{
  "character_id": "...",
  "character_name": "홍길동",
  "world_name": "Luna",
  "character_class": "Luna",
  "character_level": 288,
  "character_exp": 123456789,
  "character_popularity": 100,
  "character_guild_name": "길드명",
  "character_image": "https://..."
}
```

**사용 시점**:
- 온보딩 Step 3에서만 호출
- 캐릭터 닉네임 입력 후 1회만

#### 에러 처리

```javascript
try {
  const response = await fetch(`/api/maple/character?name=${nickname}`);
  if (!response.ok) {
    if (response.status === 404) {
      showError("캐릭터를 찾을 수 없습니다");
    } else if (response.status === 429) {
      showError("요청 횟수 초과. 잠시 후 다시 시도하세요");
    }
  }
  const data = await response.json();
  return data;
} catch (error) {
  showError("캐릭터 조회 실패");
}
```

### 12.2 백엔드 API (Supabase + Next.js)

#### 1. 인증

```
POST /api/auth/login
Body: { provider: "kakao" }
Response: { redirectUrl: "..." }

POST /api/auth/callback
Query: ?code=...&state=...
Response: { user: {...}, token: "..." }

POST /api/auth/logout
Response: { success: true }
```

#### 2. 사용자

```
GET /api/users/me
Response: { user: {...} }

PUT /api/users/me
Body: { character_name, profile: {...} }
Response: { user: {...} }

POST /api/users/link-local
Body: { local_owner_id, migration_option: "transfer" | "server_only" | "merge" }
Response: { success: true, records_count: 15 }
```

#### 3. 기록

```
GET /api/records
Query: ?start_date=2026-04-01&end_date=2026-04-30
Response: { records: [...], total_count: 15 }

POST /api/records
Body: { date, time_minutes, meso, shard_count, material_cost, memo }
Response: { record: {...}, id: "uuid" }

PUT /api/records/{id}
Body: { date, time_minutes, ... }
Response: { record: {...} }

DELETE /api/records/{id}
Response: { success: true }
```

#### 4. 목표

```
GET /api/goals/current
Response: { goal: {...} }

POST /api/goals
Body: { month: "2026-04", meso_goal, shard_goal, time_goal_minutes }
Response: { goal: {...} }

PUT /api/goals/{id}
Body: { meso_goal, shard_goal, time_goal_minutes }
Response: { goal: {...} }
```

#### 5. 분석

```
GET /api/analytics/summary
Query: ?period=week | month | all
Response: {
  average_revenue: 149800000,
  total_revenue: 1498000000,
  total_records: 10,
  trend: 5.2
}

GET /api/analytics/graph
Query: ?period_days=30
Response: {
  data: [
    { date: "2026-04-06", revenue: 123456789 },
    ...
  ]
}
```

#### 6. 설정

```
PUT /api/settings
Body: { shard_price: 107653, timezone: "Asia/Seoul" }
Response: { settings: {...} }
```

### 12.3 데이터 동기화 전략

#### 온라인 상태
```
기록 입력
  ↓
축ackage전으로 IndexedDB 저장 (sync_status = "pending")
  ↓
서버에 POST /api/records
  ↓
성공 → sync_status = "synced"
실패 → 로컬에만 유지, 나중에 재시도
```

#### 오프라인 상태
```
기록 입력
  ↓
IndexedDB 저장 (sync_status = "local")
  ↓
온라인 복귀 감지
  ↓
pending/local 기록 서버로 전송
```

#### 충돌 해결
```
서버와 로컬 데이터가 일치하지 않을 경우:
- 서버 우선 (Server Wins)
- 로컬 데이터는 백업 코드로 복구 가능
```

---

## 13. 폴더 구조 (Next.js)

```
maple_diary/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (홈 또는 온보딩)
│   ├── onboarding/
│   │   ├── layout.tsx
│   │   ├── page.tsx (Step 1)
│   │   ├── nickname/page.tsx (Step 2)
│   │   ├── character/page.tsx (Step 3)
│   │   ├── settings/page.tsx (Step 4)
│   │   └── complete/page.tsx (Step 5)
│   ├── dashboard/
│   │   └── page.tsx
│   ├── record/
│   │   └── page.tsx
│   ├── records/
│   │   └── page.tsx
│   ├── analysis/
│   │   └── page.tsx
│   ├── goals/
│   │   └── page.tsx
│   ├── report/
│   │   └── page.tsx
│   ├── settings/
│   │   └── page.tsx
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── callback/page.tsx
│   └── api/
│       ├── records/route.ts
│       ├── goals/route.ts
│       ├── analytics/route.ts
│       ├── auth/route.ts
│       └── maple/
│           └── character/route.ts
├── components/
│   ├── layouts/
│   │   ├── MainLayout.tsx
│   │   └── OnboardingLayout.tsx
│   ├── cards/
│   │   ├── RevenueCard.tsx
│   │   ├── RecordCard.tsx
│   │   └── GoalCard.tsx
│   ├── forms/
│   │   ├── RecordForm.tsx
│   │   └── GoalForm.tsx
│   ├── charts/
│   │   ├── RevenueChart.tsx
│   │   └── TrendChart.tsx
│   ├── common/
│   │   ├── Header.tsx
│   │   ├── BottomNav.tsx
│   │   └── Toast.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Card.tsx
├── stores/
│   ├── useAuthStore.ts
│   ├── useRecordStore.ts
│   ├── useUserStore.ts
│   ├── useGoalStore.ts
│   └── useDashboardStore.ts
├── hooks/
│   ├── useLocalStorage.ts
│   ├── useIndexedDB.ts
│   ├── useSyncData.ts
│   └── useCalculations.ts
├── lib/
│   ├── db/
│   │   ├── local.ts (IndexedDB 유틸)
│   │   └── server.ts (API 호출)
│   ├── api/
│   │   ├── mappleApi.ts (Maple Open API)
│   │   └── supabaseClient.ts
│   ├── utils/
│   │   ├── calculations.ts (계산식)
│   │   ├── formatters.ts (숫자, 날짜 포맷)
│   │   └── migrations.ts
│   └── types/
│       └── index.ts
├── public/
│   ├── icons/
│   └── images/
├── styles/
│   ├── globals.css
│   └── variables.css (다크 테마)
├── middleware.ts
├── .env.local
└── next.config.js
```

---

## 14. 개발 타임라인 (예상)

| Phase | 기능 | 예상 일수 |
|-------|------|---------|
| 1 | 초기 설정 (Next.js, Zustand, Tailwind) | 2일 |
| 2 | 온보딩 + 로컬 저장 | 5일 |
| 3 | 기록 입력 + 계산 | 5일 |
| 4 | 대시보드 | 3일 |
| 5 | 기록 목록 + 필터 | 3일 |
| 6 | 분석 + 그래프 | 4일 |
| 7 | 목표 | 2일 |
| 8 | 설정 + 백업 | 3일 |
| 9 | Supabase 연동 + 로그인 | 5일 |
| 10 | 마이그레이션 로직 | 3일 |
| 11 | 모바일 최적화 | 3일 |
| 12 | 테스트 + 배포 | 3일 |
| **총계** | **MVP 완성** | **약 40일 (6주)** |

---

## 15. 주의사항 및 고려사항

### 15.1 보안

```
❌ 하면 안 됨:
- 클라이언트에서 API 키 노출
- 아무 인증 없이 서버 API 호출
- 사용자 데이터 평문 저장

✅ 해야 함:
- localStorage에 민감 정보 저장 금지
  (단, local_owner_id는 공개 UUID이므로 괜찮음)
- Supabase Row Level Security (RLS) 설정
- CORS 설정 명확하게
- 비로그인 기록은 IndexedDB에만 저장
```

### 15.2 성능

```
❌ 피해야 함:
- 매 렌더링마다 전체 기록 로드
- 무한 스크롤 없이 전체 목록 로드
- 복잡한 계산을 매 렌더링마다

✅ 해야 함:
- React Query로 캐싱
- 페이지네이션 (20개씩)
- 계산값 메모이제이션 (useMemo)
- 이미지 최적화 (Next.js Image)
```

### 15.3 오프라인 대응

```
현재 기능:
✅ IndexedDB로 오프라인 입력 가능
✅ 온라인 복귀 시 자동 동기화

아직 구현 안 함:
❌ 서비스워커 (PWA)
❌ 완전한 오프라인 모드
```

---

## 16. 체크리스트

### 개발 착수 전 확인

- [ ] Supabase 프로젝트 생성
- [ ] Kakao Developers 앱 등록
- [ ] Maple Story Open API 키 발급
- [ ] Next.js 프로젝트 생성
- [ ] TypeScript 설정
- [ ] Tailwind CSS 설정
- [ ] Zustand 설치
- [ ] React Query 설치
- [ ] 로컬 개발 환경 구성

### 각 Phase별 완료 체크

```
Phase 1: 초기 설정
- [ ] Next.js + TypeScript 보일러플레이트
- [ ] Tailwind 설정
- [ ] 폴더 구조 생성
- [ ] 타입 정의

Phase 2: 온보딩
- [ ] 5-step 온보딩 UI
- [ ] Maple API 통합
- [ ] localStorage 저장
- [ ] local_owner_id 생성

Phase 3: 기록 입력
- [ ] RecordForm 컴포넌트
- [ ] IndexedDB 저장
- [ ] 자동 계산
- [ ] 입력 최적화 (기본값 유지)

... (이하 생략)
```

---

**이 문서는 MVP 개발의 청사진입니다. 개발 중 실제 상황에 맞게 조정 가능합니다.**
