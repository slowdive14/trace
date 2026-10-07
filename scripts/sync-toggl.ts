/**
 * Toggl 기록을 받아 users/{uid}/stats/toggl 에 요약해 둔다.
 * 앱은 이 요약으로 할 일의 예상 소요시간을 낸다 (src/utils/taskEstimate.ts).
 *
 * 사용법:
 *   npm run sync:toggl                # 최근 90일
 *   npm run sync:toggl -- --days 120
 *   npm run sync:toggl -- --dry-run   # 받아만 보고 저장하지 않는다 (맞춰지는지 확인용)
 *
 * 매일 도는 옵시디언 동기화(sync:obsidian)도 끝에 이것을 부른다.
 * 설정 파일에 togglApiToken이 없으면 조용히 건너뛴다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { format, subDays } from 'date-fns';

import { fetchTogglRows, keepKnownRows, logicalDateOf, TogglError, type TogglTarget } from './toggl';
import {
    buildEstimator, collectAppSamples, describeEstimate, normalizeTaskText, taskBase, type TogglRow,
} from '../src/utils/taskEstimate';
import { parseTodos } from '../src/utils/todoUtils';

const HERE = dirname(fileURLToPath(import.meta.url));

/** 기본으로 받는 기간 (일) */
export const DEFAULT_TOGGL_DAYS = 90;

/** Firestore 문서 한도(1MiB)보다 넉넉히 작게 */
const MAX_DOC_BYTES = 800_000;

/** 문서가 너무 크면 오래된 날부터 덜어 낸다 */
const fitToDoc = (rows: TogglRow[]): TogglRow[] => {
    let out = rows;
    while (out.length > 0 && JSON.stringify(out).length > MAX_DOC_BYTES) {
        const oldest = out[0].d;
        out = out.filter(r => r.d !== oldest);
    }
    return out;
};

export interface TogglSyncOptions {
    days?: number;
    dryRun?: boolean;
}

/** 설정 파일에서 Toggl 관련 항목 */
export interface TogglConfig {
    /** Toggl 2.0 API 키 (toggl_sk_...) */
    togglApiToken?: string;
    /** 조직 ID — API 키로는 알아낼 수 없어 직접 적는다 */
    togglOrganizationId?: number | string;
    /** (선택) 워크스페이스 ID — 없으면 Toggl 설정에서 읽는다 */
    togglWorkspaceId?: number | string;
}

/** 설정에서 조회 대상을 만든다. 조직 ID가 없으면 이유를 돌려준다 */
export const togglTargetFrom = (cfg: TogglConfig): TogglTarget | string => {
    const org = Number(cfg.togglOrganizationId);
    if (!(org > 0)) return '설정 파일에 togglOrganizationId가 없습니다 (scripts/README.md의 Toggl 항목 참고)';
    const ws = Number(cfg.togglWorkspaceId);
    return ws > 0 ? { organizationId: org, workspaceId: ws } : { organizationId: org };
};

/**
 * Toggl 요약을 갱신한다. 실패해도 예외를 밖으로 던지지 않고 결과 문구만 돌려준다
 * (옵시디언 동기화가 Toggl 때문에 실패로 끝나지 않게).
 */
export async function syncToggl(
    userRef: DocumentReference,
    cfg: TogglConfig,
    { days = DEFAULT_TOGGL_DAYS, dryRun = false }: TogglSyncOptions = {},
): Promise<string> {
    if (!cfg.togglApiToken) return 'Toggl 건너뜀: 설정 파일에 togglApiToken이 없습니다';
    const target = togglTargetFrom(cfg);
    if (typeof target === 'string') return `Toggl 건너뜀: ${target}`;

    const now = new Date();
    const from = subDays(now, days);

    let fetched;
    try {
        fetched = await fetchTogglRows(cfg.togglApiToken, target, from, now);
    } catch (e) {
        return e instanceof TogglError ? `Toggl 건너뜀: ${e.message}` : `Toggl 건너뜀: ${(e as Error).message}`;
    }

    // 할 일 탭에 적어 본 이름과 맞는 기록만 남긴다 (Toggl의 내담자 실명 등이 앱으로 옮겨 오지 않게)
    const todoDocs = await loadTodoDocs(userRef);
    const known = await knownTaskBases(userRef, todoDocs);
    const rows = fitToDoc(keepKnownRows(fetched.rows, known));

    const keptMin = rows.reduce((s, r) => s + r.m, 0);
    const allMin = fetched.rows.reduce((s, r) => s + r.m, 0);
    const summary = `Toggl ${fetched.entries}건 (${Math.round(allMin / 60)}시간) 중 할 일과 맞는 ${rows.length}줄`
        + ` (${Math.round(keptMin / 60)}시간), 요청 ${fetched.requests}회`;

    if (dryRun) {
        printPreview(todoDocs, rows);
        return `${summary} — dry-run, 저장 안 함`;
    }

    await userRef.collection('stats').doc('toggl').set({
        rows,
        from: logicalDateOf(from),
        to: logicalDateOf(now),
        entryCount: fetched.entries,
        updatedAt: FieldValue.serverTimestamp(),
    });
    return `${summary} 저장`;
}

interface TodoDoc {
    id: string;
    content: string;
}

/** todos 컬렉션 전부 (날짜별 문서 + 대기 목록 + 루틴 템플릿) */
async function loadTodoDocs(userRef: DocumentReference): Promise<TodoDoc[]> {
    const snap = await userRef.collection('todos').get();
    return snap.docs.map(d => ({ id: d.id, content: (d.data().content as string) ?? '' }));
}

/** 할 일 탭 어디에든(날짜별·대기 목록·루틴·반복 일정) 적어 본 이름들의 바탕 이름 */
async function knownTaskBases(userRef: DocumentReference, todoDocs: TodoDoc[]): Promise<Set<string>> {
    const out = new Set<string>();
    const add = (text: string) => { const b = taskBase(text); if (b) out.add(b); };
    for (const d of todoDocs) for (const item of parseTodos(d.content)) add(item.text);
    const repeats = await userRef.collection('recurringTodos').get();
    for (const r of repeats.docs) add((r.data().text as string) ?? '');
    return out;
}

/** 저장될 기록과, 최근 할 일 이름이 얼마나 맞춰지는지 보여 준다 */
function printPreview(todoDocs: TodoDoc[], rows: TogglRow[]) {
    const byDesc = new Map<string, number>();
    for (const r of rows) {
        const label = r.t || `(이름 없이 프로젝트만: ${r.p})`;
        byDesc.set(label, (byDesc.get(label) ?? 0) + r.m);
    }
    console.log('\n저장될 Toggl 기록 (분):');
    for (const [t, m] of [...byDesc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
        console.log(`  ${String(m).padStart(6)}  ${t}`);
    }

    const todayStr = format(new Date(Date.now() - 5 * 3600_000), 'yyyy-MM-dd');
    const days = todoDocs
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.id))
        .map(d => ({ date: d.id, content: d.content }));
    const appSamples = collectAppSamples(days, todayStr);
    const appOnly = buildEstimator(appSamples, []);
    const both = buildEstimator(appSamples, rows);

    // 최근 14일 동안 적었던 할 일 이름 (중복 제거)
    const since = format(subDays(new Date(), 14), 'yyyy-MM-dd');
    const names = new Map<string, string>();
    for (const d of days.filter(d => d.date >= since)) {
        for (const item of parseTodos(d.content)) {
            if (item.indent > 0) continue;
            const n = normalizeTaskText(item.text);
            if (n) names.set(n.toLowerCase(), n);
        }
    }

    let a = 0, b = 0;
    console.log(`\n최근 14일 할 일 ${names.size}개가 맞춰지는지 (앱만 → 앱+Toggl):`);
    for (const n of [...names.values()].sort()) {
        const ea = appOnly(n), eb = both(n);
        if (ea) a++;
        if (eb) b++;
        console.log(`  ${(ea ? `${ea.minutes}m` : '-').padStart(5)} → ${(eb ? `${eb.minutes}m` : '-').padStart(5)}  ${n}${eb ? `   [${describeEstimate(eb)}]` : ''}`);
    }
    console.log(`\n예상 가능: 앱만 ${a}/${names.size} → 앱+Toggl ${b}/${names.size}`);
}

async function main() {
    const argv = process.argv.slice(2);
    const arg = (name: string) => { const i = argv.indexOf(`--${name}`); return i !== -1 ? argv[i + 1] : undefined; };
    const dryRun = argv.includes('--dry-run');
    const days = Number(arg('days') ?? DEFAULT_TOGGL_DAYS);

    const cfgPath = join(HERE, 'obsidian-sync.config.json');
    if (!existsSync(cfgPath)) {
        console.error(`설정 파일이 없습니다: ${cfgPath}`);
        process.exit(1);
    }
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as TogglConfig & {
        serviceAccountPath: string; userEmail: string; uid?: string;
    };

    initializeApp({ credential: cert(JSON.parse(readFileSync(resolve(HERE, cfg.serviceAccountPath), 'utf8'))) });
    const uid = cfg.uid ?? (await getAuth().getUserByEmail(cfg.userEmail)).uid;
    const userRef = getFirestore().collection('users').doc(uid);

    const result = await syncToggl(userRef, cfg, { days, dryRun });
    console.log(result);
    return result.startsWith('Toggl 건너뜀') ? 1 : 0;
}

if (process.argv[1] && process.argv[1].includes('sync-toggl')) {
    // process.exit()를 바로 부르면 Windows에서 fetch 소켓이 닫히는 중에 Node가
    // 'UV_HANDLE_CLOSING' 단언으로 죽는다. 종료 코드만 정해 두고 잠깐 뒤에 끝낸다.
    main()
        .then(code => { process.exitCode = code; })
        .catch(e => { console.error(e); process.exitCode = 1; })
        .finally(() => setTimeout(() => process.exit(), 100));
}
