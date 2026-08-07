import React, { useState, useMemo } from 'react';
import { addWeeks, subWeeks, addMonths, subMonths, format, getWeekOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Expense, ExpenseCategory } from '../types/types';
import { EXPENSE_CATEGORY_EMOJI } from '../types/types';
import {
    type Period,
    getPeriodRange,
    summarizePeriod,
    getRecentMonthTotals,
    getTopExpenses,
    canGoNext,
} from '../utils/expenseUtils';

interface ExpenseInsightsProps {
    expenses: Expense[];
    selectedCategory: ExpenseCategory | null;
    onSelectCategory: (category: ExpenseCategory | null) => void;
}

const won = (n: number) => n.toLocaleString();

/** 지난 기간 대비 증감 표시 — 지출은 늘면 빨강, 줄면 초록 */
const Delta: React.FC<{ pct: number | null; className?: string }> = ({ pct, className = '' }) => {
    if (pct === null || pct === 0) return null;
    const up = pct > 0;
    return (
        <span className={`tabular-nums ${up ? 'text-rose-400' : 'text-emerald-400'} ${className}`}>
            {up ? '▲' : '▼'}{Math.abs(pct)}%
        </span>
    );
};

const ExpenseInsights: React.FC<ExpenseInsightsProps> = ({
    expenses, selectedCategory, onSelectCategory,
}) => {
    const [period, setPeriod] = useState<Period>('month');
    const [currentDate, setCurrentDate] = useState(new Date());

    const summary = useMemo(
        () => summarizePeriod(expenses, period, currentDate),
        [expenses, period, currentDate]
    );
    const range = useMemo(() => getPeriodRange(period, currentDate), [period, currentDate]);
    const monthTotals = useMemo(() => getRecentMonthTotals(expenses, new Date(), 6), [expenses]);
    const topExpenses = useMemo(() => getTopExpenses(expenses, range, 3), [expenses, range]);
    const maxMonth = useMemo(() => Math.max(...monthTotals.map(m => m.total), 1), [monthTotals]);

    const shift = (dir: -1 | 1) => {
        setCurrentDate(prev => period === 'week'
            ? (dir === 1 ? addWeeks(prev, 1) : subWeeks(prev, 1))
            : (dir === 1 ? addMonths(prev, 1) : subMonths(prev, 1)));
    };

    const periodLabel = period === 'week'
        ? `${format(currentDate, 'M월', { locale: ko })} ${getWeekOfMonth(currentDate, { weekStartsOn: 1, locale: ko })}주차`
        : format(currentDate, 'yyyy년 M월', { locale: ko });

    const nextAvailable = canGoNext(period, currentDate);

    return (
        <div className="bg-bg-secondary rounded-xl p-4 mb-6">
            {/* 기간 전환 + 이동 */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex bg-bg-tertiary/50 p-0.5 rounded-lg">
                    {(['week', 'month'] as Period[]).map(p => (
                        <button
                            key={p}
                            onClick={() => { setPeriod(p); setCurrentDate(new Date()); }}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                period === p ? 'bg-bg-primary text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
                            }`}
                        >
                            {p === 'week' ? '주간' : '월간'}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => shift(-1)} className="p-1 text-text-tertiary hover:text-text-primary transition-colors">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs text-text-secondary tabular-nums min-w-[86px] text-center">{periodLabel}</span>
                    <button
                        onClick={() => shift(1)}
                        disabled={!nextAvailable}
                        className="p-1 text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-25 disabled:hover:text-text-tertiary"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {summary.count === 0 ? (
                <div className="text-center py-6 text-text-tertiary text-sm">이 기간의 지출 내역이 없습니다.</div>
            ) : (
                <>
                    {/* 총액 · 일평균 · 비교 */}
                    <div className="mb-4">
                        <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-semibold text-text-primary tabular-nums">
                                {won(summary.totalSpent)}<span className="text-base font-normal text-text-tertiary">원</span>
                            </span>
                            <span className="text-xs text-text-tertiary tabular-nums">
                                일 평균 {won(summary.dailyAverage)}원
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1 text-[11px] text-text-tertiary tabular-nums">
                            <span>
                                {period === 'week' ? '지난주' : '지난달'} {won(summary.prevTotalSpent)}
                            </span>
                            <Delta pct={summary.totalChangePct} />
                            {summary.projected !== null && (
                                <span className="ml-auto">이 페이스면 ≈ {won(summary.projected)}원</span>
                            )}
                        </div>
                    </div>

                    {/* 카테고리 — 탭하면 아래 내역이 필터링된다 */}
                    <div className="space-y-2.5">
                        {summary.categories.map(({ category, amount, percentage, changePct }) => {
                            const active = selectedCategory === category;
                            return (
                                <button
                                    key={category}
                                    onClick={() => onSelectCategory(active ? null : category)}
                                    className={`w-full text-left transition-opacity ${
                                        selectedCategory && !active ? 'opacity-35' : 'opacity-100'
                                    }`}
                                    aria-pressed={active}
                                >
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="flex items-center gap-1.5 min-w-0">
                                            <span>{EXPENSE_CATEGORY_EMOJI[category]}</span>
                                            <span className={active ? 'text-text-primary font-medium' : 'text-text-secondary'}>
                                                {category}
                                            </span>
                                            {active && <X size={11} className="text-text-tertiary shrink-0" />}
                                        </span>
                                        <span className="flex items-baseline gap-1.5 tabular-nums shrink-0">
                                            <Delta pct={changePct} className="text-[10px]" />
                                            <span className="text-text-tertiary text-[10px]">{percentage.toFixed(0)}%</span>
                                            <span className="text-text-secondary">{won(amount)}</span>
                                        </span>
                                    </div>
                                    <div className="h-1 bg-bg-tertiary rounded-full">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${active ? 'bg-accent' : 'bg-accent/50'}`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* 가장 큰 지출 */}
                    {topExpenses.length > 0 && (
                        <div className="mt-4 pt-3 text-[11px] text-text-tertiary tabular-nums">
                            가장 큰 지출{' '}
                            {topExpenses.map((e, i) => (
                                <span key={e.id}>
                                    {i > 0 && ' · '}
                                    {e.description} {won(e.amount)}
                                </span>
                            ))}
                        </div>
                    )}

                    {summary.totalRefund > 0 && (
                        <div className="mt-1 text-[11px] text-text-tertiary tabular-nums">
                            환불·수입 +{won(summary.totalRefund)}원
                        </div>
                    )}
                </>
            )}

            {/* 최근 6개월 추이 — 막대를 눌러 해당 월로 이동 */}
            <div className="mt-4 pt-3 border-t border-bg-tertiary">
                <div className="flex items-end justify-between gap-1 h-12">
                    {monthTotals.map(m => {
                        const isCurrent = period === 'month' && format(currentDate, 'yyyy-MM') === m.key;
                        return (
                            <button
                                key={m.key}
                                onClick={() => { setPeriod('month'); setCurrentDate(m.date); }}
                                className="flex-1 flex flex-col items-center gap-1 group"
                                title={`${m.label} ${won(m.total)}원`}
                            >
                                <div className="w-full h-9 flex items-end">
                                    <div
                                        className={`w-full rounded-sm transition-all ${isCurrent ? 'bg-accent' : 'bg-bg-tertiary group-hover:bg-accent/40'}`}
                                        style={{ height: `${Math.max((m.total / maxMonth) * 100, 3)}%` }}
                                    />
                                </div>
                                <span className={`text-[9px] tabular-nums ${isCurrent ? 'text-accent' : 'text-text-tertiary'}`}>
                                    {m.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ExpenseInsights;
