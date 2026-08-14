import { describe, it, expect } from 'vitest';
import { format, differenceInMinutes } from 'date-fns';
import { extractSleepRecords, type SleepRecord } from './sleepUtils';
import type { Entry } from '../types/types';

/**
 * 최적화 이전의 구현 (기상마다 취침 배열 전체를 훑던 O(n²) 방식).
 * 새 구현이 이것과 완전히 같은 결과를 내는지 대조하기 위해 남겨 둔다.
 */
function extractSleepRecordsLegacy(entries: Entry[]): SleepRecord[] {
    const sleepEntries = entries.filter(e => e.tags.includes('#sleep'))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const wakeEntries = entries.filter(e => e.tags.includes('#wake'))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const records: SleepRecord[] = [];
    const used = new Set<number>();

    for (const wake of wakeEntries) {
        const wakeTime = wake.timestamp;
        let best = -1;
        let bestDiff = Infinity;
        for (let i = 0; i < sleepEntries.length; i++) {
            if (used.has(i)) continue;
            const st = sleepEntries[i].timestamp;
            if (st >= wakeTime) continue;
            const diff = wakeTime.getTime() - st.getTime();
            if (diff < 24 * 60 * 60 * 1000 && diff < bestDiff) { bestDiff = diff; best = i; }
        }
        const record: SleepRecord = { date: format(wakeTime, 'yyyy-MM-dd'), wakeTime };
        if (best !== -1) {
            record.sleepTime = sleepEntries[best].timestamp;
            record.duration = differenceInMinutes(wakeTime, sleepEntries[best].timestamp);
            used.add(best);
        }
        records.push(record);
    }
    for (let i = 0; i < sleepEntries.length; i++) {
        if (used.has(i)) continue;
        records.push({ date: format(sleepEntries[i].timestamp, 'yyyy-MM-dd'), sleepTime: sleepEntries[i].timestamp });
    }

    // 낮잠 병합은 최적화 대상이 아니므로 생략 — 매칭 결과만 비교한다
    return records.sort((a, b) => b.date.localeCompare(a.date));
}

const mk = (id: string, tag: string, t: Date): Entry =>
    ({ id, content: tag, tags: [tag], category: 'action', timestamp: t } as Entry);

/** 재현 가능한 난수 */
function rng(seed: number) {
    let s = seed;
    return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

/** 결측·중복·불규칙이 섞인 현실적인 기록 생성 */
function randomEntries(seed: number, days: number): Entry[] {
    const r = rng(seed);
    const out: Entry[] = [];
    const base = new Date(2024, 0, 1);
    for (let d = 0; d < days; d++) {
        const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + d);
        // 취침을 20% 확률로 누락
        if (r() > 0.2) {
            const h = 21 + Math.floor(r() * 5);   // 21~01시
            out.push(mk(`s${d}`, '#sleep', new Date(day.getFullYear(), day.getMonth(), day.getDate() - (h >= 24 ? 0 : 1), h % 24, Math.floor(r() * 60))));
        }
        // 기상을 15% 확률로 누락
        if (r() > 0.15) {
            const h = 5 + Math.floor(r() * 5);
            out.push(mk(`w${d}`, '#wake', new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, Math.floor(r() * 60))));
        }
        // 가끔 하루에 취침 2번 (낮에 다시 누움 등)
        if (r() > 0.9) {
            out.push(mk(`s2_${d}`, '#sleep', new Date(day.getFullYear(), day.getMonth(), day.getDate(), 14, 0)));
        }
    }
    return out;
}

/** 낮잠 병합 전 상태로 비교하기 위해 매칭 결과만 뽑는다 */
const matchOnly = (rs: SleepRecord[]) =>
    rs.map(r => ({
        date: r.date,
        sleep: r.sleepTime?.toISOString() ?? null,
        wake: r.wakeTime?.toISOString() ?? null,
        duration: r.duration ?? null,
    }));

describe('extractSleepRecords — 선형화 후에도 결과가 같은가', () => {
    it('규칙적인 기록', () => {
        const entries = randomEntries(1, 60);
        expect(matchOnly(extractSleepRecords(entries))).toEqual(matchOnly(extractSleepRecordsLegacy(entries)));
    });

    it('결측·중복이 섞인 기록 (여러 시드)', () => {
        for (const seed of [7, 42, 99, 1234, 20260813]) {
            const entries = randomEntries(seed, 200);
            expect(matchOnly(extractSleepRecords(entries)))
                .toEqual(matchOnly(extractSleepRecordsLegacy(entries)));
        }
    });

    it('취침만 있고 기상이 없는 경우', () => {
        const entries = [
            mk('s1', '#sleep', new Date(2026, 7, 1, 23, 0)),
            mk('s2', '#sleep', new Date(2026, 7, 2, 23, 0)),
        ];
        expect(matchOnly(extractSleepRecords(entries))).toEqual(matchOnly(extractSleepRecordsLegacy(entries)));
    });

    it('기상만 있고 취침이 없는 경우', () => {
        const entries = [
            mk('w1', '#wake', new Date(2026, 7, 1, 6, 0)),
            mk('w2', '#wake', new Date(2026, 7, 2, 6, 0)),
        ];
        expect(matchOnly(extractSleepRecords(entries))).toEqual(matchOnly(extractSleepRecordsLegacy(entries)));
    });

    it('24시간을 넘긴 취침은 매칭하지 않는다', () => {
        const entries = [
            mk('s1', '#sleep', new Date(2026, 7, 1, 23, 0)),
            mk('w1', '#wake', new Date(2026, 7, 3, 6, 0)),   // 31시간 뒤
        ];
        const rs = extractSleepRecords(entries);
        expect(matchOnly(rs)).toEqual(matchOnly(extractSleepRecordsLegacy(entries)));
        expect(rs.find(r => r.wakeTime)?.sleepTime).toBeUndefined();
    });

    it('같은 밤에 취침이 두 번이면 더 가까운 쪽을 쓴다', () => {
        const entries = [
            mk('s1', '#sleep', new Date(2026, 7, 1, 22, 0)),
            mk('s2', '#sleep', new Date(2026, 7, 1, 23, 30)),
            mk('w1', '#wake', new Date(2026, 7, 2, 6, 0)),
        ];
        const rs = extractSleepRecords(entries);
        expect(matchOnly(rs)).toEqual(matchOnly(extractSleepRecordsLegacy(entries)));
        expect(rs.find(r => r.wakeTime)?.sleepTime?.getHours()).toBe(23);
    });

    it('큰 입력에서도 동일 (선형화 검증 대상 규모)', () => {
        const entries = randomEntries(2026, 1200);
        expect(matchOnly(extractSleepRecords(entries)))
            .toEqual(matchOnly(extractSleepRecordsLegacy(entries)));
    });
});
