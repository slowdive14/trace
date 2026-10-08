/**
 * 오늘 쓸 수 있는 시간과, 오늘 할 일에 드는 시간.
 *
 * 가용 시간은 수면 기록(최근 7일 평균 기상·취침)으로만 정한다. Toggl은 모든 시간을
 * 담고 있지 않으므로 '하루에 기록된 시간'을 가용 시간처럼 쓰지 않는다.
 *
 * 시각은 '논리적 하루의 0시'부터 센 분으로 다룬다. 하루가 새벽 5시에 바뀌므로
 * 새벽 1시 41분 취침은 1541분(=25:41)이다.
 */
import { buildTaskTree, type TodoItem } from './todoUtils';
import type { SleepRecord } from './sleepUtils';

/** 평균을 낼 기간 (일) */
export const TYPICAL_DAY_WINDOW = 7;

/** 새벽 이 시각 전의 취침은 전날 밤으로 본다 (sleepUtils와 같은 기준) */
const NIGHT_CUTOFF_HOUR = 6;

export interface TypicalDay {
    /** 평균 기상 (논리적 0시부터 분) */
    wakeMin: number;
    /** 평균 취침 (논리적 0시부터 분, 자정을 넘기면 1440 이상) */
    bedMin: number;
    /** 평균에 쓴 기상·취침 기록 수 */
    wakeCount: number;
    bedCount: number;
}

const shiftDate = (dateStr: string, delta: number): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d + delta);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * 최근 7일(오늘 포함)의 평균 기상·취침.
 * 기상과 취침은 따로 평균 낸다. 한쪽만 기록한 날도 버리지 않기 위해서다.
 * 둘 중 하나라도 기록이 없으면 null (반쪽짜리 하루로 계산하지 않는다).
 */
export const getTypicalDay = (records: SleepRecord[], todayStr: string): TypicalDay | null => {
    const from = shiftDate(todayStr, -(TYPICAL_DAY_WINDOW - 1));
    const inRange = records.filter(r => r.date >= from && r.date <= todayStr);

    const wakes = inRange
        .filter(r => r.wakeTime)
        .map(r => r.wakeTime!.getHours() * 60 + r.wakeTime!.getMinutes());
    const beds = inRange
        .filter(r => r.sleepTime)
        .map(r => {
            const h = r.sleepTime!.getHours();
            const min = h * 60 + r.sleepTime!.getMinutes();
            return h < NIGHT_CUTOFF_HOUR ? min + 1440 : min;
        });

    if (wakes.length === 0 || beds.length === 0) return null;
    return {
        wakeMin: Math.round(avg(wakes)),
        bedMin: Math.round(avg(beds)),
        wakeCount: wakes.length,
        bedCount: beds.length,
    };
};

/**
 * 취침 시각 'HH:mm' → 논리적 0시부터의 분.
 * 새벽(6시 전)이면 자정을 넘긴 것으로 본다 ('01:30' → 1530). 형식이 틀리면 null.
 */
export const bedClockToMinutes = (hhmm: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h < NIGHT_CUTOFF_HOUR ? h * 60 + min + 1440 : h * 60 + min;
};

/** 논리적 하루의 0시부터 지금까지 몇 분 지났는지 */
export const minutesSinceLogicalMidnight = (now: Date, logicalDayStr: string): number => {
    const [y, m, d] = logicalDayStr.split('-').map(Number);
    const midnight = new Date(y, m - 1, d, 0, 0, 0, 0);
    return Math.floor((now.getTime() - midnight.getTime()) / 60000);
};

/** 분 → '8시간 50분' / '45분' (큰 숫자로 보여 줄 때) */
export const formatHM = (minutes: number): string => {
    const m = Math.max(0, Math.round(minutes));
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h === 0) return `${r}분`;
    return r === 0 ? `${h}시간` : `${h}시간 ${r}분`;
};

/** 분 → 'HH:mm' (자정을 넘긴 값도 시계 시각으로) */
export const clockLabel = (minutes: number): string => {
    const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

// ===== 오늘 할 일에 드는 시간 =====

export interface TodayLoad {
    /** 아직 안 한 몫 (분) */
    remaining: number;
    /** 시간을 알 수 없는 미완료 항목 수 */
    unknown: number;
    /** 예상 시간을 쓴 미완료 항목 수 */
    estimated: number;
    /** 시간을 아는 미완료 항목 수 (직접 적음 + 예상) */
    known: number;
}

/** 하위 항목을 똑같이 나눴을 때의 완료 비율 (달성률 계산과 같은 방식) */
const doneFraction = (node: TaskNode): number => {
    if (node.children.length === 0) return node.item.checked ? 1 : 0;
    return node.children.reduce((sum, c) => sum + doneFraction(c), 0) / node.children.length;
};

type TaskNode = ReturnType<typeof buildTaskTree>[number];

/** 하위 어딘가에 직접 적은 소요시간이 있는지 */
const hasExplicitBelow = (node: TaskNode): boolean =>
    node.children.some(c => c.item.duration !== undefined || hasExplicitBelow(c));

/**
 * 오늘 목록에서 아직 안 한 몫이 몇 분인지.
 *
 * 항목의 시간은 직접 적은 '(30m)'를 먼저 쓰고, 없으면 예상 시간을 쓴다.
 * 하위 항목이 있는 항목은 자기 시간이 있으면 '그 시간 × 아직 안 한 비율'로 보고,
 * 없으면 하위 항목들의 남은 몫을 더한다. 같은 시간을 부모·자식에서 두 번 세지 않는다.
 * 부모에 직접 적은 시간이 없고 하위에 직접 적은 시간이 있으면, 부모 이름으로 짐작하지
 * 않고 하위에 적힌 시간을 따른다 (직접 적은 것이 짐작보다 정확하다).
 *
 * 추가 항목(+)도 넣는다. 달성률 분모에서는 빠지지만 시간은 똑같이 든다.
 */
export const computeTodayLoad = (
    items: TodoItem[],
    estimateOf: (item: TodoItem) => number | undefined,
): TodayLoad => {
    const load: TodayLoad = { remaining: 0, unknown: 0, estimated: 0, known: 0 };

    const visit = (node: TaskNode): void => {
        const { item, children } = node;
        if (item.checked) return;

        const own = item.duration ?? (hasExplicitBelow(node) ? undefined : estimateOf(item));
        if (own !== undefined) {
            load.known++;
            if (item.duration === undefined) load.estimated++;
            load.remaining += children.length > 0 ? own * (1 - doneFraction(node)) : own;
            return;
        }
        if (children.length > 0) {
            children.forEach(visit);
            return;
        }
        load.unknown++;
    };

    buildTaskTree(items).forEach(visit);
    load.remaining = Math.round(load.remaining);
    return load;
};
