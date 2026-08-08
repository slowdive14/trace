import {
    startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    subWeeks, subMonths, addMonths, differenceInCalendarDays, format, isWithinInterval, getDaysInMonth,
} from 'date-fns';
import type { Expense, ExpenseCategory, RecurringExpense } from '../types/types';

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

export const normalizeDescription = (description: string): string =>
    description.toLowerCase().replace(/\s+/g, ' ').trim();

const median = (nums: number[]): number => {
    if (nums.length === 0) return 0;
    const s = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// ===== 반복 지출 자동 입력 =====

/**
 * 이번 달에 실제로 기록될 날짜.
 * 31일처럼 그 달에 없는 날짜는 말일로 당긴다(2월 31일 → 2월 28/29일).
 */
export const getEffectivePostDate = (dayOfMonth: number, now: Date): Date => {
    const lastDay = getDaysInMonth(now);
    return new Date(now.getFullYear(), now.getMonth(), Math.min(Math.max(dayOfMonth, 1), lastDay));
};

/**
 * 지금 자동 입력해야 하는 규칙인지.
 * 이번 달 지정일이 지났고, 이번 달에 아직 넣지 않았을 때만 참.
 */
export const isRuleDue = (rule: RecurringExpense, now: Date): boolean => {
    if (!rule.active) return false;
    if (rule.lastPostedMonth === format(now, 'yyyy-MM')) return false;
    return now >= getEffectivePostDate(rule.dayOfMonth, now);
};

export const getDueRules = (rules: RecurringExpense[], now: Date): RecurringExpense[] =>
    rules.filter(r => isRuleDue(r, now));

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
    categories: CategoryStat[];
    /** 하루 평균 (진행 중인 기간이면 경과일 기준) */
    dailyAverage: number;
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
    now: Date = new Date()
): PeriodSummary => {
    const range = getPeriodRange(period, date);
    const prevRange = getPreviousRange(period, date);
    const current = filterByRange(expenses, range);
    const previous = filterByRange(expenses, prevRange);

    const totalSpent = sumSpent(current);
    const totalRefund = current.filter(e => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
    const prevTotalSpent = sumSpent(previous);

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
        categories,
        dailyAverage,
        prevTotalSpent,
        totalChangePct: changePct(totalSpent, prevTotalSpent),
    };
};

// ===== 기간 말 예상액 =====
//
// 단순히 (쓴 돈 ÷ 경과일 × 총일수)로 계산하면 노트북·월세처럼 큰 지출 하나가
// "매일 그만큼 더 쓴다"로 반영돼 예상액이 크게 부풀려진다.
// 그래서 지출을 성격별로 나눠 각각 다르게 반영한다.
//
//   예상 = 이미 쓴 돈 (큰 지출 포함 — 실제로 나간 돈이므로 한 번은 더한다)
//        + 남은 일수 × 일상 지출 하루치 (큰 지출·반복 지출 제외한 값으로 산출)
//        + 남은 기간에 예정된 반복 지출 (등록된 규칙으로 정확히 계산)

/** 이 일수보다 적게 지났으면 추정이 불안정하므로 예상액을 내지 않는다 */
const MIN_ELAPSED_DAYS = 3;
/** 이상치 판정에 필요한 최소 표본 수 */
const OUTLIER_MIN_SAMPLE = 8;

/**
 * '큰 지출'로 볼 금액 기준.
 * 중앙값과 MAD(중앙값 절대편차)를 쓰는 로버스트 방식이라 이상치 자신에게 휘둘리지 않는다.
 * 표본이 적으면 Infinity를 반환해 아무것도 이상치로 보지 않는다.
 */
export const getLargeExpenseThreshold = (amounts: number[]): number => {
    const positive = amounts.filter(a => a > 0);
    if (positive.length < OUTLIER_MIN_SAMPLE) return Infinity;

    const med = median(positive);
    if (med <= 0) return Infinity;

    const mad = median(positive.map(a => Math.abs(a - med)));
    const robustSigma = 1.4826 * mad;   // MAD를 표준편차 척도로 환산
    // MAD가 0에 가까울 때 임계값이 너무 낮아지지 않도록 하한을 둔다
    return Math.max(med + 3 * robustSigma, med * 3);
};

export interface ProjectionDetail {
    total: number;
    /** 일상 지출 하루치 (큰 지출·반복 지출 제외) */
    routineDaily: number;
    remainingDays: number;
    /** 남은 기간에 예정된 반복 지출 합 */
    upcomingRecurring: number;
    /** 이번 기간에 이미 나간 큰 지출 합 (추정에서 제외됐음을 보여주기 위함) */
    largeSpent: number;
}

export const projectPeriodTotal = (
    expenses: Expense[],
    period: Period,
    date: Date,
    rules: RecurringExpense[] = [],
    now: Date = new Date()
): ProjectionDetail | null => {
    const range = getPeriodRange(period, date);
    if (now < range.start || now > range.end) return null;   // 끝난 기간은 예상하지 않음

    const totalDays = differenceInCalendarDays(range.end, range.start) + 1;
    const elapsedDays = differenceInCalendarDays(now, range.start) + 1;
    if (elapsedDays < MIN_ELAPSED_DAYS) return null;
    const remainingDays = totalDays - elapsedDays;

    // 이상치 기준은 최근 3개월 기록으로 잡는다 (이번 기간만 보면 표본이 너무 적다)
    const lookback = filterByRange(expenses, { start: startOfMonth(subMonths(now, 2)), end: range.end });
    const threshold = getLargeExpenseThreshold(lookback.map(e => e.amount));

    const current = filterByRange(expenses, range).filter(e => e.amount > 0);
    const spentSoFar = current.reduce((s, e) => s + e.amount, 0);
    const ruleKeys = new Set(rules.map(r => normalizeDescription(r.description)));

    let routine = 0;
    let largeSpent = 0;
    for (const e of current) {
        if (e.amount >= threshold) { largeSpent += e.amount; continue; }        // 큰 지출: 반복 안 함
        if (ruleKeys.has(normalizeDescription(e.description))) continue;        // 반복 지출: 아래서 따로
        routine += e.amount;
    }
    const routineDaily = elapsedDays > 0 ? routine / elapsedDays : 0;

    // 남은 기간에 아직 나가지 않은 반복 지출 (주가 달을 걸치는 경우까지 고려)
    let upcomingRecurring = 0;
    for (const rule of rules) {
        if (!rule.active) continue;
        const candidates = [now, range.end];
        const seen = new Set<string>();
        for (const anchor of candidates) {
            const monthKey = format(anchor, 'yyyy-MM');
            if (seen.has(monthKey)) continue;
            seen.add(monthKey);
            if (rule.lastPostedMonth === monthKey) continue;   // 이미 입력됨
            const postDate = getEffectivePostDate(rule.dayOfMonth, anchor);
            if (postDate > now && postDate <= range.end) upcomingRecurring += rule.amount;
        }
    }

    return {
        total: Math.round(spentSoFar + remainingDays * routineDaily + upcomingRecurring),
        routineDaily: Math.round(routineDaily),
        remainingDays,
        upcomingRecurring,
        largeSpent,
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
