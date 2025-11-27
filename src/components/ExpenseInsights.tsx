import React, { useState, useMemo } from 'react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, addWeeks, subWeeks, addMonths, subMonths, format, getWeekOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Expense } from '../types/types';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_EMOJI } from '../types/types';

interface ExpenseInsightsProps {
    expenses: Expense[];
}

type Period = 'week' | 'month' | 'all';

const ExpenseInsights: React.FC<ExpenseInsightsProps> = ({ expenses }) => {
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('week');
    const [currentDate, setCurrentDate] = useState(new Date());

    const handlePrev = () => {
        if (selectedPeriod === 'week') {
            setCurrentDate(prev => subWeeks(prev, 1));
        } else if (selectedPeriod === 'month') {
            setCurrentDate(prev => subMonths(prev, 1));
        }
    };

    const handleNext = () => {
        if (selectedPeriod === 'week') {
            setCurrentDate(prev => addWeeks(prev, 1));
        } else if (selectedPeriod === 'month') {
            setCurrentDate(prev => addMonths(prev, 1));
        }
    };

    const periodLabel = useMemo(() => {
        if (selectedPeriod === 'all') return '전체 기간';

        if (selectedPeriod === 'week') {
            const weekNum = getWeekOfMonth(currentDate, { weekStartsOn: 1 });
            const month = format(currentDate, 'M월');
            return `${month} ${weekNum}주차`;
        }

        return format(currentDate, 'yyyy년 M월');
    }, [selectedPeriod, currentDate]);

    const stats = useMemo(() => {
        // Determine period filters
        let filteredExpenses: Expense[];

        if (selectedPeriod === 'week') {
            const startOfThisWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
            const endOfThisWeek = endOfWeek(currentDate, { weekStartsOn: 1 });
            filteredExpenses = expenses.filter(e =>
                isWithinInterval(e.timestamp, { start: startOfThisWeek, end: endOfThisWeek })
            );
        } else if (selectedPeriod === 'month') {
            const startOfThisMonth = startOfMonth(currentDate);
            const endOfThisMonth = endOfMonth(currentDate);
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
    }, [expenses, selectedPeriod, currentDate]);

    const periods: { key: Period; label: string }[] = [
        { key: 'week', label: '주간' },
        { key: 'month', label: '월간' },
        { key: 'all', label: '전체' }
    ];

    return (
        <div className="bg-bg-secondary rounded-xl p-4 mb-6 animate-fade-in">
            {/* Controls Header */}
            <div className="flex flex-col gap-4 mb-6">
                {/* Period Type Selector */}
                <div className="flex bg-bg-tertiary/50 p-1 rounded-lg">
                    {periods.map(period => (
                        <button
                            key={period.key}
                            onClick={() => {
                                setSelectedPeriod(period.key);
                                setCurrentDate(new Date()); // Reset date when switching modes
                            }}
                            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${selectedPeriod === period.key
                                ? 'bg-bg-primary text-text-primary shadow-sm'
                                : 'text-text-secondary hover:text-text-primary'
                                }`}
                        >
                            {period.label}
                        </button>
                    ))}
                </div>

                {/* Date Navigation */}
                {selectedPeriod !== 'all' && (
                    <div className="flex items-center justify-between px-2">
                        <button
                            onClick={handlePrev}
                            className="p-2 hover:bg-bg-tertiary rounded-full text-text-secondary hover:text-text-primary transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-base font-bold text-text-primary">
                            {periodLabel}
                        </span>
                        <button
                            onClick={handleNext}
                            className="p-2 hover:bg-bg-tertiary rounded-full text-text-secondary hover:text-text-primary transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                )}
            </div>

            {stats.count === 0 ? (
                <div className="text-center py-8 text-text-secondary text-sm">
                    이 기간의 지출 내역이 없습니다.
                </div>
            ) : (
                <>
                    {/* Summary */}
                    <div className="flex justify-between items-end mb-6 px-2">
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
                            <div className="text-xs text-text-secondary font-medium px-2">카테고리별 분석</div>
                            {stats.categoryBreakdown.map(({ category, amount, percentage }) => (
                                <div key={category} className="space-y-1.5 px-2">
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
                </>
            )}
        </div>
    );
};

export default ExpenseInsights;
