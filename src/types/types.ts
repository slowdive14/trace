export interface Entry {
    id: string;
    content: string;
    tags: string[];
    category: 'action' | 'thought' | 'chore';
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
}

export interface WorryEntry {
    id: string;
    worryId: string;
    week: number;
    type: WorryEntryType;
    content: string;
    timestamp: Date;
    createdAt: Date;
}
