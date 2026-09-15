# 장비 가이드 주간 자동 갱신

## 실행 방식

- GitHub Actions: `.github/workflows/equipment-guide-weekly.yml`
- 매주 토요일 **05:17 KST** (`17 20 * * 5` UTC). GitHub 사정에 따라 시작이 지연될 수 있습니다.
- `workflow_dispatch`로 수동 실행도 가능합니다.
- 실행 시점의 **한국 시간 전날**을 기준일로 고정합니다. 다른 날짜의 표본은 합치지 않습니다.
- 전체 직업 랭킹을 수집합니다. 실행당 기본 25,000회, 초당 최대 약 4.5회, 수집 최대 150분, 작업 전체 180분입니다.
- `EQUIPMENT_GUIDE_MAX_REQUESTS` Actions 변수로 요청 상한을 조절할 수 있습니다. **서비스용 Nexon API 키를 사용하세요.** 개발용 일일 1,000회 한도는 이 수집 규모에 부족합니다.
- 새 수집은 임시 파일에서 집계합니다. API 실패·빈 결과·기준일 불일치·표본 수 불일치 시 공개 파일을 변경하지 않습니다.
- 유효 표본 최소 100명, 이전 유효 표본의 50% 이상, 기존 직업·전투력 구간의 50% 이상을 확보해야 교체합니다. 이는 급격한 수집 누락을 탐지하는 운영 기준이며 통계적 신뢰도를 보장하지 않습니다. 검증 실패 시 상한과 수집 범위를 점검하세요.
- 통과하면 공개 집계 JSON **한 파일만** 기본 브랜치에 커밋·푸시하고 Vercel Deploy Hook을 호출합니다. 브랜치가 실행 도중 변경되어 푸시가 거부되면 재실행합니다. 강제 푸시는 하지 않습니다.
- 원본 OCID·장비 체크포인트는 임시 러너에만 남으며 Git, Actions 캐시, 아티팩트에 업로드하지 않습니다. 정기 실행은 매번 새 표본을 수집합니다.
- Deploy Hook 성공은 배포 요청 접수입니다. 실제 배포 성공 여부는 Vercel에서 확인해야 합니다.

## 활성화에 필요한 설정

1. 장비 가이드 기능과 수집 코드, 테스트, 워크플로를 **저장소 기본 브랜치**에 반영합니다. 현재 기능이 기본 브랜치에 없다면 워크플로만 먼저 올리지 마세요.
2. 저장소 Settings → Secrets and variables → Actions에서 다음 Repository secrets를 등록합니다.
   - `NEXON_API_KEY`: 서비스용 Nexon API 키.
   - `VERCEL_DEPLOY_HOOK_URL`: Vercel 프로젝트 Settings → Git → Deploy Hooks에서 생성한 URL. 반드시 워크플로가 갱신하는 **기본 브랜치와 같은 프로덕션 브랜치**를 선택합니다.
3. Actions의 쓰기 권한과 기본 브랜치의 보호 규칙이 이 워크플로의 스냅샷 커밋을 허용하는지 확인합니다. 보호 규칙을 우회하거나 해제하지 않습니다. 직접 푸시가 금지된 저장소라면 PR 방식으로 별도 전환해야 합니다.
4. Actions → Weekly equipment guide refresh → Run workflow로 첫 실행을 확인합니다.
5. 실행 요약의 기준일·유효 표본·구간 수와 Vercel Production 배포 결과를 확인합니다.

시크릿 값을 코드나 채팅에 붙여 넣지 마세요. CLI에서는 `gh secret set NEXON_API_KEY`, `gh secret set VERCEL_DEPLOY_HOOK_URL`의 보안 입력을 사용할 수 있습니다.

GitHub CLI 인증 오류가 나면 `gh auth login`으로 다시 로그인합니다. 로컬 파일 작성만으로는 자동 실행이 활성화되지 않습니다.

## 실패 시

- 수집/검증 실패: 기존 통계를 유지하며 Actions 실행이 실패합니다. 로그의 오류 코드와 요청 한도를 확인한 뒤 재실행합니다.
- 푸시 실패: 브랜치 변경 또는 쓰기 권한 문제를 확인합니다. 강제 푸시하지 않습니다.
- 배포 훅 실패: 새 스냅샷 커밋은 남습니다. Vercel에서 기본 브랜치를 재배포하거나 워크플로를 다시 실행합니다.
- 전체 요청 상한 내에서 이전 표본의 절반을 갱신하지 못한다면 상한 확대 또는 수집 대상 재설계가 필요합니다. 워크플로는 오래된 데이터의 날짜만 바꾸지 않습니다.

참고: [GitHub 예약 실행](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [Vercel Deploy Hooks](https://vercel.com/docs/deploy-hooks).
