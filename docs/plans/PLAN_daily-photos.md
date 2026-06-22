# 구현 계획: 일상 사진 (Daily Photos) — Firebase Storage

**Status**: 🔄 진행 예정
**Started**: 2026-06-12
**Last Updated**: 2026-06-12
**Estimated Completion**: (Phase 진행에 따라 갱신)

---

**⚠️ 진행 규칙**: 각 Phase 완료 후
1. ✅ 완료된 태스크 체크박스 체크
2. 🧪 Quality Gate 검증 명령 실행
3. ⚠️ Gate 항목 전부 통과 확인
4. 📅 위 "Last Updated" 갱신
5. 📝 Notes에 배운 점 기록
6. ➡️ 그다음 Phase로 진행

⛔ **Quality Gate를 건너뛰거나 실패 상태로 다음 Phase로 넘어가지 말 것**

> **테스트 정책(이 프로젝트 합의)**: 기존 테스트 인프라가 없으므로, **순수 유틸만 Vitest 단위테스트**하고 나머지(React UI·Firebase I/O)는 **`tsc`/`build`/`lint` + 브라우저 수동검증(Chrome MCP)**을 1차 게이트로 삼는다. 풀 TDD 80% 커버리지는 적용하지 않는다.

---

## 📋 Overview

### 기능 설명
일상 사진을 앱에 올려 일상(action) 엔트리에 첨부하고, 타임라인·캘린더·갤러리에서 다시 보는 기능. 저장은 **Firebase Storage**(기존 Firebase 프로젝트), 메타데이터는 Firestore의 엔트리에 부가한다. 업로드 전 브라우저에서 리사이즈/압축해 용량을 절감한다.

### Success Criteria
- [ ] 일상 엔트리에 사진 1~N장을 첨부해 저장할 수 있다
- [ ] 타임라인 엔트리에서 썸네일을 보고, 탭하면 전체화면 라이트박스로 본다
- [ ] 엔트리 삭제 시 스토리지의 사진 파일도 함께 정리된다
- [ ] 통합 캘린더/타임라인 날짜에 "오늘의 한 장" 대표 썸네일이 보인다
- [ ] 날짜별 사진 갤러리에서 한눈에 훑고 해당 엔트리로 점프할 수 있다
- [ ] 사진은 본인만 읽고 쓸 수 있다(보안규칙)

### User Impact
글 위주 기록에 시각적 기억이 더해져 회고 가치가 커진다. 압축 덕분에 무료 5GB로도 수년치 일상 사진을 담을 수 있다.

---

## 🏗️ Architecture Decisions

| 결정 | 근거 | 트레이드오프 |
|---|---|---|
| Firebase Storage `users/{uid}/photos/{id}.jpg` | 기존 Firebase에 native, 보안규칙 owner-only, `<img src>` 직접 표시 | 활성화 시 Blaze 결제계정 연결 필요(5GB까지 $0) |
| 업로드 전 canvas 압축(긴 변 1600px, JPEG ~0.82), **단일 최적화 이미지** | 한 장이 썸네일·전체보기 겸용 → MVP 단순, ~200~400KB | 초고해상도 원본 보존 안 함(일상 기록엔 충분) |
| 메타데이터 `Entry.photos?: EntryPhoto[]` (선택 필드) | 기존 엔트리에 부가 → DB 마이그레이션 불필요, 여러 장 허용 | 사진이 엔트리에 종속(독립 사진은 Phase 5에서 갤러리로 보완) |
| client SDK 직접 업로드(`uploadBytes`+`getDownloadURL`) | 서버리스 → GitHub Pages 정적 호스팅과 호환 | 업로드 진행/재시도 로직을 클라이언트가 담당 |
| 엔트리 삭제 시 `deleteObject`로 스토리지 정리 | 고아 파일 방지 | 부분 실패 가능성 → best-effort + 로깅 |

---

## 📦 Dependencies

### 시작 전 필수 (사용자 1회 작업)
- [ ] **Firebase Storage 활성화**: 콘솔 → Build → Storage → 시작하기 (Blaze 요구 시 연결, 5GB 무료)
- [ ] **보안 규칙 적용** (Storage → Rules):
  ```
  rules_version = '2';
  service firebase.storage {
    match /b/{bucket}/o {
      match /users/{userId}/{allPaths=**} {
        allow read: if request.auth != null && request.auth.uid == userId;
        // create/update만 크기·타입 조건 (delete는 request.resource가 null이라 분리 필수!)
        allow create, update: if request.auth != null && request.auth.uid == userId
          && request.resource.size < 5 * 1024 * 1024
          && request.resource.contentType.matches('image/.*');
        allow delete: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
  ```
  > ⚠️ **주의**: `allow write` 하나로 묶으면 삭제가 막힙니다. 삭제 요청은 `request.resource`가 없어 `request.resource.size` 조건이 실패하기 때문. 반드시 위처럼 `create, update`와 `delete`를 분리.
- [ ] `VITE_FIREBASE_STORAGE_BUCKET` 환경변수 (이미 `firebase.ts`에 구성됨 ✅)

### External Dependencies
- `firebase` ^12.6.0 (Storage SDK 포함 — 추가 설치 불필요) ✅
- `vitest` (devDep, Phase 1에서 추가) — 순수 유틸 단위테스트용
- (Phase 4 선택) EXIF 파싱: 가벼운 직접 파서 또는 `exifr` 등 — 도입 시 재검토

---

## 🧪 Test Strategy

### 접근
- **순수 함수**(예: `computeTargetSize`, EXIF/날짜 헬퍼): **Vitest 단위테스트**(빠름, 의존성 없음)
- **React UI / Firebase I/O**: `tsc`/`build`/`lint` + **Chrome MCP 브라우저 수동검증**(이번 세션 내내 효과적이었던 방식)

### 검증 명령
```bash
npx vitest run        # 단위테스트 (Phase 1 도입 후)
npx tsc --noEmit      # 타입체크
npm run build         # tsc -b && vite build
npm run lint          # eslint
```

### 커버리지 목표
- 순수 유틸: 핵심 분기 커버(행복경로 + 경계). 전체 라인 커버리지 강제 없음.
- UI/IO: 수동 체크리스트 통과로 대체.

---

## 🚀 Implementation Phases

### Phase 1: 업로드 파이프라인 & 데이터 모델 (토대)
**Goal**: File → 압축 Blob → Storage 업로드 → `{url, path}` 반환하는 검증된 유틸과 데이터 타입. (UI 없음)
**Estimated Time**: 1.5~2h
**Status**: ✅ 완료 (코드·단위테스트·빌드·린트) — 업로드 실연동 검증은 Storage 활성화 후 Phase 2/3에서

> **설계 메모**: 순수 함수를 Firebase 초기화 없이 단위테스트하려고 모듈 분리 — `imageResize.ts`(순수 `computeTargetSize` + DOM `compressImage`) / `imageUpload.ts`(Storage `uploadEntryPhoto`·`deletePhoto`). 테스트 파일은 `src/utils/__tests__/imageResize.test.ts`. Vitest는 `vitest.config.ts`(node 환경)로 분리해 PWA/React 빌드 설정과 격리.

#### Tasks
**🔴 RED — 순수 로직 테스트 먼저**
- [x] **Test 1.1**: `computeTargetSize` 단위테스트 (`imageResize.test.ts`, 6케이스: 가로/세로/정사각/축소안함/경계/방어)
- [x] **Task 1.2**: Vitest 설정 (`vitest` devDep, `vitest.config.ts`, package.json `"test": "vitest run"`)

**🟢 GREEN — 구현**
- [x] **Task 1.3**: `firebase.ts`에 `export const storage = getStorage(app)`
- [x] **Task 1.4**: `imageResize.ts`(computeTargetSize·compressImage) + `imageUpload.ts`(uploadEntryPhoto·deletePhoto)
- [x] **Task 1.5**: `types.ts` — `EntryPhoto`, `Entry.photos?`

**🔵 REFACTOR**
- [x] **Task 1.6**: HEIC 폴백(createImageBitmap 실패 시 `<img>`), 입력 방어, 주석

#### Quality Gate ✋
- [x] `npm test` (vitest) — 6/6 통과
- [x] `npm run build` (tsc -b + vite build) 통과
- [x] `npm run lint` 통과
- [ ] (수동·Storage 활성화 후) 실제 업로드 1장 → URL 반환 — Phase 2/3 업로드 UI에서 함께 검증

**Manual Test Checklist** (Phase 2/3 업로드 UI에서 검증)
- [ ] 큰 이미지(>1600px)가 긴 변 1600px로 리사이즈됨
- [ ] 작은 이미지는 확대되지 않음
- [ ] 업로드 결과 URL이 `<img>`로 열림

---

### Phase 2: 입력 — InputBar 사진 첨부
**Goal**: InputBar에서 사진을 고르거나(모바일 카메라 포함) 붙여넣기/드래그드롭해 미리보고, 제출 시 압축·업로드해 엔트리에 첨부.
**Estimated Time**: 2~3h
**Status**: ⏳ Pending
**Dependencies**: Phase 1

#### Tasks
**🟢 GREEN**
- [ ] **Task 2.1**: `firestore.addEntry`가 `photos`를 받도록 확장(시그니처 끝에 `photos: EntryPhoto[] = []` 또는 extraData 경유)
- [ ] **Task 2.2**: `InputBar.tsx`
  - 📷 버튼 → 숨김 `<input type="file" accept="image/*" multiple>` (+ 모바일 `capture`)
  - 붙여넣기(`onPaste`)·드래그드롭 핸들러로 이미지 수집
  - 선택 이미지 로컬 미리보기(object URL) + 개별 제거
  - 제출: 각 이미지 `compressImage`→`uploadEntryPhoto` 후 `addEntry({photos})`
  - 업로드 중 진행/비활성 표시, 실패 시 토스트
- [ ] **Task 2.3**: object URL 정리(`revokeObjectURL`)로 메모리 누수 방지

**🔵 REFACTOR**
- [ ] **Task 2.4**: 업로드 로직을 훅/유틸로 분리, 다수 업로드 순차 처리

#### Quality Gate ✋
- [ ] `npx tsc --noEmit` / `npm run build` / `npm run lint` 통과
- [ ] (수동/Chrome MCP) 사진 선택 → 미리보기 → 제출 → 엔트리에 photos 저장 확인(Firestore)
- [ ] 붙여넣기·드래그드롭 동작
- [ ] 업로드 실패 시 엔트리에 깨진 사진이 남지 않음

**Manual Test Checklist**
- [ ] 여러 장 첨부 후 제출 정상
- [ ] 미리보기에서 1장 제거 후 제출 시 그 장 제외
- [ ] 업로드 중 중복 제출 방지

---

### Phase 3: 표시 — EntryItem 썸네일 + 라이트박스 + 삭제 정리  ← **MVP 완료 지점**
**Goal**: 엔트리에 썸네일 표시, 탭 시 전체화면 라이트박스(여러 장 이동), 엔트리 삭제 시 스토리지 파일 정리.
**Estimated Time**: 2~3h
**Status**: ⏳ Pending
**Dependencies**: Phase 1, 2

#### Tasks
**🟢 GREEN**
- [ ] **Task 3.1**: `EntryItem.tsx` — `entry.photos`를 썸네일 그리드(`<img loading="lazy">`)로, 1/2/3+ 레이아웃
- [ ] **Task 3.2**: `Lightbox.tsx`(신규) — 전체화면 오버레이, prev/next, 키보드/스와이프, 닫기
- [ ] **Task 3.3**: `Timeline.handleDelete`에서 엔트리의 `photos[].path`를 `deletePhoto`로 정리 후 `deleteEntry`

**🔵 REFACTOR**
- [ ] **Task 3.4**: 썸네일/라이트박스 접근성(alt, aria), 로딩 placeholder

#### Quality Gate ✋
- [ ] `npx tsc --noEmit` / `npm run build` / `npm run lint` 통과
- [ ] (수동/Chrome MCP) 썸네일 표시 → 탭 → 라이트박스 → 여러 장 이동 → 닫기
- [ ] 엔트리 삭제 후 Storage에 해당 파일이 남지 않음
- [ ] 사진 없는 엔트리는 레이아웃 변화 없음(회귀 없음)

**Manual Test Checklist**
- [ ] 1장/3장 엔트리 레이아웃 정상
- [ ] 라이트박스 prev/next·닫기
- [ ] 삭제 시 스토리지 정리(콘솔 확인)

---

### Phase 4: 오늘의 한 장 — 캘린더/타임라인 썸네일
**Goal**: 날짜별 대표 사진(그날 첫 사진)을 타임라인 날짜 헤더 + 통합 캘린더 날짜칸에 작은 썸네일로.
**Estimated Time**: 2~3h
**Status**: ⏳ Pending
**Dependencies**: Phase 3

#### Tasks
**🔴 RED**
- [ ] **Task 4.1**: `getRepresentativePhotoByDate(entries)` 순수 헬퍼 단위테스트(날짜별 첫 사진 선택, 없으면 undefined)
**🟢 GREEN**
- [ ] **Task 4.2**: 헬퍼 구현 + `Timeline` 날짜 헤더에 썸네일
- [ ] **Task 4.3**: `UnifiedCalendarModal` 기록 탭 날짜칸에 썸네일(없는 날은 기존 표시 유지)
**🔵 REFACTOR**
- [ ] **Task 4.4**: 캘린더 셀 과밀 방지(작은 썸네일/투명도), 성능(메모)

#### Quality Gate ✋
- [ ] `npx vitest run` / `tsc` / `build` / `lint` 통과
- [ ] (수동) 사진 있는 날에 썸네일, 없는 날 영향 없음

**Manual Test Checklist**
- [ ] 타임라인 날짜 헤더 썸네일
- [ ] 캘린더 날짜칸 썸네일 + 클릭 시 해당 날짜 동작 유지

---

### Phase 5: 갤러리 뷰
**Goal**: 날짜별 사진 그리드(앱 안의 미니 구글포토) + 라이트박스 + 해당 엔트리로 점프.
**Estimated Time**: 2~3h
**Status**: ⏳ Pending
**Dependencies**: Phase 3

#### Tasks
**🟢 GREEN**
- [ ] **Task 5.1**: `entries`에서 모든 사진을 날짜 역순으로 수집하는 셀렉터
- [ ] **Task 5.2**: `PhotoGallery.tsx`(신규) — 날짜 섹션 + 정사각 썸네일 그리드, 라이트박스 재사용
- [ ] **Task 5.3**: 진입점(헤더 아이콘 또는 통합 캘린더 탭), 사진 탭 → 엔트리로 점프
**🔵 REFACTOR**
- [ ] **Task 5.4**: 가상화/지연로딩(사진 많을 때), 빈 상태 UI

#### Quality Gate ✋
- [ ] `tsc` / `build` / `lint` 통과
- [ ] (수동) 갤러리 그리드·라이트박스·엔트리 점프 동작, 사진 많아도 스크롤 부드러움

**Manual Test Checklist**
- [ ] 날짜별 섹션·그리드 정상
- [ ] 라이트박스 재사용 동작
- [ ] 빈 상태(사진 0장) 안내

---

## ⚠️ Risk Assessment

| 리스크 | 확률 | 영향 | 완화 |
|---|---|---|---|
| Storage 활성화 시 Blaze 결제계정 요구 | 중 | 중 | 사전작업으로 안내, 5GB까지 $0 |
| iPhone HEIC가 canvas 디코딩 실패(데스크톱 브라우저) | 중 | 중 | iOS Safari는 가능. 실패 시 원본 업로드 폴백 + jpeg/png 권장 안내. 필요 시 변환 라이브러리 검토 |
| 업로드 성공 후 엔트리 저장 실패 → 고아 파일 | 저 | 저 | 엔트리 저장 성공 후 확정, 실패 시 업로드분 `deletePhoto` cleanup |
| 다수/대용량 이미지 압축 시 UI 멈춤 | 저 | 중 | 치수 캡·순차 처리, 필요 시 `createImageBitmap`/`OffscreenCanvas` |
| 무료 다운로드 대역폭(1GB/일) 초과 | 저 | 저 | 개인용·압축으로 충분, 썸네일 재사용 |
| 보안규칙 미적용 → 업로드 실패 또는 노출 | 저 | 고 | 사전작업에 정확한 규칙 명시, 적용 확인 후 Phase 2 진행 |

---

## 🔄 Rollback Strategy

- **공통**: 각 Phase는 독립 커밋. 문제 시 해당 커밋 `git revert`. `Entry.photos`는 **선택 필드**라 기존 데이터/엔트리에 영향 없음(마이그레이션 불필요).
- **Phase 1 실패**: `imageUpload.ts`·`storage` export·타입 추가 되돌림. 스토리지 영향 없음.
- **Phase 2 실패**: InputBar 변경 되돌림. 이미 업로드된 더미 파일은 콘솔/`deletePhoto`로 정리.
- **Phase 3 실패**: EntryItem/Lightbox/삭제 정리 되돌림. 사진은 Firestore에 남아 데이터 손실 없음.
- **Phase 4·5 실패**: 표시 전용이라 되돌려도 사진 데이터 무영향.

---

## 📊 Progress Tracking

### 완료 상태
- **Phase 1**: ✅ 100%
- **Phase 2**: ✅ 100% (첨부·미리보기·압축·업로드·저장 브라우저 검증)
- **Phase 3**: ✅ 100% — **MVP 완료** (썸네일·라이트박스·삭제 시 스토리지 정리까지 검증)
- **Phase 4**: ⏳ 0%
- **Phase 5**: ⏳ 0%

**Overall**: 60%

### 검증 메모 (Phase 2/3)
- 첨부→압축(2000→1600px)→Storage 업로드→엔트리 저장→썸네일→라이트박스 전부 브라우저 실측 OK.
- **버그 1 (해결)**: `loading="lazy"` 동적 렌더 썸네일이 안 뜸 → lazy 제거.
- **버그 2 (해결, 룰)**: 삭제 시 `storage/unauthorized`. Storage 룰을 `allow write`→`allow create,update`(조건) + `allow delete`(무조건)로 분리해야 함. 사용자 적용 후 삭제 정리 정상(삭제된 URL 403 확인).
- 잔여: 룰 수정 전 테스트로 만든 고아 사진 1장(`...84ad0c5c....jpg`)이 Storage에 남음 — 콘솔에서 수동 삭제 가능.

### 시간
| Phase | 예상 | 실제 | 차이 |
|---|---|---|---|
| 1 | 1.5~2h | - | - |
| 2 | 2~3h | - | - |
| 3 | 2~3h | - | - |
| 4 | 2~3h | - | - |
| 5 | 2~3h | - | - |
| **합계** | ~10~14h | - | - |

---

## 📝 Notes & Learnings
- (구현 중 발견·결정·디버깅 메모)

### Blockers
- (발생 시 기록)

---

## 📚 References
- Firebase Storage(web): https://firebase.google.com/docs/storage/web/start
- Storage 보안규칙: https://firebase.google.com/docs/storage/security
- 관련 파일: `src/services/firebase.ts`, `src/services/firestore.ts`, `src/types/types.ts`, `src/components/InputBar.tsx`, `src/components/EntryItem.tsx`, `src/components/Timeline.tsx`, `src/components/UnifiedCalendarModal.tsx`

---

## ✅ Final Checklist
- [ ] 전 Phase Quality Gate 통과
- [ ] 사진 첨부→표시→삭제 정리 통합 동작 확인
- [ ] 캘린더/갤러리 표시 확인
- [ ] 보안규칙 적용·검증
- [ ] 모바일(카메라·붙여넣기) 동작 확인
- [ ] 계획 문서 보관

---

**Plan Status**: 🔄 진행 중 (Phase 1 완료)
**Next Action**: Phase 2(InputBar 사진 첨부) — 코드는 바로 진행 가능, 업로드 실테스트는 Storage 활성화 후
**Blocked By**: 업로드 실연동 테스트는 Firebase Storage 활성화(사용자 1회 작업) 필요 — 코드 작성은 무관
