import { describe, it, expect } from 'vitest';
import {
    missDirection, describeGap, recordTextFromLine, missRecordId, summarizeReasons, reasonLabel,
    MISS_REASONS, type MissRecord,
} from './missReasons';

describe('크게 어긋났는지', () => {
    it('예상보다 50% 넘게, 그리고 10분 넘게 더 걸리면 "넘침"', () => {
        expect(missDirection({ minutes: 60, kind: 'estimate' }, 100)).toBe('over');
    });

    it('예상보다 50% 넘게, 그리고 10분 넘게 덜 걸리면 "덜 걸림"', () => {
        expect(missDirection({ minutes: 60, kind: 'plan' }, 20)).toBe('under');
    });

    it('50% 안쪽이면 묻지 않는다 (날마다 다른 건 일의 성질이다)', () => {
        expect(missDirection({ minutes: 60, kind: 'estimate' }, 85)).toBeNull();
        expect(missDirection({ minutes: 60, kind: 'estimate' }, 35)).toBeNull();
    });

    it('짧은 일은 비율이 커도 10분 안쪽이면 묻지 않는다', () => {
        expect(missDirection({ minutes: 10, kind: 'estimate' }, 18)).toBeNull();
    });

    it('범위가 보였고 실제가 그 안이면 어긋난 게 아니다', () => {
        expect(missDirection({ minutes: 40, low: 30, high: 70, kind: 'estimate' }, 65)).toBeNull();
    });

    it('범위 밖이면 중간값과 견준다', () => {
        expect(missDirection({ minutes: 40, low: 30, high: 70, kind: 'estimate' }, 90)).toBe('over');
    });

    it('예상이나 실제가 비정상이면 묻지 않는다', () => {
        expect(missDirection({ minutes: 0, kind: 'estimate' }, 30)).toBeNull();
        expect(missDirection({ minutes: 30, kind: 'estimate' }, 0)).toBeNull();
    });
});

describe('문구와 이름', () => {
    it('차이를 문구로', () => {
        expect(describeGap(60, 100)).toBe('예상 1h → 실제 1h40m · 40m 더 걸렸어요 (+67%)');
        expect(describeGap(60, 20)).toBe('예상 1h → 실제 20m · 40m 덜 걸렸어요 (−67%)');
    });

    it('할 일 한 줄에서 이름만 꺼낸다', () => {
        expect(recordTextFromLine('- [x] 넥서스 82쪽 (130m) {eid:abc}')).toBe('넥서스 82쪽');
        expect(recordTextFromLine('  - [x] +갑자기 온 상담 (60m)')).toBe('갑자기 온 상담');
    });

    it('같은 날 같은 일은 같은 문서 ID (다시 답하면 덮어쓴다)', () => {
        expect(missRecordId('2026-10-08', '보고서 1')).toBe(missRecordId('2026-10-08', '보고서1'));
        expect(missRecordId('2026-10-08', '보고서 1')).not.toBe(missRecordId('2026-10-09', '보고서 1'));
        expect(missRecordId('2026-10-08', 'a/b')).not.toContain('/');
    });

    it('이유 id를 이름으로', () => {
        expect(reasonLabel('interrupted')).toBe('방해받음');
        expect(reasonLabel('easy')).toBe('생각보다 쉬움');
        expect(MISS_REASONS.over.map(r => r.label)).toContain('몰입해서 더 함');
    });
});

describe('이유 모아 보기', () => {
    const rec = (reason: string, at: number, direction: 'over' | 'under' = 'over'): MissRecord => ({
        date: '2026-10-01', text: `일 ${at}`, expected: 60, actual: direction === 'over' ? 120 : 20,
        kind: 'estimate', direction, reason, at,
    });

    it('3번이 안 되면 패턴이라 하기 어려워 보여 주지 않는다', () => {
        expect(summarizeReasons([rec('interrupted', 1), rec('scope', 2)], 'over')).toBeNull();
    });

    it('많은 순으로 센다 (같은 수면 최근에 나온 이유가 앞)', () => {
        const s = summarizeReasons([
            rec('interrupted', 1), rec('scope', 2), rec('interrupted', 3), rec('interrupted', 4), rec('flow', 5),
            rec('easy', 6, 'under'),
        ], 'over');
        expect(s).toEqual({
            total: 5,
            reasons: [
                { id: 'interrupted', label: '방해받음', count: 3 },
                { id: 'flow', label: '몰입해서 더 함', count: 1 },
                { id: 'scope', label: '범위가 커짐', count: 1 },
            ],
        });
    });

    it('최근 20번만 본다', () => {
        const old = Array.from({ length: 10 }, (_, i) => rec('scope', i));
        const recent = Array.from({ length: 20 }, (_, i) => rec('interrupted', 100 + i));
        const s = summarizeReasons([...old, ...recent], 'over')!;
        expect(s.total).toBe(20);
        expect(s.reasons).toEqual([{ id: 'interrupted', label: '방해받음', count: 20 }]);
    });
});
