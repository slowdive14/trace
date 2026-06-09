export interface Entry {
    id: string;
    content: string;
    tags: string[];
    category: 'action' | 'thought' | 'chore' | 'book';
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
    isPinned?: boolean;
}

export interface Expense {
    id: string;
    description: string;
    amount: number;
    category: ExpenseCategory;
    timestamp: Date;
    createdAt: Date;
}

export interface Todo {
    id: string;
    content: string;
    date: Date;
    updatedAt: Date;
}

export interface DailyReflection {
    id: string;       // YYYY-MM-DD
    content: string;
    date: Date;
    updatedAt: Date;
}

// Search result types
export type SearchResultType = 'entry' | 'todo';

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
}

export interface NavigationTarget {
    id: string;
    type: 'entry' | 'todo';
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
