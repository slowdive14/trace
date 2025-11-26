export interface Entry {
    id: string;
    content: string;
    tags: string[];
    category: 'action' | 'thought';
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
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
    '문화/취미': '🎨',
    '종교/기부': '🙏',
    '생필품': '🛒',
    '공간 사용료': '🏢',
    '기타': '🏷️'
};
