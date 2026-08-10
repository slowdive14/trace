/**
 * Serein → 옵시디언 일간노트 동기화
 *
 * 매일 수동으로 마크다운을 복사해 붙여넣던 과정을 대신한다.
 * Firestore에서 직접 읽어 앱과 똑같은 형식으로 마크다운을 만들고,
 * 볼트의 해당 날짜 노트 '# Serein' 섹션을 갱신한다.
 *
 * 앱과 형식을 공유하기 위해 src/utils/exportUtils의 exportDailyMarkdown을 그대로 쓴다.
 *
 * 사용법:
 *   npm run sync:obsidian              # 최근 2일 (기본)
 *   npm run sync:obsidian -- --days 7  # 최근 7일 소급
 *   npm run sync:obsidian -- --date 2026-08-10
 *   npm run sync:obsidian -- --dry-run # 파일을 쓰지 않고 결과만 출력
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { format, subDays, addDays, startOfDay } from 'date-fns';

import { exportDailyMarkdown } from '../src/utils/exportUtils';
import type { Entry, Expense, Todo, Worry, WorryEntry } from '../src/types/types';
import {
    replaceSereinSection, noteRelPath, renderTemplate, findUnresolvedTags,
    DEFAULT_NOTE_PATH, DEFAULT_TEMPLATE_PATH, SECTION_HEADING,
} from './obsidianNote';

const HERE = dirname(fileURLToPath(import.meta.url));

interface Config {
    /** 옵시디언 볼트 루트 */
    vaultPath: string;
    /** Firebase 서비스 계정 키(JSON) 경로 */
    serviceAccountPath: string;
    /** Serein 로그인 이메일 — 이걸로 uid를 찾는다 */
    userEmail: string;
    /** 일간노트 경로 템플릿. {yyyy} {M} {yyyyMMdd} {ddd} 치환 */
    notePathTemplate?: string;
    /** 표식이 없는 노트에서 Serein 섹션의 끝으로 볼 헤딩 */
    sectionEndHeading?: string;
    /** 일간노트가 없을 때 쓸 Templater 템플릿 (볼트 기준 상대경로) */
    templatePath?: string;
    /** 노트가 없으면 템플릿으로 만들지 여부 (기본 true) */
    createMissingNotes?: boolean;
}

function loadConfig(): Config {
    const path = join(HERE, 'obsidian-sync.config.json');
    if (!existsSync(path)) {
        console.error(`설정 파일이 없습니다: ${path}`);
        console.error('scripts/obsidian-sync.config.example.json 을 복사해 채워주세요.');
        process.exit(1);
    }
    return JSON.parse(readFileSync(path, 'utf8')) as Config;
}

const toDate = (v: unknown): Date =>
    v instanceof Timestamp ? v.toDate() : new Date(v as string | number | Date);

async function main() {
    const argv = process.argv.slice(2);
    const arg = (name: string): string | undefined => {
        const i = argv.indexOf(`--${name}`);
        return i !== -1 ? argv[i + 1] : undefined;
    };
    const dryRun = argv.includes('--dry-run');
    const cfg = loadConfig();
    const template = cfg.notePathTemplate ?? DEFAULT_NOTE_PATH;

    // 동기화 대상 날짜 목록
    const explicit = arg('date');
    const days = Number(arg('days') ?? 2);
    const targets: Date[] = explicit
        ? [startOfDay(new Date(`${explicit}T12:00:00`))]
        : Array.from({ length: days }, (_, i) => startOfDay(subDays(new Date(), i + 1)));

    // ---- Firebase ----
    const keyPath = resolve(HERE, cfg.serviceAccountPath);
    if (!existsSync(keyPath)) {
        console.error(`서비스 계정 키를 찾을 수 없습니다: ${keyPath}`);
        process.exit(1);
    }
    initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });

    const uid = (await getAuth().getUserByEmail(cfg.userEmail)).uid;
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);

    // 논리적 하루는 새벽 5시 경계라, 대상 범위보다 앞뒤로 하루씩 넉넉히 읽고
    // exportDailyMarkdown이 자체 기준으로 걸러내게 둔다.
    const from = subDays(targets[targets.length - 1], 1);
    const to = addDays(targets[0], 2);

    const readRange = async (name: string, field: string) => {
        const snap = await userRef.collection(name)
            .where(field, '>=', Timestamp.fromDate(from))
            .where(field, '<=', Timestamp.fromDate(to))
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    };

    const [rawEntries, rawBooks, rawExpenses, rawWorryEntries, worriesSnap] = await Promise.all([
        readRange('entries', 'timestamp'),
        readRange('books', 'timestamp'),
        readRange('expenses', 'timestamp'),
        readRange('worryEntries', 'timestamp'),
        userRef.collection('worries').get(),
    ]);

    const entries = rawEntries.map(e => ({ ...e, timestamp: toDate((e as any).timestamp) })) as Entry[];
    const books = rawBooks.map(e => ({ ...e, timestamp: toDate((e as any).timestamp) })) as Entry[];
    const expenses = rawExpenses.map(e => ({ ...e, timestamp: toDate((e as any).timestamp) })) as Expense[];
    const worryEntries = rawWorryEntries.map(e => ({ ...e, timestamp: toDate((e as any).timestamp) })) as WorryEntry[];
    const worries = worriesSnap.docs.map(d => {
        const v = d.data();
        return {
            id: d.id, ...v,
            startDate: toDate(v.startDate),
            closedAt: v.closedAt ? toDate(v.closedAt) : undefined,
        };
    }) as Worry[];

    let updated = 0;
    const skipped: string[] = [];

    for (const date of targets) {
        const dateStr = format(date, 'yyyy-MM-dd');

        const todoSnap = await userRef.collection('todos').doc(dateStr).get();
        const todo = todoSnap.exists
            ? ({ id: todoSnap.id, ...todoSnap.data(), date: toDate(todoSnap.data()!.date) } as Todo)
            : undefined;

        const reflSnap = await userRef.collection('dailyReflections').doc(dateStr).get();
        const reflection = reflSnap.exists ? (reflSnap.data()!.content as string) : undefined;

        const markdown = exportDailyMarkdown(
            date, entries, books, expenses, todo, worryEntries, worries, reflection,
        );

        if (!markdown.trim()) {
            skipped.push(`${dateStr} (기록 없음)`);
            continue;
        }

        const relPath = noteRelPath(date, template);
        const notePath = join(cfg.vaultPath, relPath);
        let created = false;

        if (!existsSync(notePath)) {
            if (cfg.createMissingNotes === false) {
                skipped.push(`${dateStr} (노트 없음: ${relPath})`);
                continue;
            }
            // 옵시디언을 켜지 않은 날은 노트가 아예 없다. 템플릿으로 만들어 준다.
            const tplPath = join(cfg.vaultPath, cfg.templatePath ?? DEFAULT_TEMPLATE_PATH);
            if (!existsSync(tplPath)) {
                skipped.push(`${dateStr} (템플릿 없음: ${cfg.templatePath ?? DEFAULT_TEMPLATE_PATH})`);
                continue;
            }

            const rendered = renderTemplate(readFileSync(tplPath, 'utf8'), date);
            const unresolved = findUnresolvedTags(rendered);
            if (unresolved.length) {
                console.warn(`  ⚠ ${dateStr} 템플릿에 처리 못한 태그가 남았습니다: ${unresolved.join(', ')}`);
            }

            if (!dryRun) {
                mkdirSync(dirname(notePath), { recursive: true });
                writeFileSync(notePath, rendered, 'utf8');
            }
            created = true;
        }

        const original = created && dryRun
            ? renderTemplate(readFileSync(join(cfg.vaultPath, cfg.templatePath ?? DEFAULT_TEMPLATE_PATH), 'utf8'), date)
            : readFileSync(notePath, 'utf8');
        const next = replaceSereinSection(original, markdown, cfg.sectionEndHeading);
        if (next === null) {
            skipped.push(`${dateStr} ('${SECTION_HEADING}' 섹션 없음)`);
            continue;
        }
        if (next === original) {
            console.log(`= ${dateStr} 변경 없음`);
            continue;
        }

        if (dryRun) {
            console.log(`\n--- ${dateStr} (dry-run) ---\n${markdown}\n`);
        } else {
            writeFileSync(notePath, next, 'utf8');
        }
        updated++;
        console.log(`✔ ${dateStr} → ${relPath}${created ? ' (노트 새로 만듦)' : ''}`);
    }

    console.log(`\n완료: ${updated}건 갱신${dryRun ? ' (dry-run, 파일 미변경)' : ''}`);
    if (skipped.length) console.log(`건너뜀:\n  - ${skipped.join('\n  - ')}`);
}

// 직접 실행할 때만 동작 (테스트에서 import할 수 있도록)
if (process.argv[1] && process.argv[1].includes('sync-obsidian')) {
    main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
