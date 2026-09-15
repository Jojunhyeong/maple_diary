# 장비 가이드 수집과 캐시

## 데이터 흐름

1. GitHub Actions가 매주 토요일 05:17 KST에 종합 랭킹의 상위·심층 페이지를 나눠 조회합니다.
2. 주간 작업은 캐릭터의 OCID·직업·전투력만 서버 전용 Supabase 색인에 저장합니다. 장비 상세는 이 단계에서 조회하지 않습니다.
3. 사용자가 `비슷한 장비 검색`을 누르면 같은 직업이며 목표 전투력의 ±25% 안에 있는 캐릭터를 가까운 순서로 고릅니다.
4. `직업 + 2,500만 전투력 구간`의 7일 캐시가 없을 때만 최대 50명의 장비를 수집합니다. 재획 잠재 장비는 제외합니다.
5. 수집 결과는 Supabase `equipment_guide_cache`에 저장되며 같은 구간의 사용자들이 공유합니다. 동시에 들어온 요청은 DB 잠금 함수가 하나만 수집하도록 제한합니다.

## 최초 설정

- Supabase SQL Editor에서 `supabase_create_equipment_guide_cache.sql`을 한 번 실행합니다.
- GitHub Actions Repository secrets에 `NEXON_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 등록합니다.
- `EQUIPMENT_GUIDE_MAX_REQUESTS` 변수는 기본 25,000회입니다.

## 장애 시 동작

- Supabase 캐시 테이블이 준비되지 않았거나 일시적으로 조회되지 않으면 기존 배포 스냅샷을 표시합니다.
- 장비 수집은 Route Handler의 응답 이후 실행되며 최대 실행 시간은 60초입니다. 화면은 2초 간격으로 완료 여부를 확인합니다.
- 2분 이상 멈춘 수집 잠금은 다음 요청이 다시 획득할 수 있습니다.
- 캐릭터 색인은 30일 안에 매주 교체합니다. 새 색인의 형식·날짜·표본 수·직업 수 검증이 실패하면 기존 색인을 유지합니다.
