// 엔트리에 첨부된 사진 (Firebase Storage)
export interface EntryPhoto {
    url: string;    // 다운로드 URL (표시용)
    path: string;   // Storage 경로 (삭제용)
    w?: number;     // 압축 후 가로
    h?: number;     // 압축 후 세로
}

export interface Entry {
    id: string;
    content: string;
    tags: string[];
    category: 'action' | 'thought' | 'chore' | 'book';
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
    isPinned?: boolean;
    photos?: EntryPhoto[];
}

export interface Expense {
    id: string;
    description: string;
    amount: number;
    category: ExpenseCategory;
    timestamp: Date;
    createdAt: Date;
}

/**
 * 매달 반복되는 지출(구독료 등) 등록 정보.
 * 앱을 열었을 때 이번 달 지정일이 지났고 아직 기록되지 않았으면 자동으로 지출을 만든다.
 */
export interface RecurringExpense {
    id: string;
    description: string;
    amount: number;
    category: ExpenseCategory;
    /** 매달 며칠에 나가는지 (1-31). 그 달에 없는 날짜면 말일로 당겨진다 */
    dayOfMonth: number;
    active: boolean;
    /** 마지막으로 자동 입력한 달 (yyyy-MM) — 중복 입력 방지 */
    lastPostedMonth?: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * 하루의 달성률 분모를 굳혀 두는 기준점.
 *
 * 분모가 항상 '지금 목록에 있는 전체'라면, 다 끝낸 뒤에 할 일을 적을수록
 * 달성률이 내려간다. 그래서 실제로 더 한 일을 기록하지 않는 편이 유리해진다.
 * 처음 100%를 채운 순간을 기준점으로 저장해 두고, 그 뒤에 추가한 항목은
 * 분모에 넣지 않는다.
 */
export interface TodoBaseline {
    /** 기준 시점의 전체 가중치(분). 이 값이 달성률의 분모로 고정된다 */
    weight: number;
    /** 기준 시점에 이미 완료돼 있던, 소요시간이 적힌 항목 수 */
    timedCount: number;
    /** 그 항목들의 소요시간 합계(분) */
    timedMinutes: number;
}

export interface Todo {
    id: string;
    content: string;
    date: Date;
    updatedAt: Date;
    /** 처음 100%를 채운 순간에 굳어진다. 그 전에는 없다 */
    baseline?: TodoBaseline;
    /**
     * 이 날짜에 이미 넣은 반복 일정의 id 목록.
     * 규칙 쪽에 '마지막으로 넣은 날'만 기억하면, 지운 항목이 다시 들어오거나
     * 과거 날짜를 열었다 오면 오늘 몫이 빠진다. 날짜별로 기록해야 둘 다 막힌다.
     */
    appliedRepeats?: string[];
    /**
     * 매일 루틴(템플릿)을 이 날짜에 이미 채워 넣었는지.
     * 예전에는 '문서가 없을 때'만 템플릿을 넣어서, 미리 계획을 적어 둔 날은
     * 문서가 먼저 생기는 바람에 그날이 와도 습관이 통째로 빠졌다.
     */
    templateFilled?: boolean;
}

/** 반복 일정의 주기 */
export type TodoRepeatKind =
    | 'weekly'      // 매주 그 요일
    | 'biweekly'    // 격주 그 요일 (기준 주에서 2주 간격)
    | 'monthlyNth'; // 매월 N번째 그 요일 (예: 둘째 주 수요일)

/**
 * 특정 요일·주기마다 그날 투두에 자동으로 들어가는 항목.
 *
 * 매일 반복되는 것은 '루틴 설정'의 템플릿이 담당한다. 이쪽은 요일이나
 * 주기가 정해진 일(격주 뉴스레터, 둘째 주 수요일 팟캐스트)을 맡는다.
 */
export interface RecurringTodo {
    id: string;
    /** 투두에 넣을 문구. 소요시간 표기 '(90m)'를 포함해도 된다 */
    text: string;
    kind: TodoRepeatKind;
    /** 요일 (0=일 … 6=토) */
    weekday: number;
    /** monthlyNth에서 몇 번째 주인지 (1~5) */
    nth?: number;
    /** biweekly의 기준 날짜 (yyyy-MM-dd). 이 날이 속한 주부터 2주 간격 */
    anchorDate?: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface DailyReflection {
    id: string;       // YYYY-MM-DD
    content: string;
    date: Date;
    updatedAt: Date;
}

// Search result types
export type SearchResultType = 'entry' | 'todo' | 'expense';

export interface SearchResult {
    type: SearchResultType;
    id: string;
    content: string;
    timestamp: Date;
    // Entry-specific (optional)
    tags?: string[];
    category?: 'action' | 'thought' | 'chore' | 'book';
    isPinned?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    // Todo-specific (optional)
    date?: Date;
    // Expense-specific (optional)
    amount?: number;
    expenseCategory?: ExpenseCategory;
}

export interface NavigationTarget {
    id: string;
    type: 'entry' | 'todo' | 'expense';
    category?: 'action' | 'thought' | 'chore' | 'book';
    timestamp: Date;
    date?: Date;
}

export type ExpenseCategory =
    | '커피/음료'
    | '식사'
    | '간식'
    | '교통'
    | '통신'
    | '교육'
    | '패션/미용'
    | '업무'
    | '문화/취미'
    | '종교/기부'
    | '생필품'
    | '공간 사용료'
    | '기타';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
    '커피/음료',
    '식사',
    '간식',
    '교통',
    '통신',
    '교육',
    '패션/미용',
    '업무',
    '문화/취미',
    '종교/기부',
    '생필품',
    '공간 사용료',
    '기타'
];

export const EXPENSE_CATEGORY_EMOJI: Record<ExpenseCategory, string> = {
    '커피/음료': '☕',
    '식사': '🍽️',
    '간식': '🍕',
    '교통': '🚌',
    '통신': '📱',
    '교육': '📚',
    '패션/미용': '👗',
    '업무': '💼',
    '문화/취미': '🎨',
    '종교/기부': '🙏',
    '생필품': '🛒',
    '공간 사용료': '🏢',
    '기타': '🏷️'
};

// Brain Dump types
export interface BrainDumpInsight {
    summary: string;
    themes: string[];
    emotions: string[];
    actionItems: string[];
    keyInsights: string[];
}

// 감정별 트리거 (어떤 상황/사건이 그 감정을 유발했는지)
export interface EmotionTrigger {
    emotion: string;   // 감정 (예: 😣 스트레스)
    trigger: string;   // 유발 상황/맥락
    source?: string;   // 근거가 된 기록의 날짜/인용 (검증용)
}

// AI 월간 회고
export interface MonthlyReview {
    moodSummary: string;          // 이번 달 감정 흐름 서술
    triggers: EmotionTrigger[];   // 감정별 트리거 분석
    patterns: string[];           // 감정-사건 연결/반복 패턴
    positives: string[];          // 좋았던 점
    challenges: string[];         // 힘들었던 점
    insights: string[];           // 통찰
    suggestion: string;           // 다음 달 제안
}

export interface MonthlyInsight {
    id: string;            // YYYY-MM
    review: MonthlyReview;
    entryCount: number;    // 분석에 사용된 기록 수 (재생성 판단용)
    generatedAt: Date;
}

/** 수면 점수를 올리기 위한 AI 행동 지침 */
export interface SleepAction {
    title: string;        // 행동 제목
    points: string;       // 이 행동이 노리는 점수 (예: "취침 목표 +7.7점")
    timing: string;       // 언제 하는지 (예: "22:30")
    steps: string[];      // 구체적 실행 단계
}

export interface SleepCoaching {
    diagnosis: string;          // 현재 상태 진단 (수치 근거)
    biggestLever: {
        target: string;         // 가장 먼저 손댈 항목
        expectedGain: string;   // 되찾을 점수
        why: string;            // 왜 이것부터인지
    };
    actions: SleepAction[];
    weekPlan: string[];         // 이번 주 요일별 계획
    pitfalls: string[];         // 흔한 실패 지점
    qualityNotes: string[];     // 점수엔 안 잡히지만 수면의 질에 중요한 것
}

export interface SleepCoachingRecord {
    id: string;                 // 주 시작일 (YYYY-MM-DD)
    coaching: SleepCoaching;
    scoreSnapshot: number;      // 생성 시점 총점 (재생성 판단용)
    generatedAt: Date;
}

export type BrainDumpStatus = 'writing' | 'analyzing' | 'completed';

export interface BrainDump {
    id: string;
    content: string;
    durationMinutes: number;
    actualDurationSeconds: number;
    wordCount: number;
    status: BrainDumpStatus;
    insight?: BrainDumpInsight;
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
}

export type WorryStatus = 'active' | 'closed';

export type WorryEntryType = 'worry' | 'action' | 'result';

export interface WorryReflection {
    intentAchieved: string;
    intentChanged: string;
    satisfiedWithResult: string;
    whatChanged: string;
}

export interface Worry {
    id: string;
    userId: string;
    title: string;
    status: WorryStatus;
    startDate: Date;
    closedAt?: Date;
    reflection?: WorryReflection;
    createdAt: Date;
    updatedAt: Date;
    order?: number;
}

export interface WorryEntry {
    id: string;
    worryId: string;
    week: number;
    type: WorryEntryType;
    content: string;
    timestamp: Date;
    createdAt: Date;
    parentId?: string;
}
