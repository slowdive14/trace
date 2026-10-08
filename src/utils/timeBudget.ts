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

/** 한 최상위 항목(과 그 하위)의 남은 몫 */
export interface RootLoad {
    /** 중간값 기준 (분) */
    remaining: number;
    /** 범위 위쪽 기준 (분) — '늦으면' */
    high: number;
}

export interface TodayLoad {
    /** 아직 안 한 몫 (분) */
    remaining: number;
    /** 범위 위쪽으로 잡았을 때의 남은 몫 (분). 범위가 없는 항목은 중간값 그대로 */
    remainingHigh: number;
    /** 시간을 알 수 없는 미완료 항목 수 */
    unknown: number;
    /** 예상 시간을 쓴 미완료 항목 수 */
    estimated: number;
    /** 시간을 아는 미완료 항목 수 (직접 적음 + 예상) */
    known: number;
    /** 최상위 항목 줄 번호 → 남은 몫 (시간을 아는 몫이 있는 것만) */
    perRoot: Map<number, RootLoad>;
}

/** 예상 시간 중 여기서 쓰는 것 (taskEstimate의 TaskEstimate와 맞는 모양) */
export interface ItemEstimate {
    minutes: number;
    high?: number;
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
 *
 * 직접 적은 시간은 내 계획이라 범위가 없다. 예상에 범위가 있으면 위쪽 값으로
 * '늦으면'을 따로 더한다.
 */
export const computeTodayLoad = (
    items: TodoItem[],
    estimateOf: (item: TodoItem) => ItemEstimate | undefined,
): TodayLoad => {
    const load: TodayLoad = { remaining: 0, remainingHigh: 0, unknown: 0, estimated: 0, known: 0, perRoot: new Map() };

    /** 이 항목(과 하위)의 남은 몫. any는 시간을 아는 몫이 있었는지 */
    const visit = (node: TaskNode): { min: number; high: number; any: boolean } => {
        const { item, children } = node;
        const none = { min: 0, high: 0, any: false };
        if (item.checked) return none;

        const est = item.duration === undefined && !hasExplicitBelow(node) ? estimateOf(item) : undefined;
        const own = item.duration ?? est?.minutes;
        if (own !== undefined) {
            load.known++;
            if (item.duration === undefined) load.estimated++;
            const left = children.length > 0 ? 1 - doneFraction(node) : 1;
            const ownHigh = item.duration ?? est?.high ?? own;
            return { min: own * left, high: ownHigh * left, any: true };
        }
        if (children.length > 0) {
            return children.map(visit).reduce(
                (acc, p) => ({ min: acc.min + p.min, high: acc.high + p.high, any: acc.any || p.any }),
                none,
            );
        }
        load.unknown++;
        return none;
    };

    for (const root of buildTaskTree(items)) {
        const part = visit(root);
        load.remaining += part.min;
        load.remainingHigh += part.high;
        if (part.any) {
            load.perRoot.set(root.item.lineIndex, { remaining: Math.round(part.min), high: Math.round(part.high) });
        }
    }
    load.remaining = Math.round(load.remaining);
    load.remainingHigh = Math.round(load.remainingHigh);
    return load;
};

// ===== 하루 단위: 계획한 양 vs 끝낸 양 =====

export interface DayTotals {
    /** 그날 목록 전체에 드는 시간 (분) — 끝낸 것 + 남은 것 */
    planned: number;
    /** 그중 끝낸 몫 (분) */
    done: number;
    /** 시간을 알 수 없는 항목 수 */
    unknown: number;
}

/**
 * 하루 목록의 계획량과 완료량. 시간을 정하는 규칙은 computeTodayLoad와 같다
 * (직접 적은 시간 → 예상 → 하위 항목의 합). 끝낸 항목의 '(30m)'는 실제 걸린 시간이다.
 */
export const computeDayTotals = (
    items: TodoItem[],
    estimateOf: (item: TodoItem) => ItemEstimate | null | undefined,
): DayTotals => {
    const totals: DayTotals = { planned: 0, done: 0, unknown: 0 };

    const visit = (node: TaskNode): void => {
        const { item, children } = node;
        const est = item.duration === undefined && !hasExplicitBelow(node) ? estimateOf(item) : undefined;
        const own = item.duration ?? est?.minutes;
        if (own !== undefined) {
            // 부모를 직접 체크했으면 하위와 상관없이 끝낸 것으로 본다
            const frac = item.checked ? 1 : children.length > 0 ? doneFraction(node) : 0;
            totals.planned += own;
            totals.done += own * frac;
            return;
        }
        if (children.length > 0) {
            children.forEach(visit);
            return;
        }
        totals.unknown++;
    };

    buildTaskTree(items).forEach(visit);
    totals.planned = Math.round(totals.planned);
    totals.done = Math.round(totals.done);
    return totals;
};

/** 지난 하루의 계획량·완료량 */
export interface DayRecord {
    date: string;
    planned: number;
    done: number;
}

/** 같은 요일을 몇 주까지 돌아볼지 */
export const TYPICAL_DONE_WEEKS = 8;
/** 같은 요일 기록이 이만큼 있어야 요일 기준으로 본다 */
export const SAME_WEEKDAY_MIN = 4;
/** 요일 기록이 모자랄 때 돌아볼 기간 (일) */
export const TYPICAL_DONE_RECENT_DAYS = 28;
/** 그때 필요한 최소 일수 */
export const RECENT_DONE_MIN = 5;

export interface TypicalDone {
    /** 평소 하루에 끝내는 양 (분, 중간값) */
    minutes: number;
    /** 바탕이 된 일수 */
    days: number;
    /** 같은 요일 기준이면 그 요일 (0=일), 최근 기간 기준이면 null */
    weekday: number | null;
    /** 그날들 계획한 것 중 끝낸 비율 (%, 중간값) */
    doneRatioPct: number;
}

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
export const weekdayName = (wd: number): string => `${WEEKDAY_NAMES[wd]}요일`;

const weekdayOf = (dateStr: string): number => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12).getDay();
};

/**
 * 평소 하루에 끝내는 양.
 *
 * 요일마다 하루가 꽤 다르다 (실제 기록에서 화·토는 3시간 남짓, 월·수·일은 5시간 넘게).
 * 그래서 최근 8주의 같은 요일이 4일 이상이면 그것으로, 모자라면 최근 4주 전체로 본다.
 * 계획에 시간이 하나도 없던 날은 뺀다 (끝낸 양을 셀 수 없다).
 */
export const getTypicalDone = (records: DayRecord[], todayStr: string): TypicalDone | null => {
    const past = records.filter(r => r.date < todayStr && r.planned > 0);
    const wd = weekdayOf(todayStr);

    const weeksFrom = shiftDate(todayStr, -TYPICAL_DONE_WEEKS * 7);
    const sameWeekday = past.filter(r => r.date >= weeksFrom && weekdayOf(r.date) === wd);

    const recentFrom = shiftDate(todayStr, -TYPICAL_DONE_RECENT_DAYS);
    const recent = past.filter(r => r.date >= recentFrom);

    const [picked, weekday] = sameWeekday.length >= SAME_WEEKDAY_MIN
        ? [sameWeekday, wd]
        : recent.length >= RECENT_DONE_MIN ? [recent, null] : [null, null];
    if (!picked) return null;

    const med = (xs: number[]) => {
        const s = [...xs].sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    };
    return {
        minutes: Math.round(med(picked.map(r => r.done))),
        days: picked.length,
        weekday,
        doneRatioPct: Math.round(med(picked.map(r => r.done / r.planned)) * 100),
    };
};

/** 오늘 계획을 평소 끝내는 양과 견준다. 20% 안쪽이면 '평소만큼'으로 본다 */
export const comparePlanToTypical = (planned: number, typical: number): { tone: 'over' | 'even' | 'under'; diff: number } => {
    const diff = planned - typical;
    if (planned > typical * 1.2) return { tone: 'over', diff };
    if (planned < typical * 0.8) return { tone: 'under', diff };
    return { tone: 'even', diff };
};

/**
 * 지금부터 화면 순서대로 이어서 하면 각 항목이 몇 시에 끝나는지.
 * '4시간 남음'보다 '19시 25분에 끝남'이 손에 잡힌다.
 * 시간을 모르는 항목은 0분으로 보고 건너뛴다 (끝나는 시각을 붙이지 않는다).
 *
 * @param order  최상위 항목 줄 번호를 화면에 보이는 순서대로
 * @param nowMin 논리적 0시부터 지금까지의 분
 * @returns 줄 번호 → 끝나는 시각 (논리적 0시부터 분)
 */
export const projectFinishTimes = (
    order: number[],
    perRoot: Map<number, RootLoad>,
    nowMin: number,
): Map<number, number> => {
    const out = new Map<number, number>();
    let t = nowMin;
    for (const lineIndex of order) {
        const part = perRoot.get(lineIndex);
        if (!part || part.remaining <= 0) continue;
        t += part.remaining;
        out.set(lineIndex, t);
    }
    return out;
};
