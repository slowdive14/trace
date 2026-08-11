import { describe, it, expect } from 'vitest';
import { isSameDay } from 'date-fns';

/**
 * InputBar의 날짜 선택 → 저장 경로에서 쓰는 규칙.
 * 날짜 입력값이 비거나 부분 입력이면 Invalid Date가 되는데, 예전에는 그대로 통과해
 * 사진을 전부 올린 뒤 마지막 저장에서 Timestamp 변환이 실패했다.
 */
const parsePickedDate = (value: string): Date | null => {
    // 부분 입력('2026-05')은 Invalid이 아니라 5월 1일로 조용히 해석되므로 형식부터 확인한다
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const d = new Date(`${value}T12:00:00`);
    return isNaN(d.getTime()) ? null : d;
};

const resolveEntryDate = (selected: Date | null, now: Date): Date | undefined => {
    const valid = selected && !isNaN(selected.getTime()) ? selected : null;
    const today = valid && isSameDay(valid, now);
    return (valid && !today) ? valid : undefined;
};

const NOW = new Date(2026, 7, 10, 15);

describe('날짜 선택 파싱', () => {
    it('정상 날짜는 정오로 파싱한다 (5시 경계 때문에)', () => {
        const d = parsePickedDate('2026-05-03')!;
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(4);
        expect(d.getDate()).toBe(3);
        expect(d.getHours()).toBe(12);
    });

    it('빈 값은 거부한다', () => {
        expect(parsePickedDate('')).toBeNull();
    });

    it('부분 입력은 거부한다 (조용히 다른 날짜로 해석되는 걸 막는다)', () => {
        // new Date('2026-05T12:00:00') 은 Invalid이 아니라 5월 1일이 된다
        expect(new Date('2026-05T12:00:00').getDate()).toBe(1);
        expect(parsePickedDate('2026-05')).toBeNull();
        expect(parsePickedDate('2026')).toBeNull();
    });

    it('형식이 아닌 값은 거부한다', () => {
        expect(parsePickedDate('abc')).toBeNull();
        expect(parsePickedDate('2026/05/03')).toBeNull();
    });
});

describe('저장할 날짜 결정', () => {
    it('몇 달 전 날짜는 그대로 쓴다', () => {
        const past = parsePickedDate('2026-05-03')!;
        expect(resolveEntryDate(past, NOW)).toBe(past);
    });

    it('오늘을 고르면 undefined (지금 시각을 쓴다)', () => {
        const today = parsePickedDate('2026-08-10')!;
        expect(resolveEntryDate(today, NOW)).toBeUndefined();
    });

    it('선택 없음이면 undefined', () => {
        expect(resolveEntryDate(null, NOW)).toBeUndefined();
    });

    it('Invalid Date는 통과시키지 않는다 (회귀 방지)', () => {
        // isSameDay(Invalid, now)가 false라서 예전에는 그대로 통과했다
        const invalid = new Date('T12:00:00');
        expect(isNaN(invalid.getTime())).toBe(true);
        expect(isSameDay(invalid, NOW)).toBe(false);      // 통과해 버리던 원인
        expect(resolveEntryDate(invalid, NOW)).toBeUndefined();
    });
});
