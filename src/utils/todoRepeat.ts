/**
 * 반복 일정 판정과 대기 목록 조작 (순수 함수 — Firebase 의존 없음).
 *
 * 매일 반복되는 것은 템플릿이 맡는다. 여기서는 요일이나 주기가 정해진 일을 다룬다.
 */
import type { RecurringTodo } from '../types/types';

/** 'yyyy-MM-dd' → Date (정오로 잡아 시간대·서머타임 경계를 피한다) */
const parseDateStr = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
};

/** 그 달에서 이 날짜가 같은 요일 중 몇 번째인지 (1~5) */
export const nthWeekdayOfMonth = (dateStr: string): number => {
    const date = parseDateStr(dateStr);
    return Math.floor((date.getDate() - 1) / 7) + 1;
};

/** 두 날짜 사이의 주 수 (월요일 시작 기준). 같은 주면 0 */
export const weeksBetween = (fromStr: string, toStr: string): number => {
    const startOfWeek = (d: Date) => {
        const copy = new Date(d);
        // 일요일(0)을 주의 마지막으로 보아 월요일이 기준이 되게 당긴다
        const shift = (copy.getDay() + 6) % 7;
        copy.setDate(copy.getDate() - shift);
        copy.setHours(12, 0, 0, 0);
        return copy;
    };
    const a = startOfWeek(parseDateStr(fromStr));
    const b = startOfWeek(parseDateStr(toStr));
    return Math.round((b.getTime() - a.getTime()) / (7 * 24 * 60 * 60 * 1000));
};

/** 이 규칙이 그 날짜에 들어가야 하는가 */
export const isRepeatDueOn = (rule: RecurringTodo, dateStr: string): boolean => {
    if (!rule.active) return false;
    if (parseDateStr(dateStr).getDay() !== rule.weekday) return false;

    switch (rule.kind) {
        case 'weekly':
            return true;
        case 'biweekly': {
            // 기준일이 없으면 격주를 판단할 수 없다. 매주로 떨어뜨리지 않고 건너뛴다.
            if (!rule.anchorDate) return false;
            const gap = weeksBetween(rule.anchorDate, dateStr);
            return gap >= 0 && gap % 2 === 0;
        }
        case 'monthlyNth':
            return nthWeekdayOfMonth(dateStr) === (rule.nth ?? 1);
        default:
            return false;
    }
};

/** 그 날짜에 넣어야 할 규칙들 (이미 넣은 것은 뺀다) */
export const getDueRepeats = (
    rules: RecurringTodo[],
    dateStr: string,
    alreadyApplied: string[] = [],
): RecurringTodo[] =>
    rules.filter(r => isRepeatDueOn(r, dateStr) && !alreadyApplied.includes(r.id));

/** 규칙을 사람이 읽을 문구로 (예: '격주 월요일', '매월 2번째 수요일') */
export const describeRepeat = (rule: RecurringTodo): string => {
    const day = ['일', '월', '화', '수', '목', '금', '토'][rule.weekday] ?? '?';
    switch (rule.kind) {
        case 'weekly':
            return `매주 ${day}요일`;
        case 'biweekly':
            return `격주 ${day}요일`;
        case 'monthlyNth':
            return `매월 ${rule.nth ?? 1}번째 ${day}요일`;
        default:
            return `${day}요일`;
    }
};

// ===== 목록에 줄 넣고 빼기 =====

/** 본문 끝에 항목을 덧붙인다 (빈 본문·끝 개행 모두 처리) */
export const appendTodoLine = (content: string, text: string): string => {
    const line = `- [ ] ${text}`;
    if (!content) return line;
    return content.endsWith('\n') ? content + line : content + '\n' + line;
};

/** 여러 항목을 한 번에 덧붙인다 */
export const appendTodoLines = (content: string, texts: string[]): string =>
    texts.reduce(appendTodoLine, content);

// ===== 대기 목록 =====

/**
 * 대기 목록은 날짜가 없는 투두 문서 하나에 같은 마크다운으로 담는다.
 * 저장 형식을 맞춰 두면 파싱·렌더 코드를 그대로 쓸 수 있다.
 */
export const parseBacklog = (content: string): string[] =>
    content
        .split('\n')
        .map(line => line.replace(/^\s*-\s*\[[ xX]\]\s*/, '').trim())
        .filter(line => line.length > 0);

export const formatBacklog = (items: string[]): string =>
    items.map(text => `- [ ] ${text}`).join('\n');

/** 대기 목록에서 한 줄 빼기 */
export const removeBacklogItem = (items: string[], index: number): string[] =>
    items.filter((_, i) => i !== index);
