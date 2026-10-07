# Serein → 옵시디언 일간노트 자동 동기화

매일 마크다운을 복사해 옵시디언에 붙여넣던 과정을 대신한다.
Firestore에서 직접 읽어 앱과 **똑같은 형식**(`exportDailyMarkdown`을 그대로 사용)으로
마크다운을 만들고, 일간노트의 `# Serein` 섹션만 갈아끼운다.

```
매일 새벽 5:30 자동 실행
  → 방금 끝난 논리적 하루(5시 경계) 데이터 조회
  → 마크다운 생성
  → 일간노트/2026년/2026년 8월/20260810월.md 의 '# Serein' 섹션 갱신
```

`# Serein` 아래에 `<!-- serein:start -->` / `<!-- serein:end -->` 표식을 심고
**그 사이만** 교체하므로, 몇 번을 돌려도 중복되지 않고 앞뒤 내용(프론트매터,
dataviewjs 블록 등)은 그대로 보존된다.

---

## 1. Firebase 서비스 계정 키 발급 (1회)

스크립트가 Firestore를 읽으려면 서비스 계정이 필요하다.

1. [Firebase 콘솔 → 프로젝트 설정 → 서비스 계정](https://console.firebase.google.com/project/trace-fa37e/settings/serviceaccounts/adminsdk) 접속
2. **새 비공개 키 생성** → JSON 파일 다운로드
3. 받은 파일을 `scripts/serviceAccountKey.json` 으로 저장

> 이 파일은 계정 전체 권한을 가진 비밀 키다. `.gitignore`에 이미 등록해 뒀으니
> 커밋되지 않지만, 외부에 공유하지 말 것.

## 2. 설정 파일 작성 (1회)

```bash
cp scripts/obsidian-sync.config.example.json scripts/obsidian-sync.config.json
```

기본값이 이미 현재 환경에 맞춰져 있다. 볼트 경로나 노트 규칙이 바뀌면 여기만 고치면 된다.

| 항목 | 설명 |
|---|---|
| `vaultPath` | 옵시디언 볼트 루트 |
| `serviceAccountPath` | 서비스 계정 키 경로 (`scripts/` 기준 상대경로) |
| `userEmail` | **Serein에 로그인할 때 쓰는 구글 계정** — 이걸로 uid를 찾는다 |
| `uid` | (선택) uid를 직접 지정하면 `userEmail` 조회를 건너뛴다 |
| `notePathTemplate` | 노트 경로 규칙. `{yyyy}` `{M}` `{yyyyMMdd}` `{ddd}`(요일) 치환 |
| `sectionEndHeading` | 표식이 없는 노트에서 섹션 끝으로 볼 헤딩 (기본 `## 📊 목표 달성률 계산`) |
| `templatePath` | 노트가 없을 때 쓸 Templater 템플릿 (기본 `Templates/daily.md`) |
| `createMissingNotes` | 노트가 없으면 템플릿으로 만들지 (기본 `true`) |

### 노트가 없는 날은 만들어 준다

옵시디언을 켜지 않은 날은 일간노트 자체가 없다. 그런 날은 `templatePath`의
Templater 템플릿을 그 날짜 기준으로 렌더링해 노트를 만든 뒤 Serein 섹션을 채운다.
필요한 폴더(`일간노트/2026년/2026년 8월/`)도 함께 만든다.

Templater 전체를 흉내 내지는 않고 이 템플릿이 쓰는 범위만 처리한다.

- `<% tp.date.now("...") %>` → 해당 날짜로 치환 (`YYYY-MM-DD`, `YYYY-MM`, `YYYY`, `ww` 등)
- `<%* ... %>` 실행 블록 → 제거 (파일명 변경용이라 불필요 — 이름은 스크립트가 정한다)
- 그 밖의 태그가 남으면 경고를 출력한다. 템플릿에 새 태그를 넣었다면 확인할 것.

> Serein 기록이 아예 없는 날은 노트를 만들지 않는다. 빈 노트를 흩뿌리지 않기 위함이다.

## 3. 시험 실행

파일을 건드리지 않고 결과만 본다:

```bash
npm run sync:obsidian -- --date 2026-08-10 --dry-run
```

내용이 맞으면 실제로 써 본다:

```bash
npm run sync:obsidian -- --date 2026-08-10
```

## 4. 매일 자동 실행 등록 (1회)

PowerShell을 **관리자로** 열고:

```powershell
$action  = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c npm run sync:obsidian" -WorkingDirectory "C:\Users\user\Downloads\trace"
$trigger = New-ScheduledTaskTrigger -Daily -At 5:30am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName "Serein-Obsidian-Sync" -Action $action -Trigger $trigger -Settings $settings -Description "Serein 기록을 옵시디언 일간노트에 동기화"
```

`-StartWhenAvailable` 덕분에 **PC가 꺼져 있어 5:30을 놓쳐도 켜지는 대로 실행**된다.
기본이 최근 2일을 훑기 때문에 하루 정도 건너뛰어도 자동으로 메워진다.

확인·해제:

```powershell
Get-ScheduledTask -TaskName "Serein-Obsidian-Sync"
Start-ScheduledTask -TaskName "Serein-Obsidian-Sync"      # 지금 바로 실행
Unregister-ScheduledTask -TaskName "Serein-Obsidian-Sync" # 등록 해제
```

---

## 사용법

```bash
npm run sync:obsidian                  # 최근 2일 (기본, 스케줄러가 쓰는 형태)
npm run sync:obsidian -- --days 30     # 최근 30일 소급 (놓친 날 메우기)
npm run sync:obsidian -- --date 2026-08-10
npm run sync:obsidian -- --dry-run     # 파일을 쓰지 않고 출력만
```

## 건드리지 않는 경우

안전을 위해 아래 상황에서는 **아무것도 쓰지 않고 건너뛴다**(로그에 이유가 남는다).

- 그날 Serein 기록이 아예 없을 때 (노트도 만들지 않는다)
- 노트에 `# Serein` 섹션이 없을 때 (예전 템플릿으로 만든 노트)
- `createMissingNotes: false` 인데 노트가 없을 때

## 문제가 생기면

---

# Toggl → 할 일 예상 소요시간

할 일에 소요시간을 직접 적지 않아도 지난 기록으로 '예상 45m'를 붙이고,
오늘 남은 할 일이 평소 취침 시각 안에 들어가는지 보여 준다. 예상의 근거는 두 가지다.

- 앱: 할 일을 체크할 때 입력한 `(30m)`
- Toggl 2.0: 타이머로 잰 실제 시간

Toggl API는 브라우저에서 직접 부를 수 없어서(CORS 허용 헤더가 없다), 이 스크립트가
기록을 받아 `users/{uid}/stats/toggl` 문서에 요약해 둔다. 앱은 그 문서만 읽는다.
**매일 도는 옵시디언 동기화가 끝에 함께 돌리므로 따로 등록할 것은 없다.**

### 설정 (1회)

`scripts/obsidian-sync.config.json`에 두 줄을 더한다.

```json
"togglApiToken": "toggl_sk_...",
"togglOrganizationId": 1234567
```

| 항목 | 어디서 찾나 |
|---|---|
| `togglApiToken` | Toggl 2.0의 API 키 (`toggl_sk_`로 시작). 새로 만들면 이전 키는 무효가 된다 |
| `togglOrganizationId` | 조직 ID. API 키로는 알아낼 수 없어 직접 적는다 |
| `togglWorkspaceId` | (선택) 없으면 Toggl 설정의 현재 워크스페이스를 쓴다 |

> Toggl **Track**의 32자리 토큰과는 다른 키다. Track 토큰을 넣으면 인증이 거절된다.

### 저장하는 것과 저장하지 않는 것

Toggl 설명에는 내담자 실명처럼 앱에 옮기고 싶지 않은 이름도 들어 있다. 그래서
**할 일 탭(날짜별·대기 목록·루틴·반복 일정)에 한 번이라도 적은 이름과 맞는 기록만**
저장한다. 맞지 않는 기록은 버리고, 프로젝트 이름만 맞으면 설명을 지운 채 프로젝트별
시간만 남긴다. 이름은 숫자·괄호·가린 이름(`신OO`)을 걷어 낸 '바탕 이름'으로 비교한다.

### 사용법

```bash
npm run sync:toggl -- --dry-run   # 받아 보기만 (저장 안 함). 무엇이 저장될지, 할 일이 얼마나 맞춰지는지 출력
npm run sync:toggl                # 최근 90일 받아서 저장
npm run sync:toggl -- --days 120
```

무료 플랜은 시간당 30회까지 부를 수 있다. 한 번 돌 때 2회를 쓴다.

### 예상 시간을 내는 순서

같은 날 같은 일이 앱과 Toggl 양쪽에 있으면 한 번만 세고 시간은 Toggl 값을 쓴다.
그 뒤 최근 8건의 중간값으로 예상한다.

1. 이름에 쪽수가 있으면(`넥서스 60`, `자폐책 40쪽`) 지난 기록의 쪽당 시간 × 쪽수
2. 똑같은 이름(`보고서 1`)의 기록
3. 바탕 이름이 같은 기록 전체(`이OO 보고서 작성` ← `신OO 보고서 작성`들)
4. Toggl 프로젝트 이름과 같으면 그 프로젝트에 하루 쓴 시간

---

# 미아 사진 정리

Storage에는 있는데 어떤 기록에서도 참조하지 않는 사진을 찾아 지운다.
업로드는 성공했지만 엔트리 저장에서 실패하면 이런 파일이 남는다.

위와 같은 설정 파일(서비스 계정·이메일)을 쓰므로 추가 설정은 없다.

```bash
npm run cleanup:photos                  # 미아 목록만 출력 (기본, 아무것도 지우지 않음)
npm run cleanup:photos -- --delete      # 실제 삭제
npm run cleanup:photos -- --min-age 180 # 3시간 이상 된 것만 대상 (기본 60분)
```

되돌릴 수 없는 작업이라 안전장치를 겹으로 뒀다.

- **기본은 보기 전용.** `--delete` 를 줘야 지운다.
- **최근 파일은 건너뛴다.** 기본 60분 이내에 올라온 파일은 업로드 진행 중일 수
  있으므로 대상에서 제외한다(`--min-age` 로 조절).
- **참조를 하나도 못 찾으면 중단한다.** 조회가 실패한 상태로 지우면 전부
  날아가기 때문. 정말 전부 미아라면 `--force` 가 필요하다.
- **컬렉션을 하드코딩하지 않는다.** 사용자 하위 컬렉션 전부를 훑어 참조를
  모은다. 하나라도 빠뜨리면 멀쩡한 사진을 미아로 오인한다.
- **path 없이 url만 있는 예전 기록도 참조로 인정한다.** URL에서 객체 경로를
  복원해 대조한다.

---

## 문제가 생기면

| 증상 | 원인 |
|---|---|
| `설정 파일이 없습니다` | 2번 단계를 건너뜀 |
| `서비스 계정 키를 찾을 수 없습니다` | 1번 단계를 건너뛰었거나 경로가 다름 |
| `... 계정을 찾을 수 없습니다` | `userEmail`이 Serein 로그인 계정과 다름. 이 경우 스크립트가 **프로젝트에 등록된 계정 목록을 출력**하니 그중 하나로 고치면 된다 |
| `노트 없음` 으로 계속 건너뜀 | `notePathTemplate`이 실제 폴더 구조와 다름 |
| `'# Serein' 섹션 없음` | 해당 노트가 옛 템플릿으로 만들어짐 — 노트에 `# Serein` 한 줄 추가 |
