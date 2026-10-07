/**
 * Toggl 2.0 → Firestore 요약
 *
 * Toggl API는 브라우저에서 직접 부를 수 없다 (CORS 허용 헤더가 없다). 그래서 PC에서
 * 도는 이 스크립트가 기록을 받아 '논리적 하루 · 이름 · 프로젝트'별로 합친 뒤
 * users/{uid}/stats/toggl 문서에 둔다. 앱은 그 문서만 읽는다.
 *
 * Toggl 2.0(focus.toggl.com)은 Toggl Track과 주소·인증이 다르다.
 *   - 키: 'toggl_sk_'로 시작, Authorization: Bearer
 *   - 기록 조회에 조직 ID와 워크스페이스 ID가 필요하다. 조직 ID는 API 키로 알아낼 수
 *     없어 설정 파일에 적는다. 워크스페이스 ID는 사용자 설정에서 읽는다.
 *
 * 무료 플랜의 호출 한도가 시간당 30회라, 한 번 돌 때 1~2번만 부른다
 * (stream 주소는 기간 전체를 페이지 없이 한 번에 돌려준다).
 */
import { format } from 'date-fns';
import type { TogglRow } from '../src/utils/taskEstimate';
import { taskBase } from '../src/utils/taskEstimate';

const API = 'https://focus.toggl.com/api';

/** 하루가 바뀌는 시각 (앱의 getLogicalDate와 같다) */
const DAY_START_HOUR = 5;

interface NamedRef {
    name?: string | null;
}

/** Toggl 2.0 time entry 중 여기서 쓰는 필드 */
export interface TogglEntry {
    start?: string | null;
    /** 초. 실행 중이거나 계획만 잡힌 기록에는 없다 */
    duration?: number | null;
    description?: string | null;
    deleted_at?: string | null;
    type?: string | null;
    project?: NamedRef | null;
    task?: (NamedRef & { parent_task_name?: string | null; project?: NamedRef | null }) | null;
}

/** 시작 시각이 속한 논리적 날짜 */
export const logicalDateOf = (start: Date): string =>
    format(new Date(start.getTime() - DAY_START_HOUR * 3600_000), 'yyyy-MM-dd');

/**
 * 기록의 이름. 설명을 먼저 쓰고, 없으면 연결된 할 일(task) 이름을 쓴다.
 * 할 일 이름이 '1', '2'처럼 숫자뿐이면 상위 할 일 이름을 앞에 붙인다.
 */
export const entryName = (e: TogglEntry): string => {
    const desc = (e.description ?? '').trim();
    if (desc) return desc;
    const task = (e.task?.name ?? '').trim();
    const parent = (e.task?.parent_task_name ?? '').trim();
    if (task && !taskBase(task) && parent) return `${parent} ${task}`;
    return task || parent;
};

/**
 * 기록을 논리적 하루 · 이름 · 프로젝트별로 합친다.
 * 같은 일을 하루에 여러 번 끊어 잰 것은 한 번으로 합쳐야 '그 일에 하루 얼마나 썼는지'가 된다.
 * 실행 중·계획만 잡힌·지운·휴식 기록과 1분이 안 되는 기록은 뺀다.
 */
export const toTogglRows = (entries: TogglEntry[]): TogglRow[] => {
    const sums = new Map<string, { d: string; t: string; p?: string; sec: number }>();

    for (const e of entries) {
        if (!e.start || !(typeof e.duration === 'number' && e.duration >= 60)) continue;
        if (e.deleted_at) continue;
        if (e.type === 'break') continue;

        const d = logicalDateOf(new Date(e.start));
        const t = entryName(e);
        const p = (e.project?.name ?? e.task?.project?.name ?? '').trim() || undefined;
        if (!t && !p) continue;

        const key = `${d}\u0000${t}\u0000${p ?? ''}`;
        const cur = sums.get(key);
        if (cur) cur.sec += e.duration;
        else sums.set(key, { d, t, p, sec: e.duration });
    }

    return [...sums.values()]
        .map(({ d, t, p, sec }) => (p ? { d, t, p, m: Math.round(sec / 60) } : { d, t, m: Math.round(sec / 60) }))
        .sort((a, b) => a.d.localeCompare(b.d) || a.t.localeCompare(b.t));
};

/**
 * 할 일 탭에 적어 본 적 있는 이름과 맞는 기록만 남긴다.
 *
 * Toggl 설명에는 내담자 실명처럼 앱에 옮겨 두고 싶지 않은 이름도 들어 있다.
 * 할 일 이름과 맞지 않는 기록은 어차피 예상에 쓰이지 않으므로 이름을 지운다.
 * 프로젝트 이름이 할 일과 맞으면 이름 없이 프로젝트별 시간만 남기고, 그것도
 * 아니면 버린다.
 */
export const keepKnownRows = (rows: TogglRow[], knownBases: Set<string>): TogglRow[] => {
    const merged = new Map<string, TogglRow>();
    for (const r of rows) {
        const tKnown = !!r.t && knownBases.has(taskBase(r.t));
        const pKnown = !!r.p && knownBases.has(taskBase(r.p));
        if (!tKnown && !pKnown) continue;

        const row: TogglRow = pKnown
            ? { d: r.d, t: tKnown ? r.t : '', p: r.p, m: r.m }
            : { d: r.d, t: r.t, m: r.m };
        const key = `${row.d}\u0000${row.t}\u0000${row.p ?? ''}`;
        const cur = merged.get(key);
        if (cur) cur.m += row.m;
        else merged.set(key, row);
    }
    return [...merged.values()].sort((a, b) => a.d.localeCompare(b.d) || a.t.localeCompare(b.t));
};

export class TogglError extends Error {
    constructor(message: string, readonly status?: number) { super(message); }
}

const request = async <T>(token: string, path: string): Promise<T> => {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
        throw new TogglError('Toggl API 키가 맞지 않습니다. Toggl 2.0의 API 키(toggl_sk_로 시작)를 확인해 주세요.', res.status);
    }
    if (res.status === 402 || res.status === 429) {
        throw new TogglError('Toggl 호출 한도(무료 플랜 시간당 30회)에 걸렸습니다. 한 시간쯤 뒤에 다시 돌려 주세요.', res.status);
    }
    if (!res.ok) {
        // 응답 본문만 남긴다. 요청 헤더(키)는 절대 출력하지 않는다
        let detail = '';
        try {
            const j = JSON.parse(await res.text()) as { error?: string; error_description?: string };
            detail = j.error_description ?? j.error ?? '';
        } catch { /* 본문이 JSON이 아니면 상태 코드만 */ }
        if (detail.includes('organization')) {
            detail += ' — 설정 파일의 togglOrganizationId를 확인해 주세요';
        }
        throw new TogglError(`Toggl 응답 오류 ${res.status}${detail ? `: ${detail}` : ''}`, res.status);
    }
    return res.json() as Promise<T>;
};

/** 지금 쓰고 있는 워크스페이스 ID (사용자 설정에서 읽는다) */
export const fetchCurrentWorkspaceId = async (token: string): Promise<number> => {
    const settings = await request<{ current_workspace_id?: number | null }>(token, '/users/me/settings');
    if (!settings.current_workspace_id) {
        throw new TogglError('Toggl 설정에서 현재 워크스페이스를 찾지 못했습니다. 설정 파일에 togglWorkspaceId를 적어 주세요.');
    }
    return settings.current_workspace_id;
};

export interface TogglTarget {
    organizationId: number;
    /** 없으면 사용자 설정에서 읽는다 (호출 1회 추가) */
    workspaceId?: number;
}

/** 기간 안의 기록을 받는다 */
export const fetchTogglRows = async (
    token: string,
    target: TogglTarget,
    from: Date,
    to: Date,
): Promise<{ rows: TogglRow[]; entries: number; requests: number }> => {
    let requests = 0;
    let workspaceId = target.workspaceId;
    if (!workspaceId) {
        workspaceId = await fetchCurrentWorkspaceId(token);
        requests++;
    }

    const qs = new URLSearchParams({
        date_from: from.toISOString(),
        date_to: to.toISOString(),
        include_taskless: 'true',   // 할 일에 묶지 않고 잰 기록도 받는다
        type: 'activity',           // 휴식은 뺀다
    });
    const entries = await request<TogglEntry[] | null>(
        token,
        `/organizations/${target.organizationId}/workspaces/${workspaceId}/time-entries/stream?${qs}`,
    );
    requests++;

    const list = Array.isArray(entries) ? entries : [];
    return { rows: toTogglRows(list), entries: list.length, requests };
};
