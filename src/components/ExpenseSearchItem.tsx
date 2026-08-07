import React from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { SearchResult } from '../types/types';
import { EXPENSE_CATEGORY_EMOJI } from '../types/types';

interface ExpenseSearchItemProps {
    expense: SearchResult & { type: 'expense' };
    highlightQuery?: string;
}

/** 검색어와 일치하는 부분을 강조 (대소문자 무시) */
const highlight = (text: string, query?: string): React.ReactNode => {
    if (!query?.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-accent/30 text-text-primary rounded px-0.5">
                {text.slice(idx, idx + query.length)}
            </mark>
            {text.slice(idx + query.length)}
        </>
    );
};

const ExpenseSearchItem: React.FC<ExpenseSearchItemProps> = ({ expense, highlightQuery }) => {
    const amount = expense.amount ?? 0;
    const isRefund = amount < 0;
    const emoji = expense.expenseCategory ? EXPENSE_CATEGORY_EMOJI[expense.expenseCategory] : '💰';

    return (
        <div className="flex items-center justify-between bg-bg-secondary p-3 rounded-lg">
            <div className="flex items-center gap-3 overflow-hidden">
                <span className="text-xl shrink-0" role="img" aria-label={expense.expenseCategory}>
                    {emoji}
                </span>
                <div className="min-w-0">
                    <div className="text-text-primary truncate">
                        {highlight(expense.content, highlightQuery)}
                    </div>
                    <div className="text-xs text-text-tertiary">
                        {expense.expenseCategory} · {format(expense.timestamp, 'M월 d일 (eee)', { locale: ko })}
                    </div>
                </div>
            </div>
            <span className={`font-mono font-medium shrink-0 ml-3 ${isRefund ? 'text-green-500' : 'text-text-primary'}`}>
                {isRefund ? '+' : '-'}{Math.abs(amount).toLocaleString()}
            </span>
        </div>
    );
};

export default ExpenseSearchItem;
