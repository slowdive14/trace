import React, { useMemo } from 'react';
import { startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import type { Expense, ExpenseCategory } from '../types/types';
import { EXPENSE_CATEGORY_EMOJI } from '../types/types';

interface ExpenseInsightsProps {
    expenses: Expense[];
}

const ExpenseInsights: React.FC<ExpenseInsightsProps> = ({ expenses }) => {
    const stats = useMemo(() => {
        const now = new Date();
        const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 }); // Monday start
        const endOfThisWeek = endOfWeek(now, { weekStartsOn: 1 });

        // Filter this week's expenses
        const thisWeekExpenses = expenses.filter(e =>
            isWithinInterval(e.timestamp, { start: startOfThisWeek, end: endOfThisWeek })
        );

        // Calculate totals
        const totalSpent = thisWeekExpenses
            .filter(e => e.amount > 0)
            .reduce((sum, e) => sum + e.amount, 0);

        const totalSaved = thisWeekExpenses
            .filter(e => e.amount < 0)
            .reduce((sum, e) => sum + Math.abs(e.amount), 0);

        // Calculate top categories
        const categoryTotals = thisWeekExpenses
            .filter(e => e.amount > 0)
            .reduce((acc, e) => {
                acc[e.category] = (acc[e.category] || 0) + e.amount;
                return acc;
            }, {} as Record<ExpenseCategory, number>);

        const topCategories = Object.entries(categoryTotals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3) as [ExpenseCategory, number][];

        return {
            totalSpent,
            totalSaved,
            topCategories,
            count: thisWeekExpenses.length
        };
    }, [expenses]);

    if (stats.count === 0) return null;

    return (
        <div className="bg-bg-secondary rounded-xl p-4 mb-6 animate-fade-in">
            <div className="flex justify-between items-end mb-4">
                <div>
                    <h3 className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">이번 주 지출</h3>
                    <div className="text-2xl font-bold text-text-primary">
                        {stats.totalSpent.toLocaleString()}원
                    </div>
                </div>
                {stats.totalSaved > 0 && (
                    <div className="text-right">
                        <div className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">절약</div>
                        <div className="text-lg font-bold text-green-500">
                            +{stats.totalSaved.toLocaleString()}원
                        </div>
                    </div>
                )}
            </div>

            {stats.topCategories.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs text-text-secondary font-medium">많이 쓴 항목</div>
                    <div className="flex flex-wrap gap-2">
                        {stats.topCategories.map(([category, amount]) => (
                            <div key={category} className="flex items-center gap-1.5 bg-bg-tertiary px-2.5 py-1.5 rounded-lg text-sm">
                                <span>{EXPENSE_CATEGORY_EMOJI[category]}</span>
                                <span className="text-text-primary">{category}</span>
                                <span className="text-text-secondary text-xs border-l border-text-secondary/20 pl-1.5 ml-0.5">
                                    {amount.toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpenseInsights;
