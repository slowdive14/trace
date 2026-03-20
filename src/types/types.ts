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
