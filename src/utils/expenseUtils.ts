import {
    startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    subWeeks, subMonths, addMonths, differenceInCalendarDays, format, isWithinInterval,
} from 'date-fns';
import type { Expense, ExpenseCategory } from '../types/types';

export type Period = 'week' | 'month';

export interface DateRange {
    start: Date;
    end: Date;
}

export const getPeriodRange = (period: Period, date: Date): DateRange =>
    period === 'week'
        ? { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) }
        : { start: startOfMonth(date), end: endOfMonth(date) };

export const getPreviousRange = (period: Period, date: Date): DateRange =>
    getPeriodRange(period, period === 'week' ? subWeeks(date, 1) : subMonths(date, 1));

const inRange = (e: Expense, r: DateRange) => isWithinInterval(e.timestamp, { start: r.start, end: r.end });

export const filterByRange = (expenses: Expense[], range: DateRange): Expense[] =>
    expenses.filter(e => inRange(e, range));

// ===== 고정비(반복 지출) 감지 =====
// "어디에 쓰는지"에서 가장 큰 축은 조절 불가능한 고정비와 조절 가능한 변동비의 구분이다.
// 매달 비슷한 금액으로 한두 번씩 꾸준히 나가는 항목을 고정비로 본다.
// (커피처럼 한 달에 여러 번, 금액이 들쭉날쭉한 것은 제외된다)

/** 고정비로 인정할 최소 발생 개월 수 */
const RECURRING_MIN_MONTHS = 3;
/** 월 평균 발생 횟수 상한 — 이보다 잦으면 생활성 지출로 본다 */
const RECURRING_MAX_PER_MONTH = 1.5;
/** 금액 안정성 허용 편차 (중앙값 대비) */
const RECURRING_AMOUNT_TOLERANCE = 0.2;

export const normalizeDescription = (description: string): string =>
    description.toLowerCase().replace(/\s+/g, ' ').trim();

const median = (nums: number[]): number => {
    const s = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** 반복 지출로 판정된 내역명(정규화) 집합 */
export const detectRecurringKeys = (expenses: Expense[]): Set<string> => {
    const groups = new Map<string, Expense[]>();
    for (const e of expenses) {
        if (e.amount <= 0) continue;  // 환불·수입은 제외
        const key = normalizeDescription(e.description);
        if (!key) continue;
        const list = groups.get(key);
        if (list) list.push(e);
        else groups.set(key, [e]);
    }

    const recurring = new Set<string>();
    for (const [key, list] of groups) {
        const months = new Set(list.map(e => format(e.timestamp, 'yyyy-MM')));
        if (months.size < RECURRING_MIN_MONTHS) continue;
        if (list.length / months.size > RECURRING_MAX_PER_MONTH) continue;

        const med = median(list.map(e => e.amount));
        if (med <= 0) continue;
        const stable = list.every(e => Math.abs(e.amount - med) / med <= RECURRING_AMOUNT_TOLERANCE);
        if (stable) recurring.add(key);
    }
    return recurring;
};

export const isRecurring = (e: Expense, recurringKeys: Set<string>): boolean =>
    recurringKeys.has(normalizeDescription(e.description));

// ===== 기간 요약 =====

export interface CategoryStat {
    category: ExpenseCategory;
    amount: number;
    percentage: number;
    /** 지난 기간 같은 카테고리 금액 */
    prevAmount: number;
    /** 지난 기간 대비 증감률(%) — 지난 기간이 0이면 null */
    changePct: number | null;
}

export interface PeriodSummary {
    totalSpent: number;
    /** 환불·수입 (음수 금액의 절댓값) */
    totalRefund: number;
    count: number;
    fixed: number;
    variable: number;
    categories: CategoryStat[];
    /** 하루 평균 (진행 중인 기간이면 경과일 기준) */
    dailyAverage: number;
    /** 현재 진행 중인 기간일 때만, 이 페이스 기준 기간 말 예상액 */
    projected: number | null;
    prevTotalSpent: number;
    /** 총액의 지난 기간 대비 증감률(%) */
    totalChangePct: number | null;
}

const sumSpent = (list: Expense[]) => list.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);

const changePct = (curr: number, prev: number): number | null =>
    prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;

export const summarizePeriod = (
    expenses: Expense[],
    period: Period,
    date: Date,
    recurringKeys: Set<string>,
    now: Date = new Date()
): PeriodSummary => {
    const range = getPeriodRange(period, date);
    const prevRange = getPreviousRange(period, date);
    const current = filterByRange(expenses, range);
    const previous = filterByRange(expenses, prevRange);

    const totalSpent = sumSpent(current);
    const totalRefund = current.filter(e => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
    const prevTotalSpent = sumSpent(previous);

    const fixed = sumSpent(current.filter(e => isRecurring(e, recurringKeys)));

    // 카테고리별 (지난 기간과 함께)
    const byCategory = new Map<ExpenseCategory, number>();
    const prevByCategory = new Map<ExpenseCategory, number>();
    for (const e of current) if (e.amount > 0) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    for (const e of previous) if (e.amount > 0) prevByCategory.set(e.category, (prevByCategory.get(e.category) ?? 0) + e.amount);

    const categories: CategoryStat[] = [...byCategory.entries()]
        .map(([category, amount]) => {
            const prevAmount = prevByCategory.get(category) ?? 0;
            return {
                category,
                amount,
                percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
                prevAmount,
                changePct: changePct(amount, prevAmount),
            };
        })
        .sort((a, b) => b.amount - a.amount);

    // 진행 중인 기간이면 경과일 기준, 끝난 기간이면 전체 일수 기준
    const isOngoing = now >= range.start && now <= range.end;
    const totalDays = differenceInCalendarDays(range.end, range.start) + 1;
    const elapsedDays = isOngoing ? differenceInCalendarDays(now, range.start) + 1 : totalDays;
    const dailyAverage = elapsedDays > 0 ? Math.round(totalSpent / elapsedDays) : 0;

    return {
        totalSpent,
        totalRefund,
        count: current.length,
        fixed,
        variable: totalSpent - fixed,
        categories,
        dailyAverage,
        projected: isOngoing && elapsedDays > 0 ? Math.round((totalSpent / elapsedDays) * totalDays) : null,
        prevTotalSpent,
        totalChangePct: changePct(totalSpent, prevTotalSpent),
    };
};

// ===== 최근 N개월 추이 =====

export interface MonthTotal {
    key: string;       // yyyy-MM
    label: string;     // "8월"
    date: Date;        // 해당 월의 1일
    total: number;
}

export const getRecentMonthTotals = (expenses: Expense[], anchor: Date, months = 6): MonthTotal[] => {
    const out: MonthTotal[] = [];
    for (let i = months - 1; i >= 0; i--) {
        const d = subMonths(anchor, i);
        const range = { start: startOfMonth(d), end: endOfMonth(d) };
        out.push({
            key: format(d, 'yyyy-MM'),
            label: format(d, 'M월'),
            date: startOfMonth(d),
            total: sumSpent(filterByRange(expenses, range)),
        });
    }
    return out;
};

/** 기간 내 가장 큰 지출 건 */
export const getTopExpenses = (expenses: Expense[], range: DateRange, limit = 3): Expense[] =>
    filterByRange(expenses, range)
        .filter(e => e.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit);

export const canGoNext = (period: Period, date: Date, now: Date = new Date()): boolean => {
    const next = period === 'week' ? getPeriodRange('week', subWeeks(date, -1)) : getPeriodRange('month', addMonths(date, 1));
    return next.start <= now;
};
