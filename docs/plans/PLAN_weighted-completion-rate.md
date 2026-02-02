# Implementation Plan: 가중치 기반 완료율 계산

**Status**: ✅ Complete
**Started**: 2026-02-02
**Last Updated**: 2026-02-02
**Estimated Completion**: 2026-02-02

---

**⚠️ CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date above
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to next phase

⛔ **DO NOT skip quality gates or proceed with failing checks**

---

## 📋 Overview

### Feature Description
Obsidian Dataview 스타일의 가중치 기반 완료율 계산 시스템 구현:
- 하이라이트된 항목(`==text==`)은 가중치 2배
- 계층 구조(들여쓰기)에서 부모 가중치를 자식에게 균등 분배
- 일일 달성률 및 주간 통계에 적용

### Success Criteria
- [ ] 하이라이트 항목이 2배 가중치로 계산됨
- [ ] 부모-자식 계층에서 가중치가 올바르게 분배됨
- [ ] 일일 완료율(오늘의 꼬마 사자)에 반영
- [ ] 주간 달성률(이번 주/지난 주)에 반영
- [ ] 기존 빌드 및 기능에 영향 없음

### User Impact
더 정확하고 의미 있는 달성률 표시. 중요한 작업(하이라이트)에 더 큰 비중을 부여하여 실질적인 생산성 측정 가능.

---

## 🏗️ Architecture Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| TodoItem에 weight, children 필드 추가 | 트리 구조와 가중치를 함께 관리 | 메모리 사용량 약간 증가 |
| 하이라이트 감지는 정규식 사용 | 간단하고 빠름 | 복잡한 마크다운 중첩 시 제한 |
| 계층 빌드는 들여쓰기 레벨 기반 | 기존 indent 필드 활용 가능 | 탭/스페이스 혼용 시 주의 필요 |

---

## 📦 Dependencies

### Required Before Starting
- [x] 기존 TodoTab.tsx 구조 파악 완료
- [x] parseTodos 함수 분석 완료

### External Dependencies
- 없음 (순수 로직 변경)

---

## 🚀 Implementation Phases

### Phase 1: TodoItem 타입 확장 및 하이라이트 감지
**Goal**: TodoItem에 weight 필드 추가, 하이라이트 감지 구현
**Estimated Time**: 30분
**Status**: ⏳ Pending

#### Tasks

- [ ] **Task 1.1**: TodoItem 인터페이스에 weight 필드 추가
  - File: `src/components/TodoTab.tsx`
  - 변경: `interface TodoItem`에 `weight: number` 추가

- [ ] **Task 1.2**: 하이라이트 감지 함수 구현
  - File: `src/components/TodoTab.tsx`
  - 함수: `isHighlighted(text: string): boolean`
  - 패턴: `/==.*==/` 정규식 사용

- [ ] **Task 1.3**: parseTodos에서 weight 계산 추가
  - File: `src/components/TodoTab.tsx`
  - 로직: 하이라이트면 weight=2, 아니면 weight=1

#### Quality Gate ✋
- [ ] `npm run build` 성공
- [ ] 기존 기능 동작 확인

---

### Phase 2: 트리 구조 빌드 함수 구현
**Goal**: 들여쓰기 기반 부모-자식 관계 구축
**Estimated Time**: 45분
**Status**: ⏳ Pending

#### Tasks

- [ ] **Task 2.1**: TodoNode 인터페이스 정의
  - File: `src/components/TodoTab.tsx`
  - 구조:
    ```typescript
    interface TodoNode {
      item: TodoItem;
      children: TodoNode[];
      weight: number;
    }
    ```

- [ ] **Task 2.2**: buildTaskTree 함수 구현
  - File: `src/components/TodoTab.tsx`
  - 입력: `TodoItem[]`
  - 출력: `TodoNode[]` (루트 노드 배열)
  - 로직: 들여쓰기 레벨 기반 부모-자식 연결

#### Quality Gate ✋
- [ ] `npm run build` 성공
- [ ] 콘솔에서 트리 구조 출력 확인 (디버그)

---

### Phase 3: 가중치 기반 완료율 계산 함수 구현
**Goal**: 트리 순회하며 가중치 기반 완료율 계산
**Estimated Time**: 45분
**Status**: ⏳ Pending

#### Tasks

- [ ] **Task 3.1**: calculateWeightedCompletion 함수 구현
  - File: `src/components/TodoTab.tsx`
  - 입력: `TodoNode`
  - 출력: `{ weight: number, completedWeight: number }`
  - 로직:
    - 자식 없으면: 완료 시 weight 반환, 미완료 시 0
    - 자식 있으면: 부모 weight를 자식 수로 나눠 분배 후 재귀 계산

- [ ] **Task 3.2**: calculateTotalWeightedRate 함수 구현
  - File: `src/components/TodoTab.tsx`
  - 입력: `TodoItem[]`
  - 출력: `number` (0-100 퍼센트)
  - 로직: buildTaskTree → 루트 노드들 순회 → 합산 → 백분율

#### Quality Gate ✋
- [ ] `npm run build` 성공
- [ ] 테스트 케이스로 계산 검증:
  - 단순 2개 (1완료, 1미완료) → 50%
  - 하이라이트 1개 완료 + 일반 1개 미완료 → 66%
  - 부모(자식2개) 구조 테스트

---

### Phase 4: 기존 통계 함수에 적용
**Goal**: calculateWeeklyStats, 일일 완료율에 가중치 계산 적용
**Estimated Time**: 30분
**Status**: ⏳ Pending

#### Tasks

- [ ] **Task 4.1**: calculateWeeklyStats 수정
  - File: `src/components/TodoTab.tsx`
  - 변경: `items.filter(item => item.checked).length` → `calculateTotalWeightedRate(items)`
  - 영향: thisWeek.avgPercentage, lastWeek.avgPercentage

- [ ] **Task 4.2**: 일일 완료율(오늘의 꼬마 사자) 수정
  - File: `src/components/TodoTab.tsx`
  - 변경: todayItems 기반 가중치 완료율 계산

- [ ] **Task 4.3**: UI 확인 및 테스트
  - 하이라이트 항목 완료 시 비율 변화 확인
  - 계층 구조 항목 완료 시 비율 변화 확인

#### Quality Gate ✋
- [ ] `npm run build` 성공
- [ ] 실제 앱에서 달성률 표시 확인
- [ ] 기존 레벨 시스템 정상 동작 확인

---

## ⚠️ Risk Assessment

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| 들여쓰기 파싱 오류 | Medium | Medium | 기존 indent 로직 재사용, 엣지케이스 테스트 |
| 성능 저하 (큰 투두) | Low | Low | 메모이제이션 고려, 실측 후 최적화 |
| 기존 통계 오작동 | Low | High | 단계별 검증, 롤백 준비 |

---

## 🔄 Rollback Strategy

### If Any Phase Fails
**Steps to revert**:
- `git checkout -- src/components/TodoTab.tsx`
- 또는 git stash로 변경사항 임시 저장

---

## 📊 Progress Tracking

### Completion Status
- **Phase 1**: ✅ 100%
- **Phase 2**: ✅ 100%
- **Phase 3**: ✅ 100%
- **Phase 4**: ✅ 100%

**Overall Progress**: 100% complete

---

## 📝 Notes & Learnings

### Implementation Notes
- (구현 중 추가 예정)

---

## 📚 References

### 원본 Obsidian Dataview 코드
사용자가 제공한 JavaScript 코드 참조

---

**Plan Status**: ⏳ Pending
**Next Action**: Phase 1 시작 - TodoItem 타입 확장
**Blocked By**: None
