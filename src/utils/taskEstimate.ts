/**
 * 할 일 예상 소요시간.
 *
 * 소요시간을 직접 적지 않은 항목에, 지난 기록으로 '대략 얼마쯤 걸릴지'를 붙인다.
 * 기록은 두 군데에 있다.
 *   - 앱: 할 일을 체크할 때 입력한 '(30m)'
 *   - Toggl: 타이머로 잰 실제 시간 (스크립트가 날짜·설명별로 모아 Firestore에 둔다)
 * 둘 다 서로를 완전히 담고 있지 않으므로 합쳐서 쓴다. 같은 날 같은 일이 양쪽에
 * 있으면 같은 작업을 두 번 센 것이므로 하나로 합치고, 시간은 Toggl 값을 쓴다.
 *
 * 이름은 매번 조금씩 다르게 적힌다 ('보고서 1' / '보고서1', '넥서스 30쪽' / '넥서스 60').
 * 그래서 숫자·괄호·공백을 걷어낸 '바탕 이름'으로 묶고, 그 안에서
 *   1) 분량(쪽수)이 있으면 쪽당 시간 × 쪽수
 *   2) 똑같은 이름의 기록이 있으면 그것만
 *   3) 없으면 바탕 이름이 같은 기록 전체
 * 순서로 고른다. 그래도 없으면 Toggl 프로젝트 이름으로 찾는다.
 */
import { parseTodos, parseDuration, formatDuration } from './todoUtils';

export type SampleSource = 'app' | 'toggl';

/** 한 번 해 본 기록 (하루에 한 건) */
export interface DurationSample {
    /** 논리적 날짜 'YYYY-MM-DD' */
    date: string;
    minutes: number;
    /** 원래 이름 (분량·같은 이름 판단에 쓴다) */
    text: string;
    source: SampleSource;
}

/** Toggl 기록을 논리적 하루 · 설명 · 프로젝트별로 합친 한 줄 (스크립트가 만든다) */
export interface TogglRow {
    /** 논리적 날짜 'YYYY-MM-DD' */
    d: string;
    /** 설명 */
    t: string;
    /** 프로젝트 이름 */
    p?: string;
    /** 분 */
    m: number;
}

export type EstimateMethod = 'perPage' | 'same' | 'similar' | 'project';

export interface TaskEstimate {
    /** 예상 소요시간 (분, 5분 단위) — 최근 기록의 중간값 */
    minutes: number;
    /**
     * 보통 걸리는 범위 (분, 5분 단위) — 최근 기록의 가운데 절반(25~75%).
     * 같은 일도 날마다 걸리는 시간이 달라서 한 점보다 범위가 정직하다.
     * 기록이 RANGE_MIN_COUNT번보다 적으면 범위를 믿기 어려워 없다.
     */
    low?: number;
    high?: number;
    method: EstimateMethod;
    /** 근거가 된 기록 수 */
    count: number;
    /** 그중 출처별 수 */
    app: number;
    toggl: number;
    /** perPage일 때 쪽당 분 */
    perPage?: number;
    /** perPage일 때 쪽수 */
    pages?: number;
    /** project일 때 Toggl 프로젝트 이름 */
    project?: string;
}

/** 최근 몇 건으로 예상할지 */
export const ESTIMATE_RECENT = 8;

/** 범위를 보여 주려면 기록이 몇 번 있어야 하는지 */
export const RANGE_MIN_COUNT = 3;

/** 표시와 무관한 표식(eid·소요시간·사분면 태그·강조·추가 표시)을 걷어낸 이름 */
export const normalizeTaskText = (text: string): string => {
    let t = text
        .replace(/\s*\{eid:[^}]+\}/g, '')
        .replace(/\s*#q[1-4]\b/g, '')
        .replace(/\*\*|==/g, '')
        .replace(/^\+\s*/, '')
        .trim();
    const dur = parseDuration(t);
    if (dur) t = dur.cleanText;
    return t.trim();
};

/** 똑같은 이름인지 볼 때 쓰는 열쇠 (공백·대소문자만 무시) */
export const taskKey = (text: string): string =>
    normalizeTaskText(text).replace(/\s+/g, '').toLowerCase();

// 'p'는 영단어 머리(people 등)와 헷갈리지 않게 뒤에 글자가 이어지지 않을 때만 쪽으로 본다
const PAGE_RE = /(\d+)\s*(?:쪽|페이지|pages?|p(?![a-z가-힣]))/i;

/**
 * 가려 쓴 사람 이름 ('신OO', '김라O', '이oo님', '신ㅇㅇ').
 * 같은 종류의 일('○○ 보고서 작성')이 사람마다 다른 이름으로 갈라지지 않게 걷어 낸다.
 */
const MASKED_NAME_RE = /[가-힣]{1,2}[OoＯ○ㅇ]{1,2}(?![a-zA-Z])님?/g;

/** 바탕 이름: 괄호 안·가린 이름·숫자(와 쪽 단위)·공백·문장부호를 걷어낸 이름 */
export const taskBase = (text: string): string =>
    normalizeTaskText(text)
        .replace(/\([^)]*\)/g, '')
        .replace(MASKED_NAME_RE, '')
        .replace(/\d+(?:\.\d+)?\s*(?:쪽|페이지|pages?|p(?![a-z가-힣]))?/gi, '')
        .replace(/[\s.,·:;!?~\-_/()[\]]+/g, '')
        .toLowerCase();

/** 이름에 적힌 쪽수 ('30쪽', '41p', '(전자책 120p)') */
export const pageCount = (text: string): number | undefined => {
    const m = normalizeTaskText(text).match(PAGE_RE);
    const n = m ? parseInt(m[1], 10) : NaN;
    return n > 0 ? n : undefined;
};

/** 이름 끝의 맨 숫자 ('넥서스 60'). 쪽 단위 없이 분량을 적었을 때 쓴다 */
export const trailingNumber = (text: string): number | undefined => {
    const m = normalizeTaskText(text).match(/(\d+)\s*$/);
    const n = m ? parseInt(m[1], 10) : NaN;
    return n > 0 ? n : undefined;
};

/** 백분위수 (사이 값은 선형 보간). q는 0~1 */
const quantile = (xs: number[], q: number): number => {
    const s = [...xs].sort((a, b) => a - b);
    const pos = (s.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};

const median = (xs: number[]): number => quantile(xs, 0.5);

const roundTo5 = (minutes: number): number => Math.max(5, Math.round(minutes / 5) * 5);

/** 표본 값들로 예상(중간값)과 범위(25~75%)를 낸다. scale은 쪽수 환산처럼 곱할 값 */
const spread = (values: number[], scale = 1): Pick<TaskEstimate, 'minutes' | 'low' | 'high'> => {
    const minutes = roundTo5(median(values) * scale);
    if (values.length < RANGE_MIN_COUNT) return { minutes };
    const low = roundTo5(quantile(values, 0.25) * scale);
    const high = roundTo5(quantile(values, 0.75) * scale);
    return low === high ? { minutes } : { minutes, low, high };
};

const recent = (samples: DurationSample[]): DurationSample[] =>
    [...samples].sort((a, b) => b.date.localeCompare(a.date)).slice(0, ESTIMATE_RECENT);

/**
 * 앱 기록에서 표본을 모은다: 완료한 항목 중 소요시간을 적은 것.
 * 오늘(과 그 뒤) 날짜는 뺀다. 오늘 적힌 시간은 아직 계획일 수 있다.
 */
export const collectAppSamples = (
    days: { date: string; content: string }[],
    beforeDate: string,
): DurationSample[] => {
    const out: DurationSample[] = [];
    for (const { date, content } of days) {
        if (date >= beforeDate) continue;
        for (const item of parseTodos(content)) {
            if (!item.checked || !item.duration) continue;
            out.push({ date, minutes: item.duration, text: item.text, source: 'app' });
        }
    }
    return out;
};

/**
 * 같은 날 같은 일이 양쪽에 있으면 하나로 합친다.
 * 한 쌍뿐이면 이름(분량)은 앱 것, 시간은 Toggl 것을 쓴다.
 * 여러 건이 섞여 짝을 알 수 없으면 Toggl 쪽만 남긴다 (같은 시간을 두 번 세지 않게).
 */
const mergeDay = (app: DurationSample[], toggl: DurationSample[]): DurationSample[] => {
    if (app.length === 0) return toggl;
    if (toggl.length === 0) return app;

    const out: DurationSample[] = [];
    const restApp = [...app];
    const restToggl: DurationSample[] = [];

    // 이름까지 같은 것끼리 먼저 짝짓는다
    for (const t of toggl) {
        const i = restApp.findIndex(a => taskKey(a.text) === taskKey(t.text));
        if (i === -1) { restToggl.push(t); continue; }
        out.push({ ...t, text: restApp[i].text });
        restApp.splice(i, 1);
    }

    if (restApp.length === 1 && restToggl.length === 1) {
        out.push({ ...restToggl[0], text: restApp[0].text });
    } else {
        out.push(...restToggl);
    }
    return out;
};

const groupBy = <T>(xs: T[], key: (x: T) => string): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const x of xs) {
        const k = key(x);
        if (!k) continue;
        const list = m.get(k);
        if (list) list.push(x); else m.set(k, [x]);
    }
    return m;
};

export type Estimator = (text: string) => TaskEstimate | null;

/** 기록을 미리 묶어 두고, 이름을 넣으면 예상 시간을 돌려주는 함수를 만든다 */
export const buildEstimator = (appSamples: DurationSample[], togglRows: TogglRow[]): Estimator => {
    const togglSamples: DurationSample[] = togglRows
        .filter(r => r.t && r.m > 0)
        .map(r => ({ date: r.d, minutes: r.m, text: r.t, source: 'toggl' as const }));

    // 바탕 이름별로 묶고, 날짜마다 두 출처를 합친다
    const groups = new Map<string, DurationSample[]>();
    const appByBase = groupBy(appSamples, s => taskBase(s.text));
    const togglByBase = groupBy(togglSamples, s => taskBase(s.text));
    for (const base of new Set([...appByBase.keys(), ...togglByBase.keys()])) {
        const appByDate = groupBy(appByBase.get(base) ?? [], s => s.date);
        const togglByDate = groupBy(togglByBase.get(base) ?? [], s => s.date);
        const merged: DurationSample[] = [];
        for (const date of new Set([...appByDate.keys(), ...togglByDate.keys()])) {
            merged.push(...mergeDay(appByDate.get(date) ?? [], togglByDate.get(date) ?? []));
        }
        groups.set(base, merged);
    }

    // Toggl 프로젝트별 하루 합계 (설명으로 못 찾을 때만 쓴다)
    const projectDays = new Map<string, { name: string; byDate: Map<string, number> }>();
    for (const r of togglRows) {
        if (!r.p || r.m <= 0) continue;
        const base = taskBase(r.p);
        if (!base) continue;
        let entry = projectDays.get(base);
        if (!entry) { entry = { name: r.p, byDate: new Map() }; projectDays.set(base, entry); }
        entry.byDate.set(r.d, (entry.byDate.get(r.d) ?? 0) + r.m);
    }

    /** 고른 표본의 값(분, 또는 쪽당 분)으로 예상·범위와 근거를 묶는다 */
    const summarize = (
        picked: DurationSample[],
        method: EstimateMethod,
        values: number[],
        scale = 1,
    ): TaskEstimate => ({
        ...spread(values, scale),
        method,
        count: picked.length,
        app: picked.filter(s => s.source === 'app').length,
        toggl: picked.filter(s => s.source === 'toggl').length,
    });

    return (text: string): TaskEstimate | null => {
        const base = taskBase(text);
        if (!base) return null;   // '1', '2' 같은 이름은 맞출 근거가 없다

        const group = groups.get(base);
        if (group && group.length > 0) {
            // 1) 분량으로 환산 — 지난 기록에 쪽수가 있을 때만 맨 숫자도 쪽수로 읽는다
            const withPages = group.filter(s => pageCount(s.text));
            const pages = pageCount(text) ?? (withPages.length > 0 ? trailingNumber(text) : undefined);
            if (pages && withPages.length > 0) {
                const picked = recent(withPages);
                const rates = picked.map(s => s.minutes / pageCount(s.text)!);
                return { ...summarize(picked, 'perPage', rates, pages), perPage: median(rates), pages };
            }

            // 2) 똑같은 이름 → 3) 바탕 이름이 같은 것 전체
            const key = taskKey(text);
            const same = group.filter(s => taskKey(s.text) === key);
            const picked = recent(same.length > 0 ? same : group);
            return summarize(picked, same.length > 0 ? 'same' : 'similar', picked.map(s => s.minutes));
        }

        // 4) Toggl 프로젝트 이름과 같으면 그 프로젝트에 하루 쓴 시간
        const project = projectDays.get(base);
        if (project) {
            const days = [...project.byDate.entries()]
                .sort((a, b) => b[0].localeCompare(a[0]))
                .slice(0, ESTIMATE_RECENT);
            return {
                ...spread(days.map(([, m]) => m)),
                method: 'project',
                count: days.length,
                app: 0,
                toggl: days.length,
                project: project.name,
            };
        }

        return null;
    };
};

/** 화면 표기: 범위가 있으면 '1h~1h30m', 없으면 '1h15m' */
export const formatEstimate = (e: Pick<TaskEstimate, 'minutes' | 'low' | 'high'>): string =>
    e.low !== undefined && e.high !== undefined
        ? `${formatDuration(e.low)}~${formatDuration(e.high)}`
        : formatDuration(e.minutes);

/** 예상 근거를 사람이 읽을 문구로 */
export const describeEstimate = (e: TaskEstimate): string => {
    const src = [e.toggl > 0 && `Toggl ${e.toggl}`, e.app > 0 && `앱 ${e.app}`].filter(Boolean).join(' · ');
    // 범위로 보일 때는 합계에 쓰는 한 점(중간값)도 알려 준다
    const mid = e.low !== undefined ? ` · 중간값 ${formatDuration(e.minutes)}` : '';
    switch (e.method) {
        case 'perPage':
            return `쪽당 ${e.perPage!.toFixed(1)}분 × ${e.pages}쪽 (최근 기록 ${e.count}번: ${src})${mid}`;
        case 'same':
            return `같은 일 최근 ${e.count}번의 중간값 (${src})${mid}`;
        case 'similar':
            return `비슷한 일 최근 ${e.count}번의 중간값 (${src})${mid}`;
        case 'project':
            return `Toggl 프로젝트 '${e.project}'에 하루 쓴 시간, 최근 ${e.count}일의 중간값${mid}`;
    }
};
