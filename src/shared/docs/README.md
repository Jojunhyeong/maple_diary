# Maple Diary - 메이플스토리 재획 수익 추적 대시보드

> **본캐 1개, 고정 루틴 1개를 기준으로 재획 수익과 누적 성과를 기록/분석하는 개인용 메이플 재획 대시보드**

**상태**: 리팩토링 완료 ✅ | 개발 준비 완료 🚀

---

## 📋 목차

1. [서비스 개요](#서비스-개요)
2. [핵심 기능](#핵심-기능)
3. [기술 스택](#기술-스택)
4. [설계 문서](#설계-문서)
5. [개발 시작](#개발-시작)
6. [파일 구조](#파일-구조)
7. [주요 결정사항](#주요-결정사항)

---

## 🎯 서비스 개요

### 한 줄 정의
**단일 캐릭터, 단일 루틴 최적화를 위한 메이플 재획 효율 추적 서비스**

### 핵심 컨셉
- 본캐 1개만 사용
- 고정 사냥터 1개에서만 사냥
- 반복적인 재획 루틴 기록 & 분석
- 캐릭터/맵 비교 기능 없음 (단일 루틴에 집중)

### 타겟 유저
- 메이플스토리 유저 중 재획을 꾸준히 하는 사람
- 자신의 수익 효율을 체계적으로 추적하고 싶은 사람
- 월별/주별 성과를 시각화하고 싶은 사람

---

## ✨ 핵심 기능

### 1️⃣ 데이터 입력
- **빠른 입력 폼**: 시간, 메소, 조각, 소재비
- **자동 계산**: 순수익, 시간당 효율 자동 계산
- **기본값 유지**: 이전 입력값을 다음 입력의 기본값으로

### 2️⃣ 대시보드
- 오늘/주간/월간 수익 한눈에 보기
- 최근 기록 3개 카드 형식
- 7일 추이 그래프

### 3️⃣ 분석
- 전체/7회/30일 평균 효율
- 최고·최저 기록 + 차이율
- 30일 그래프 (추이 + 트렌드)

### 4️⃣ 목표
- 월별 목표 설정 (메소/조각/시간)
- 달성률 시각화
- 예상 달성일 자동 계산

### 5️⃣ 기록 관리
- 모든 기록 조회 (날짜순)
- 편집/삭제
- 월별 필터링

### 6️⃣ 선택적 로그인
- **비로그인 사용 가능** (로컬 저장)
- **선택적 카카오 로그인** (서버 동기화)
- **마이그레이션**: 로컬 → 서버 (3가지 옵션)

---

## 🛠 기술 스택

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Data Fetching**: React Query / SWR
- **Storage**: localStorage + IndexedDB

### Backend
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth + Kakao OAuth
- **API**: Next.js API Routes
- **ORM**: (Raw SQL, optional Prisma if scale)

### External APIs
- **Maple Story Open API**: 캐릭터 정보 조회
- **Kakao Developers**: 소셜 로그인

### Deployment
- **Frontend**: Vercel
- **Database**: Supabase Cloud
- **Monitoring**: (Sentry optional)

---

## 📚 설계 문서

### 📌 **최신 리팩토링 버전**

#### [DESIGN_REFACTORED.md](./DESIGN_REFACTORED.md) ⭐ **필독**
**리팩토링된 최종 설계** - 사용자 요구사항 기반으로 완전히 정리됨
- 맵 관련 요소 완전 제거 (단일 루틴만)
- 로컬/서버 저장 명확하게 분리
- RLS 정책 강화 (필수 로그인)
- 복구 코드 MVP 제외
- **전 문서와 충분히 동기화됨**

**읽기 순서**: 모든 문서보다 먼저 ⭐⭐⭐

---

### 원본 설계 문서 (참고용)

#### [DESIGN.md](./DESIGN.md)
전체 설계 (최초 버전) - 대부분의 내용은 유효하나, 일부 맵 관련 흔적이 남아 있을 수 있음.

**사용 시점**: DESIGN_REFACTORED.md를 먼저 읽은 후, 상세 내용이 필요할 때만 참고

#### [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
구현 가이드 - TypeScript 타입, 계산식, IndexedDB 구현 상세

**사용 시점**: 개발 단계에서 코드 작성 시

#### [DATABASE_API_GUIDE.md](./DATABASE_API_GUIDE.md)
DB & API 구현 - Supabase 스키마, RLS, API 엔드포인트

**사용 시점**: 백엔드 개발 시

#### [QUICK_START.md](./QUICK_START.md)
빠른 시작 가이드 - 초기화, 파일 구조, 체크리스트

**사용 시점**: 프로젝트 시작 전

---

### 📋 읽기 순서 (권장)

**한 번에 전체 파악 (1시간 30분)**:
1. README.md (현재 문서) - 5분
2. DESIGN_REFACTORED.md (1-3절) - 20분
3. DESIGN_REFACTORED.md (4-8절) - 40분
4. QUICK_START.md (1-3절) - 25분

**개발 시작 전**:
- DESIGN_REFACTORED.md 전체 정독
- QUICK_START.md 체크리스트 확인

**개발 중**:
- IMPLEMENTATION_GUIDE.md 병행
- DATABASE_API_GUIDE.md 참고
- DESIGN_REFACTORED.md 핵심만 재확인

---

## 🚀 개발 시작

### 1단계: 외부 서비스 준비

```bash
# 필요한 외부 서비스:
1. Supabase 프로젝트 생성
2. Kakao Developers 앱 등록
3. Maple Story Open API 키 발급
```

**자세한 내용**: [QUICK_START.md - 1.1절](./QUICK_START.md#11-외부-서비스-준비)

### 2단계: 로컬 환경 설정

```bash
# 저장소 클론
git clone <repo-url> maple_diary
cd maple_diary

# 패키지 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 수정 (API 키 입력)

# 개발 서버 실행
npm run dev
```

**자세한 내용**: [QUICK_START.md - 1.2절](./QUICK_START.md#12-로컬-환경-준비)

### 3단계: 첫 기능 구현

**추천 순서** (설계 기준):
1. 타입 정의 + 유틸 (1-2일)
2. 상태관리 (1-2일)
3. API 엔드포인트 (2-3일)
4. UI 컴포넌트 (3-4일)
5. 페이지 구현 (4-5일)
6. 데이터 동기화 (2-3일)
7. 테스트 & 배포 (2-3일)

**자세한 내용**: [QUICK_START.md - 3절](./QUICK_START.md#3-파일-작성-순서-권장)

---

## 📁 파일 구조

```
maple_diary/
├── 📄 설계 문서
│   ├── DESIGN.md                 # 전체 설계
│   ├── IMPLEMENTATION_GUIDE.md   # 구현 가이드
│   ├── DATABASE_API_GUIDE.md     # DB & API
│   └── QUICK_START.md            # 빠른 시작
│
├── app/                          # Next.js App Router
│   ├── onboarding/               # 온보딩 (5단계)
│   ├── dashboard/                # 대시보드
│   ├── record/                   # 기록 입력
│   ├── records/                  # 기록 목록
│   ├── analysis/                 # 분석
│   ├── goals/                    # 목표
│   ├── settings/                 # 설정
│   ├── auth/                     # 인증
│   └── api/                      # API 라우트
│
├── components/
│   ├── layouts/                  # 레이아웃
│   ├── cards/                    # 카드 컴포넌트
│   ├── forms/                    # 폼 컴포넌트
│   ├── charts/                   # 차트 컴포넌트
│   ├── common/                   # 공통 컴포넌트
│   └── ui/                       # 기본 UI
│
├── stores/                       # Zustand 상태관리
│   ├── useAuthStore.ts
│   ├── useRecordStore.ts
│   ├── useUserStore.ts
│   ├── useGoalStore.ts
│   └── useDashboardStore.ts
│
├── hooks/                        # Custom Hooks
│   ├── useSyncData.ts
│   └── useRecords.ts
│
├── lib/
│   ├── db/                       # 로컬 저장
│   │   └── local.ts              # IndexedDB
│   ├── api/                      # API 통신
│   │   └── mappleApi.ts
│   ├── utils/                    # 유틸리티
│   │   ├── calculations.ts       # 계산 함수
│   │   └── formatters.ts         # 포맷 함수
│   ├── migrations/               # 마이그레이션
│   │   └── localToServer.ts
│   └── types/
│       └── index.ts              # TypeScript 타입
│
├── public/                       # 정적 파일
│   ├── icons/
│   └── images/
│
├── styles/                       # 스타일
│   ├── globals.css
│   └── variables.css
│
└── .env.local                    # 환경 변수
```

---

## 🎨 UI/UX 주요 결정사항

### 디자인 철학
- **게임 대시보드 느낌**: 다크모드 기본
- **카드형 UI**: 정보를 카드 형태로 표시
- **숫자 중심**: 효율 수치를 강조
- **메이플 감성**: 파란색(#0066FF) + 금색(#FFCC00) 톤

### 색상 팔레트
```css
--primary: #0066FF;      /* 메이플 블루 */
--secondary: #FFCC00;    /* 메이플 골드 */
--bg-dark: #1A1A2E;      /* 다크 배경 */
--bg-card: #16213E;      /* 카드 배경 */
--text-light: #FFFFFF;   /* 밝은 텍스트 */
--text-dim: #A0AEC0;     /* 흐린 텍스트 */
```

### 반응형 디자인
- **Mobile First**: 모바일 최적화 (320px ~)
- **Tablet**: 768px ~
- **Desktop**: 1024px ~
- **Bottom Navigation**: 모바일에서 하단 네브(5개 탭)

---

## 💾 데이터 저장 전략

### 비로그인 사용자
- **localStorage**: 설정, 프로필, 로컬 ID
- **IndexedDB**: 모든 기록 (대용량)
- **복구 코드**: 데이터 손실 대비

### 로그인 사용자
- **Supabase DB**: 모든 기록 (source of truth)
- **IndexedDB**: 오프라인 캐시
- **자동 동기화**: 온라인 복귀 시

### 마이그레이션 옵션
1. **로컬 → 서버 이전**: 기존 로컬 데이터를 서버로 옮김
2. **서버만 사용**: 로컬 데이터는 유지, 새 기록은 서버에
3. **병합**: 로컬 + 서버 데이터 모두 유지

---

## 🔐 보안 고려사항

### 인증
- ✅ Supabase Auth + Row Level Security (RLS)
- ✅ JWT 토큰 기반 API 인증
- ✅ 리프레시 토큰 자동 갱신

### 데이터 보호
- ✅ 사용자는 자신의 데이터만 조회 가능 (RLS)
- ✅ API 호출 시 auth token 검증
- ✅ 민감 정보는 localStorage에 저장 금지

### 주의사항
- ⚠️ localStorage는 XSS에 취약 (auth token은 httpOnly cookie 권장)
- ⚠️ 조각 시세는 클라이언트 입력값 (정확도 보장 안 함)
- ⚠️ 메이플 API는 일일 10,000 요청 제한

---

## 📊 MVP 범위

### ✅ 포함 (Phase 1)
- [x] 온보딩 + 캐릭터 조회
- [x] 로컬 저장 (IndexedDB)
- [x] 기록 입력/조회/수정/삭제
- [x] 대시보드 (카드 UI)
- [x] 분석 (평균, 그래프)
- [x] 목표 설정 & 진행률
- [x] 카카오 로그인
- [x] 마이그레이션

### ❌ 제외 (Phase 2+)
- 캐릭터 선택/비교
- 맵 선택/비교
- 여러 루틴 추적
- 솔 에르다 추적
- 커뮤니티 기능
- PWA/모바일 앱

---

## 🚀 배포 가이드

### Frontend (Vercel)
```bash
# 1. Vercel 계정 생성
# 2. GitHub repo 연결
# 3. 환경 변수 설정
# 4. 자동 배포

# 또는 수동 배포
npm run build
npm run start
```

### Database (Supabase)
```bash
# 1. Supabase 프로젝트 생성
# 2. DATABASE_API_GUIDE.md의 SQL 스크립트 실행
# 3. RLS 정책 설정
```

---

## 📈 개발 타임라인

| Phase | 내용 | 예상 시간 | 난이도 |
|-------|------|---------|--------|
| 1 | 초기화 + 타입/유틸 | 4h | ⭐ |
| 2 | 상태관리 + API | 20h | ⭐⭐ |
| 3 | UI 컴포넌트 | 16h | ⭐⭐ |
| 4 | 온보딩 + 기록 입력 | 16h | ⭐⭐ |
| 5 | 대시보드 + 분석 | 20h | ⭐⭐ |
| 6 | 로그인 + 동기화 | 12h | ⭐⭐⭐ |
| 7 | 테스트 + 배포 | 12h | ⭐ |
| **Total** | **MVP 완성** | **~100h** | |

**추정 개발 기간**: 약 5-6주 (주 20시간 기준)

---

## 🤔 자주 묻는 질문

### Q: 왜 캐릭터 선택 기능이 없나요?
A: 단일 루틴 최적화에 집중하기 위해. 복잡성을 줄이고 사용자 경험을 단순화했습니다.

### Q: 로그인이 필수인가요?
A: 아니요. 로그인 없이도 모든 기능을 사용 가능합니다. 선택사항입니다.

### Q: 여러 기기에서 사용할 수 있나요?
A: 로그인 후 자동으로 동기화됩니다.

### Q: 조각의 상현가를 어떻게 설정하나요?
A: 사용자가 메이플 경매장 시세를 기반으로 직접 입력합니다.

### Q: 데이터를 내보낼 수 있나요?
A: 설정에서 JSON/CSV 내보내기 가능 (MVP에 포함)

---

## 🔗 관련 문서

- [Supabase Docs](https://supabase.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [Maple Story API](https://developer.nexon.com/)
- [Kakao Developers](https://developers.kakao.com/)

---

## 📝 라이센스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

---

## 👨‍💻 기여

설계 피드백이나 개선 사항은 언제든지 환영합니다!

---

**마지막 업데이트**: 2026년 4월 6일  
**상태**: MVP 설계 완료 ✅ (구현 대기 🚀)
