# 장비 가이드 실제 표본 수집

`npm run collect:equipment-guide`는 `.env.local`의 서버 API 키 `NEXON_API_KEY`(기존 `NEXT_PUBLIC_MAPLE_API_KEY` 호환)를 사용해 Nexon 공식 API만 조회합니다. 키는 출력하거나 스냅샷에 저장하지 않습니다.

- 직업 필터 없는 종합 랭킹의 여러 페이지에서 분산 추출 → OCID 조회 → 동일 날짜 전투력·실제 착용 장비 조회 → 직업별 근접 전투력 표본 생성.
- 직업을 제한하지 않고 페이지당 전체 최대 200명을 수집합니다. 실제 캐릭터 응답의 직업으로 분류합니다. 1/5/15/40/100/200페이지를 먼저 방문한 뒤 사이의 모든 페이지와 201페이지 이후를 순서대로 조회합니다. 인원 목표나 페이지 상한은 없습니다. 빈 페이지가 나오면 그 이상의 페이지를 조회하지 않습니다. 랭킹 편향은 여전히 있습니다.
- `GUIDE_PAGES=1,2,3 GUIDE_PER_PAGE=100 npm run collect:equipment-guide`로 수집 범위를 제한할 수 있습니다. `GUIDE_DATE=YYYY-MM-DD`는 기준일을 지정합니다. 기본값은 한국 시간 어제입니다. **이어 수집할 때는 이전과 같은 날짜를 지정하세요.** 다른 날짜의 캐릭터를 합쳐 표본을 부풀리지 않습니다.
- `GUIDE_MAX_REQUESTS=1000`처럼 실행당 요청 상한을 선택할 수 있습니다. 기본값은 상한 없음이며 API 제한에 반복해서 걸리면 저장 후 종료합니다. 전체 랭킹 수집은 수 시간 이상 걸릴 수 있습니다.
- 초당 최대 약 4.5회 순차 조회, 429/5xx 제한 재시도. 실패 또는 SIGINT/SIGTERM 시 진행 상황을 저장하고 종료합니다. 20명마다 체크포인트를 저장하고 완료한 페이지와 행은 재실행 시 건너뜁니다. 같은 날짜로 재실행하면 완료한 캐릭터를 중복 집계하지 않습니다. 종합 랭킹에서 받은 이름이 OCID 조회 사이에 사용 불가해진 경우만 해당 캐릭터를 건너뜁니다. 잘못된 API 키·다른 엔드포인트의 파라미터·준비 중인 데이터 오류는 중단합니다.
- `.cache/equipment-guide/collector.lock`으로 동시 실행을 막습니다. 강제 종료로 잠금이 남으면 파일에 기록된 PID가 실행 중인지 확인한 후에만 잠금을 삭제하세요.
- 공개 통계는 직업별로 내 전투력과 가까운 캐릭터를 최대 50명까지 묶어 생성합니다. `.cache/equipment-guide/YYYY-MM-DD-coverage.json`은 수집 편향을 점검하기 위한 5천만 단위 운영 보고서입니다. 부위별 표본은 빈 슬롯 때문에 더 적을 수 있습니다.
- `npm run collect:equipment-guide -- --aggregate-only`는 네트워크 요청 없이 해당 날짜의 로컬 체크포인트를 재집계합니다.
- 원본 최소 필드와 OCID는 Git 제외 경로 `.cache/equipment-guide/`에만 저장합니다. 날짜별 체크포인트는 로컬 재개용이며 장기 보관하지 마세요.
- 공개 파일 `src/shared/data/equipment-guide-snapshot.json`에는 닉네임·OCID 없이 집계만 저장합니다. 파일이 갱신되면 빌드·배포해야 사이트에 반영됩니다. 방문자의 화면 조회가 Nexon API 대량 호출을 발생시키지 않습니다.
- 새 수집의 표본이 기존 공개 파일보다 적거나 기준일이 더 오래되면 공개 파일을 덮어쓰지 않고 로컬 체크포인트에만 저장합니다.
- 주 1회 실행할 GitHub Actions 워크플로를 추가했습니다. 기본 브랜치 반영·시크릿 설정 등 [활성화 절차](../docs/equipment-guide-weekly.md)를 완료해야 실제 실행됩니다. 기준일로부터 30일 지난 통계는 API에서 표시하지 않습니다.
- 아이템 드롭률 또는 메소 획득량 잠재가 장착 장비 하나에라도 있으면 재획 세팅으로 판단해 해당 캐릭터의 모든 장비를 표본에서 제외합니다. 공개 스냅샷에 제외 표본 수도 기록합니다.
- 빈 슬롯·미조회 옵션을 임의 수치로 채우지 않습니다. 아이템 비율의 분모는 부위 착용자, 스타포스·잠재 분포의 분모는 대표 아이템 착용자입니다. 서로 다른 잠재 옵션은 합치지 않고 방어율 무시는 개별 줄을 유지합니다.

검증: `node --experimental-strip-types --test scripts/equipment-guide.test.mjs scripts/equipment-guide-plan.test.mjs scripts/equipment-guide-collector.test.mjs`

장비 가이드는 등록한 활성 캐릭터의 직업·전투력을 기본 비교 기준으로 사용합니다. 직업 제한 목록은 없으며 표본 미확보 시 빈 통계와 내 장비를 표시합니다. 전체 직업 수집은 기존 캐릭터 캐시를 재사용하되 진행 위치는 `YYYY-MM-DD-progress-all-jobs-200.json`으로 별도 관리합니다.

## 확대 수집 실행 및 확인

기존 2026-09-10 표본에 이어 수집:

```sh
GUIDE_DATE=2026-09-10 npm run collect:equipment-guide
```

이번 실행 로그는 `.cache/equipment-guide/2026-09-10-collection.log`에 저장합니다. `eligible`은 재획 세팅 제외 후 유효 캐릭터 수, `cohorts`는 생성된 직업·근접 전투력 표본 수, `published`는 로컬 공개 스냅샷 반영 여부입니다. 배포 완료를 뜻하지 않습니다.

API 제한으로 종료되면 한도 회복 후 같은 날짜로 다시 실행합니다. 제한에 걸렸다고 키를 교체해 우회하지 않습니다.

공식 문서: https://openapi.nexon.com/game/maplestory/
