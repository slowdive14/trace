# Serein: AI 기반 지능형 일상 기록 & 가계부 관리


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
│   │   ├── InputBar.tsx      # 입력창
│   │   ├── Layout.tsx        # 레이아웃
│   │   ├── SearchBar.tsx     # 검색 바
│   │   ├── Timeline.tsx      # 타임라인 메인 뷰
│   │   ├── ExpenseCalendar.tsx    # 가계부 캘린더 (접기/펼치기)
│   │   ├── ExpenseInput.tsx       # 가계부 입력창
│   │   ├── ExpenseInsights.tsx    # 가계부 통계/인사이트
│   │   ├── ExpenseTimeline.tsx    # 가계부 타임라인
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
│   │   └── expenseClassifier.ts  # AI 지출 자동 분류
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
- 일상(action) / 생각(thought) 카테고리 선택
- 해시태그(#태그) 지원
- 특정 날짜/시간 선택 가능

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

## 🗄️ 데이터 구조

### Entry Type
```typescript
interface Entry {
    id: string;
    content: string;
    tags: string[];
    category: 'action' | 'thought';
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
}
```

### Expense Type
```typescript
type ExpenseCategory = '식비' | '교통' | '쇼핑' | '문화' | '건강' | '주거' | '기타';

interface Expense {
    id: string;
    description: string;
    amount: number;  // 양수: 지출, 음수: 수입/환불
    category: ExpenseCategory;
    timestamp: Date;
    createdAt: Date;
users/{userId}/entries/{entryId}
users/{userId}/expenses/{expenseId}
```

## 🎨 스타일링
- Tailwind CSS 사용
- 커스텀 CSS 변수 (index.css)
- 반응형 디자인

## 🔧 주요 서비스 함수

### firestore.ts
**Entry 관련**:
- `addEntry(userId, content, tags, category, date?)` - 엔트리 추가
- `getEntries(userId)` - 엔트리 조회
- `deleteEntry(userId, entryId)` - 엔트리 삭제

**Expense 관련**:
- `addExpense(userId, description, amount, category, date?)` - 지출 추가
- `getExpenses(userId)` - 지출 조회
- `deleteExpense(userId, expenseId)` - 지출 삭제

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

## � 환경 변수 및 보안

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

## �🐛 알려진 문제

### 10. 📌 고정 기능 (Pin Feature)
- **대상**: 할일(Chore) 탭
- **기능**: 중요 항목 상단 고정
- **UI**:
  - 고정된 항목은 '고정된 할일' 섹션으로 분리되어 최상단 표시
  - 📌 아이콘으로 상태 표시
  - 날짜 필터와 무관하게 항상 표시됨

### 11. 🎨 시각적 구분 (Visual Distinction)
각 탭의 성격에 맞는 테마 컬러 및 스타일 적용:
- **일상 (Action)**: 🔵 **Blue** - 중립적 기록
- **생각 (Thought)**: 🟣 **Purple** + **Serif Font** - 감성적/깊이 있는 기록 (폰트 크기 축소 `text-sm`)
- **할일 (Chore)**: 🟠 **Orange** - 행동 유도

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
