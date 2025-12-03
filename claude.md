# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Serein: AI 기반 지능형 일상 기록 & 가계부 관리

## 🔧 개발 명령어

```bash
# 개발 서버 실행 (기본 포트: 5173)
npm run dev

# 프로덕션 빌드 (TypeScript 컴파일 + Vite 빌드)
npm run build

# 빌드 결과 미리보기
npm run preview

# ESLint로 코드 검사
npm run lint
```

## 📱 앱 개요
✨ "맑은 날 저녁에 내리는 비" - Serein
Serein은 Firebase를 기반으로 하는 지능형 일상 기록 및 가계부 관리 앱입니다. 사용자는 시간대별로 일상 활동(action)과 생각(thought)을 기록하고 관리할 수 있으며, AI(Gemini API)를 활용한 지출 자동 분류 및 통계 분석을 통해 재정 상태를 효과적으로 파악할 수 있습니다. 통합 캘린더와 타임라인 뷰를 통해 모든 기록을 한눈에 확인하고, Obsidian 마크다운 내보내기 기능을 통해 소중한 기록을 외부에서도 유연하게 활용할 수 있습니다.

## 🏗️ 프로젝트 구조

```
trace/
├── src/
│   ├── components/          # React 컴포넌트
│   │   ├── AuthContext.tsx   # 인증 컨텍스트
│   │   ├── CalendarView.tsx  # 캘린더 뷰
│   │   ├── EntryItem.tsx     # 개별 엔트리 항목
│   │   ├── InputBar.tsx      # 입력창 (일상/생각/할일)
│   │   ├── Layout.tsx        # 레이아웃
│   │   ├── SearchBar.tsx     # 검색 바
│   │   ├── Timeline.tsx      # 타임라인 메인 뷰
│   │   ├── TodoTab.tsx       # 할일 탭
│   │   ├── ExpenseCalendar.tsx    # 가계부 캘린더 (접기/펼치기)
│   │   ├── ExpenseInput.tsx       # 가계부 입력창
│   │   ├── ExpenseInsights.tsx    # 가계부 통계/인사이트
│   │   ├── ExpenseTimeline.tsx    # 가계부 타임라인
│   │   ├── WorryTab.tsx           # 고민 메인 탭
│   │   ├── WorrySelector.tsx      # 고민 선택/생성
│   │   ├── WorryInput.tsx         # 고민 기록 입력
│   │   ├── WorryTimeline.tsx      # 고민 타임라인
│   │   ├── WorryCard.tsx          # 고민 카드 아이템
│   │   ├── WorryCloseModal.tsx    # 고민 마무리 모달
│   │   ├── SettingsModal.tsx      # 설정 모달 (Gemini API 키)
│   │   └── UnifiedCalendarModal.tsx  # 통합 캘린더 모달
│   ├── services/            # Firebase 서비스
│   │   ├── firebase.ts       # Firebase 초기화
│   │   └── firestore.ts      # Firestore 데이터베이스 함수
│   ├── types/               # TypeScript 타입 정의
│   │   └── types.ts
│   ├── utils/               # 유틸리티 함수
│   │   ├── exportUtils.ts    # Obsidian 마크다운 내보내기
│   │   ├── tagUtils.ts       # 태그 파싱/추출
│   │   ├── expenseClassifier.ts  # AI 지출 자동 분류
│   │   └── dateUtils.ts      # 날짜 유틸리티
│   ├── App.tsx              # 메인 앱 컴포넌트
│   └── main.tsx             # 엔트리 포인트
├── public/
├── .env.example             # 환경 변수 템플릿
└── package.json
```

## 🔑 주요 기능

### 1. 인증 (AuthContext.tsx)
- Google OAuth 로그인
- 사용자 세션 관리

### 2. 엔트리 작성 (InputBar.tsx)
- 일상(action) / 생각(thought) / 할일(chore) 카테고리 선택
- 해시태그(#태그) 지원
- 특정 날짜/시간 선택 가능
- 할일(chore)은 고정(pin) 기능 지원

### 3. 타임라인 뷰 (Timeline.tsx)
- 날짜별 그룹화된 엔트리 표시
- 카테고리 필터링 (action/thought/all)
- 실시간 업데이트 (Firestore onSnapshot)
- Obsidian 마크다운 내보내기 (날짜별)
- 삭제 기능

### 4. 엔트리 아이템 (EntryItem.tsx)
- 시간 표시
- 해시태그 하이라이트
- 복사 버튼 (클립보드로 내용 복사)
- 삭제 버튼
- **주의**: 버튼은 호버 시에만 표시 (`group-hover`)

### 5. 캘린더 뷰 (CalendarView.tsx)
- 월별 캘린더
- 날짜별 엔트리 개수 표시
- 날짜 선택

### 6. 검색 (SearchBar.tsx)
- 엔트리 내용 검색
- 태그 검색

### 7. 💰 가계부 기능 (Expense Tracking)

#### 가계부 입력 (ExpenseInput.tsx)
- 자연어 입력: "커피 1500" → 자동으로 금액과 설명 추출
- AI 자동 카테고리 분류 (Gemini API)
  - 키워드 기반 우선 분류
  - 실패 시 AI 분류 (800ms 디바운싱)
- 카테고리: 식비, 교통, 쇼핑, 문화, 건강, 주거, 기타
- 이모지 자동 표시
- 날짜 선택 가능
- 절약 기록 (- 붙이면 수입/환불)

#### 가계부 타임라인 (ExpenseTimeline.tsx)
- 날짜별 지출 내역
- 일별 합계 표시
- 삭제 기능
- 실시간 업데이트

#### 가계부 캘린더 (ExpenseCalendar.tsx)
- 접기/펼치기 기능 (기본: 접힌 상태)
- 접힌 상태: 월별 합계만 표시
- 펼친 상태: 날짜별 지출 금액 표시
- 절약은 초록색으로 표시
- 날짜 클릭 → 해당 날짜로 입력 전환

#### 가계부 인사이트 (ExpenseInsights.tsx)
- 주간 지출 합계
- 주간 절약 합계
- 상위 지출 카테고리 (Top 3)
- 카테고리별 이모지 표시

### 8. 📅 통합 캘린더 (UnifiedCalendarModal.tsx)
- 일상 + 생각 + 지출 통합 뷰
- 날짜별 기록 개수 표시
- 날짜별 지출 합계 표시
- 선택한 날짜의 마크다운 내보내기
- 마크다운 복사 버튼
- 형식:
  ```markdown
  #### 일상
  - 14:00 산책
  
  #### 생각
  - 오늘 기분 좋음
  
  #### 지출
  - 커피 1,500원 ☕
  **합계**: 1,500원
  ```

### 9. ⚙️ 설정 (SettingsModal.tsx)
- Gemini API 키 설정
- localStorage 저장
- 지출 자동 분류에 사용

### 10. 😟 고민 추적 (Worry Tracking)
**개요**: 특정 고민에 대해 주차별로 진행 상황을 추적하는 기능. 한 번에 하나의 고민만 active 상태로 존재 가능.

#### 고민 선택 (WorrySelector.tsx)
- 새 고민 시작하기
- 현재 진행 중인 고민 표시
- 고민 마무리 (Close) 버튼

#### 고민 입력 (WorryInput.tsx)
- 3가지 타입의 기록: worry (고민), action (행동), result (결과)
- 주차(week) 자동 계산: 고민 시작일 기준
- 타입별 이모지 표시

#### 고민 타임라인 (WorryTimeline.tsx)
- 주차별 그룹화된 기록 표시
- 타입별로 구분된 UI
- 삭제 기능

#### 고민 마무리 (WorryCloseModal.tsx)
- 고민 종료 시 회고(reflection) 작성
- 4가지 회고 질문:
  - 의도한 것을 이뤘나요?
  - 의도가 변했나요?
  - 결과에 만족하나요?
  - 무엇이 변했나요?

## 🗄️ 데이터 구조

### Entry Type
```typescript
interface Entry {
    id: string;
    content: string;
    tags: string[];
    category: 'action' | 'thought' | 'chore';
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
    isPinned?: boolean;  // chore 카테고리만 사용
}
```

### Expense Type
```typescript
type ExpenseCategory = '커피/음료' | '식사' | '간식' | '교통' | '통신' | '교육'
    | '패션/미용' | '업무' | '문화/취미' | '종교/기부' | '생필품' | '공간 사용료' | '기타';

interface Expense {
    id: string;
    description: string;
    amount: number;  // 양수: 지출, 음수: 수입/환불
    category: ExpenseCategory;
    timestamp: Date;
    createdAt: Date;
}
```

### Todo Type
```typescript
interface Todo {
    id: string;  // YYYY-MM-DD 형식 (문서 ID로 사용)
    content: string;
    date: Date;
    updatedAt: Date;
}
```

### Worry Types
```typescript
type WorryStatus = 'active' | 'closed';
type WorryEntryType = 'worry' | 'action' | 'result';

interface WorryReflection {
    intentAchieved: string;
    intentChanged: string;
    satisfiedWithResult: string;
    whatChanged: string;
}

interface Worry {
    id: string;
    userId: string;
    title: string;
    status: WorryStatus;
    startDate: Date;
    closedAt?: Date;
    reflection?: WorryReflection;
    createdAt: Date;
    updatedAt: Date;
}

interface WorryEntry {
    id: string;
    worryId: string;
    week: number;  // 고민 시작일 기준 주차
    type: WorryEntryType;
    content: string;
    timestamp: Date;
    createdAt: Date;
}
```

### Firestore 컬렉션 구조
```
users/{userId}/
├── entries/{entryId}        # 일상/생각/할일
├── expenses/{expenseId}     # 지출
├── todos/{YYYY-MM-DD}       # 날짜별 투두리스트
├── worries/{worryId}        # 고민 목록
└── worryEntries/{entryId}   # 고민 관련 기록
```

## 🎨 스타일링
- Tailwind CSS 사용
- 커스텀 CSS 변수 (index.css)
- 반응형 디자인

## 🔧 주요 서비스 함수

### firestore.ts
**Entry 관련**:
- `addEntry(userId, content, tags, category, date?, collectionName?)` - 엔트리 추가
- `getEntries(userId, collectionName?)` - 엔트리 조회
- `deleteEntry(userId, entryId, collectionName?)` - 엔트리 삭제
- `toggleEntryPin(userId, entryId, currentStatus, collectionName?)` - 고정 토글

**Expense 관련**:
- `addExpense(userId, description, amount, category, date?)` - 지출 추가
- `addBatchExpenses(userId, expenses[], date?)` - 여러 지출 일괄 추가
- `getExpenses(userId, startDate?, endDate?)` - 지출 조회
- `deleteExpense(userId, expenseId)` - 지출 삭제

**Todo 관련**:
- `saveTodo(userId, date, content, collectionName?)` - 투두 저장/업데이트
- `getTodo(userId, date, collectionName?)` - 특정 날짜 투두 조회
- `getTodos(userId, startDate, endDate, collectionName?)` - 기간별 투두 조회
- `saveTemplate(userId, content, collectionName?)` - 투두 템플릿 저장
- `getTemplate(userId, collectionName?)` - 투두 템플릿 조회

**Worry 관련**:
- `createWorry(userId, title)` - 새 고민 생성 (active 고민이 이미 있으면 에러)
- `getActiveWorry(userId)` - 진행 중인 고민 조회 (최대 1개)
- `closeWorry(userId, worryId, reflection)` - 고민 마무리 (회고 포함)
- `getClosedWorries(userId)` - 마무리된 고민 목록 조회
- `addWorryEntry(userId, worryId, type, content, week)` - 고민 기록 추가
- `getWorryEntries(userId, worryId)` - 고민의 모든 기록 조회
- `deleteWorryEntry(userId, entryId)` - 고민 기록 삭제

### exportUtils.ts
- `generateMarkdown(entries, date)` - 일상/생각 마크다운 형식 생성
- `exportDailyMarkdown(date, entries, expenses)` - 통합 마크다운 생성 (일상 + 생각 + 지출)
- `copyToClipboard(text)` - 클립보드 복사

### tagUtils.ts
- `parseHashtags(content)` - 해시태그 추출

### expenseClassifier.ts
- `classifyExpenseWithAI(description)` - AI 기반 지출 카테고리 자동 분류
  - 키워드 매칭 우선
  - Gemini API fallback
- `extractAmountFromDescription(input)` - 자연어에서 금액과 설명 추출
  - 예: "커피 1500" → { description: "커피", amount: 1500 }

## 🏗️ 아키텍처 주요 특징

### 1. 실시간 업데이트
- Firestore의 `onSnapshot` 리스너 사용
- Timeline, ExpenseTimeline 등에서 실시간 데이터 동기화

### 2. 날짜 처리 전략
- **입력 시간**: `selectedDate`가 `null`일 때 항상 `new Date()` 사용 (앱 로드 시점이 아닌 입력 시점 기준)
- **Todo 문서 ID**: `YYYY-MM-DD` 형식으로 일관성 보장 (타임존 이슈 방지)
- **주차 계산**: 고민 시작일 기준으로 `differenceInWeeks` 사용

### 3. 컬렉션 네이밍 유연성
- `addEntry`, `getEntries`, `deleteEntry` 등은 `collectionName` 파라미터를 통해 다양한 컬렉션에 재사용 가능
- 기본값: `'entries'` (일상/생각/할일)
- 활용 예: `'todos'` 컬렉션도 같은 함수로 관리 가능

### 4. 제약 조건
- **고민(Worry)**: 사용자당 active 상태 고민은 최대 1개만 허용
- **고정(Pin)**: chore 카테고리 엔트리만 고정 가능

## 🔐 환경 변수 및 보안

### .env 설정
프로젝트 루트에 `.env` 파일 생성:
```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Gemini API Key (optional - for AI expense categorization)
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 보안 고려사항
- ✅ `.env` 파일은 `.gitignore`에 포함
- ✅ `.env.example`만 GitHub에 업로드
- ✅ Firebase config는 환경 변수 사용 (fallback 지원)
- ✅ Gemini API 키는 localStorage에 저장 (사용자가 직접 입력)
- ⚠️ Firebase Security Rules 설정 필수:
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if request.auth != null;
      }
    }
  }
  ```

## 🎨 UI/UX 디자인 원칙

### 탭별 시각적 구분 (Visual Distinction)
각 탭의 성격에 맞는 테마 컬러 및 스타일 적용:
- **일상 (Action)**: 🔵 **Blue** - 중립적 기록
- **생각 (Thought)**: 🟣 **Purple** + **Serif Font** - 감성적/깊이 있는 기록 (폰트 크기 축소 `text-sm`)
- **할일 (Chore)**: 🟠 **Orange** - 행동 유도
  - 고정 기능: 중요 항목 상단 고정, 📌 아이콘 표시
  - 고정된 항목은 날짜 필터와 무관하게 항상 표시

### 터치 인터랙션
- 삭제/복사 버튼은 호버 시에만 표시 (`group-hover`)
- 모바일 터치 디바이스 고려한 UI/UX

## 🐛 알려진 문제 및 해결 (History)

### 1. ✅ [해결됨] 삭제 버튼 작동 문제
**문제**: 모바일에서 삭제/복사 버튼이 보이지 않거나 클릭이 안 됨
**해결**: 터치 디바이스 고려하여 UI/UX 개선

### 2. ✅ [해결됨] 배치 입력 프리뷰 표시 문제 (2025-11-25)
**문제**: 배치 입력 시 여러 항목을 입력했지만 첫 번째 항목만 화면에 표시됨
**해결**: `ExpenseInput.tsx`의 z-index를 `z-40`으로 수정하여 탭 바 위에 표시되도록 함

### 3. ✅ [해결됨] 입력 시간 오류 (2025-11-29)
**문제**: 앱을 켜놓은 상태에서 입력 시 이전 시간(앱 로드 시점)으로 저장됨
**해결**: `InputBar.tsx`에서 `selectedDate` 초기값을 `null`로 변경하여, 날짜 미선택 시 항상 현재 시간(`new Date()`)을 사용하도록 로직 수정

### 4. ✅ [해결됨] 마크다운 복사 오류 (2025-11-29)
**문제**: 통합 캘린더에서 마크다운 복사 시 선택한 날짜가 아닌 다른 날짜(어제 등)의 투두리스트가 복사됨
**해결**: `UnifiedCalendarModal.tsx`의 `handleCopy` 함수에서 날짜 포맷팅 대신 고유 ID(`yyyy-MM-dd`)를 기준으로 투두 항목을 찾도록 수정

## 📦 의존성
- React 18
- TypeScript
- Vite
- Firebase (Auth, Firestore)
- Tailwind CSS
- date-fns
- lucide-react (아이콘)
- @google/generative-ai (Gemini API)

## 🚀 배포
- GitHub Pages 자동 배포
- `.github/workflows/deploy.yml`로 구성
- `npm run build` → `dist/` 폴더 배포
