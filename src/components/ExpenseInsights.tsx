import React, { useState, useMemo } from 'react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import type { Expense } from '../types/types';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_EMOJI } from '../types/types';

interface ExpenseInsightsProps {
    expenses: Expense[];
}

type Period = 'week' | 'month' | 'all';

const ExpenseInsights: React.FC<ExpenseInsightsProps> = ({ expenses }) => {
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('week');

    const stats = useMemo(() => {
        const now = new Date();

        // Determine period filters
        let filteredExpenses: Expense[];

        if (selectedPeriod === 'week') {
            const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 });
            const endOfThisWeek = endOfWeek(now, { weekStartsOn: 1 });
            filteredExpenses = expenses.filter(e =>
                isWithinInterval(e.timestamp, { start: startOfThisWeek, end: endOfThisWeek })
            );
        } else if (selectedPeriod === 'month') {
            const startOfThisMonth = startOfMonth(now);
            const endOfThisMonth = endOfMonth(now);
            filteredExpenses = expenses.filter(e =>
                isWithinInterval(e.timestamp, { start: startOfThisMonth, end: endOfThisMonth })
            );
        } else {
            filteredExpenses = expenses;
        }

        // Calculate totals
        const totalSpent = filteredExpenses
            .filter(e => e.amount > 0)
            .reduce((sum, e) => sum + e.amount, 0);

        const totalSaved = filteredExpenses
            .filter(e => e.amount < 0)
            .reduce((sum, e) => sum + Math.abs(e.amount), 0);

        // Calculate all category breakdowns
        const categoryBreakdown = EXPENSE_CATEGORIES.map(category => {
            const total = filteredExpenses
                .filter(e => e.category === category && e.amount > 0)
                .reduce((sum, e) => sum + e.amount, 0);

            return {
                category,
                amount: total,
                percentage: totalSpent > 0 ? (total / totalSpent) * 100 : 0
            };
        })
            .filter(c => c.amount > 0)
            .sort((a, b) => b.amount - a.amount);

        return {
            totalSpent,
            totalSaved,
            categoryBreakdown,
            count: filteredExpenses.length
        };
    }, [expenses, selectedPeriod]);

    if (stats.count === 0) return null;

    const periods: { key: Period; label: string }[] = [
        { key: 'week', label: '이번 주' },
        { key: 'month', label: '이번 달' },
        { key: 'all', label: '전체' }
    ];

    return (
        <div className="bg-bg-secondary rounded-xl p-4 mb-6 animate-fade-in">
            {/* Period Tabs */}
            <div className="flex gap-2 mb-4">
                {periods.map(period => (
                    <button
                        key={period.key}
                        onClick={() => setSelectedPeriod(period.key)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${selectedPeriod === period.key
                            ? 'bg-accent text-white'
                            : 'bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/80'
                            }`}
                    >
                        {period.label}
                    </button>
                ))}
            </div>

            {/* Summary */}
            <div className="flex justify-between items-end mb-4">
                <div>
                    <h3 className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">
                        총 지출
                    </h3>
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

            {/* Category Breakdown */}
            {stats.categoryBreakdown.length > 0 && (
                <div className="space-y-3">
                    <div className="text-xs text-text-secondary font-medium">카테고리별 분석</div>
                    {stats.categoryBreakdown.map(({ category, amount, percentage }) => (
                        <div key={category} className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-1.5">
                                    <span>{EXPENSE_CATEGORY_EMOJI[category]}</span>
                                    <span className="text-text-primary font-medium">{category}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-text-secondary text-xs">
                                        {percentage.toFixed(0)}%
                                    </span>
                                    <span className="text-text-primary font-mono">
                                        {amount.toLocaleString()}원
                                    </span>
                                </div>
                            </div>
                            {/* Progress Bar */}
                            <div className="w-full bg-bg-tertiary rounded-full h-2">
                                <div
                                    className="bg-accent h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ExpenseInsights;
