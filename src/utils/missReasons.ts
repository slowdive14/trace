/**
 * 예상과 크게 어긋났을 때, 왜 그랬는지를 한 번 눌러 남긴다.
 *
 * 과제마다 오차를 점수로 쌓지는 않는다. 같은 일도 날마다 걸리는 시간이 다른 건
 * 일의 성질이고, 그 차이를 좁히려 하면 예상에 맞춰 일을 끊거나 기록을 반올림하게
 * 된다. 대신 크게 어긋난 날의 '이유'를 모으면 "넘친 날의 절반은 방해 때문"처럼
 * 손쓸 곳이 분명한 패턴이 나온다.
 *
 * 예상은 두 종류다.
 *   - plan: 미리 직접 적어 둔 '(30m)'
 *   - estimate: 직접 적지 않아 앱이 지난 기록으로 낸 '예상 30m'
 */
import { formatDuration } from './todoUtils';
import { normalizeTaskText, taskKey } from './taskEstimate';

export type ExpectKind = 'plan' | 'estimate';
export type MissDirection = 'over' | 'under';

/** 체크할 때 그 항목에 보이던 예상 */
export interface Expectation {
    minutes: number;
    /** 범위가 보였으면 그 아래·위 */
    low?: number;
    high?: number;
    kind: ExpectKind;
}

export const MISS_REASONS: Record<MissDirection, { id: string; label: string }[]> = {
    over: [
        { id: 'interrupted', label: '방해받음' },
        { id: 'scope', label: '범위가 커짐' },
        { id: 'flow', label: '몰입해서 더 함' },
        { id: 'underestimated', label: '처음부터 짧게 잡음' },
    ],
    under: [
        { id: 'easy', label: '생각보다 쉬움' },
        { id: 'partial', label: '일부만 함' },
        { id: 'overestimated', label: '넉넉히 잡았음' },
    ],
};

export interface MissRecord {
    /** 논리적 날짜 'YYYY-MM-DD' */
    date: string;
    /** 할 일 이름 (표식을 걷어 낸 것) */
    text: string;
    expected: number;
    actual: number;
    kind: ExpectKind;
    direction: MissDirection;
    /** MISS_REASONS의 id */
    reason: string;
    /** 기록한 시각 (ms) */
    at: number;
}

/** 예상보다 이만큼(비율) 넘게 어긋나야 묻는다 */
export const MISS_RATIO = 0.5;
/** 그리고 이만큼(분) 넘게 어긋나야 묻는다 — 10분짜리가 16분 걸린 것까지 묻지 않게 */
export const MISS_MIN_MINUTES = 10;
/** 이유 패턴을 보여 주려면 몇 번 쌓여야 하는지 */
export const REASON_MIN_COUNT = 3;
/** 이유를 셀 때 보는 최근 기록 수 */
export const REASON_RECENT = 20;

/**
 * 크게 어긋났는지. 범위가 보였고 실제가 그 안이면 어긋난 게 아니다.
 * @returns 더 걸렸으면 'over', 덜 걸렸으면 'under', 아니면 null
 */
export const missDirection = (expected: Expectation, actual: number): MissDirection | null => {
    if (!(expected.minutes > 0) || !(actual > 0)) return null;
    if (expected.low !== undefined && expected.high !== undefined && actual >= expected.low && actual <= expected.high) {
        return null;
    }
    const diff = actual - expected.minutes;
    if (Math.abs(diff) <= MISS_MIN_MINUTES) return null;
    if (Math.abs(diff) / expected.minutes <= MISS_RATIO) return null;
    return diff > 0 ? 'over' : 'under';
};

/** 한 건의 차이를 문구로: '예상 1h → 실제 1h40m · 40m 더 걸렸어요 (+67%)' */
export const describeGap = (expected: number, actual: number): string => {
    const diff = actual - expected;
    const head = `예상 ${formatDuration(expected)} → 실제 ${formatDuration(actual)}`;
    const ratio = Math.round((Math.abs(diff) / expected) * 100);
    return diff > 0
        ? `${head} · ${formatDuration(diff)} 더 걸렸어요 (+${ratio}%)`
        : `${head} · ${formatDuration(-diff)} 덜 걸렸어요 (−${ratio}%)`;
};

/** 같은 날 같은 일을 다시 체크하면 덮어쓰도록 문서 ID를 이름으로 정한다 */
export const missRecordId = (date: string, text: string): string =>
    `${date}__${encodeURIComponent(taskKey(text)).slice(0, 300)}`;

/** 할 일 한 줄('- [x] 혼공머신 (30m) {eid:..}')에서 이름만 */
export const recordTextFromLine = (line: string): string =>
    normalizeTaskText(line.replace(/^[\t ]*- \[[ xX]\] /, ''));

export const reasonLabel = (id: string): string =>
    [...MISS_REASONS.over, ...MISS_REASONS.under].find(r => r.id === id)?.label ?? id;

export interface ReasonSummary {
    /** 센 기록 수 */
    total: number;
    /** 많은 순 */
    reasons: { id: string; label: string; count: number }[];
}

/**
 * 최근 기록에서 이유별로 센다. REASON_MIN_COUNT번이 안 되면 패턴이라 하기 어려워 null.
 */
export const summarizeReasons = (records: MissRecord[], direction: MissDirection): ReasonSummary | null => {
    const recent = records
        .filter(r => r.direction === direction)
        .sort((a, b) => b.at - a.at)
        .slice(0, REASON_RECENT);
    if (recent.length < REASON_MIN_COUNT) return null;

    // 최근 것부터 세므로, 수가 같으면 최근에 나온 이유가 앞에 온다 (정렬이 안정적이라 그대로 남는다)
    const counts = new Map<string, number>();
    for (const r of recent) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
    return {
        total: recent.length,
        reasons: [...counts.entries()]
            .map(([id, count]) => ({ id, label: reasonLabel(id), count }))
            .sort((a, b) => b.count - a.count),
    };
};
