import { describe, it, expect } from 'vitest';
import { toTogglRows, logicalDateOf, entryName, keepKnownRows, type TogglEntry } from './toggl';
import { taskBase } from '../src/utils/taskEstimate';

/** 로컬 시각으로 만든 시작 시각 (테스트가 시간대에 따라 흔들리지 않게) */
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString();
const e = (over: Partial<TogglEntry>): TogglEntry => ({ start: at(2026, 10, 6, 10), duration: 1800, description: '혼공머신', ...over });

describe('논리적 날짜', () => {
    it('새벽 5시 전은 전날이다', () => {
        expect(logicalDateOf(new Date(2026, 9, 7, 3, 0))).toBe('2026-10-06');
        expect(logicalDateOf(new Date(2026, 9, 7, 5, 0))).toBe('2026-10-07');
    });
});

describe('기록 이름', () => {
    it('설명을 먼저, 없으면 할 일 이름', () => {
        expect(entryName({ description: ' 혼공머신 ' })).toBe('혼공머신');
        expect(entryName({ description: '', task: { name: '방송대 강의' } })).toBe('방송대 강의');
    });

    it('할 일 이름이 숫자뿐이면 상위 할 일 이름을 붙인다', () => {
        expect(entryName({ task: { name: '1', parent_task_name: '보고서' } })).toBe('보고서 1');
    });
});

describe('하루·이름·프로젝트별로 합치기', () => {
    it('같은 날 끊어 잰 것은 합친다', () => {
        const rows = toTogglRows([
            e({ start: at(2026, 10, 6, 10), duration: 1800 }),
            e({ start: at(2026, 10, 6, 21), duration: 2700 }),
        ]);
        expect(rows).toEqual([{ d: '2026-10-06', t: '혼공머신', m: 75 }]);
    });

    it('새벽에 이어서 한 것은 전날 몫이다', () => {
        const rows = toTogglRows([
            e({ start: at(2026, 10, 6, 23), duration: 1800 }),
            e({ start: at(2026, 10, 7, 1), duration: 1200 }),
        ]);
        expect(rows).toEqual([{ d: '2026-10-06', t: '혼공머신', m: 50 }]);
    });

    it('프로젝트 이름을 붙인다 (기록에 없으면 할 일의 프로젝트)', () => {
        const rows = toTogglRows([
            e({ project: { name: '공부' } }),
            e({ description: '3장', start: at(2026, 10, 6, 14), task: { name: '3장', project: { name: '방송대' } } }),
        ]);
        expect(rows).toEqual([
            { d: '2026-10-06', t: '3장', p: '방송대', m: 30 },
            { d: '2026-10-06', t: '혼공머신', p: '공부', m: 30 },
        ]);
    });

    it('설명이 없으면 할 일 이름으로 묶는다', () => {
        const rows = toTogglRows([e({ description: '', task: { name: '방송대 강의' } })]);
        expect(rows).toEqual([{ d: '2026-10-06', t: '방송대 강의', m: 30 }]);
    });

    it('실행 중·계획만·지운·휴식·1분 미만 기록은 뺀다', () => {
        const rows = toTogglRows([
            e({ duration: undefined }),
            e({ start: undefined }),
            e({ deleted_at: '2026-10-06T12:00:00Z' }),
            e({ type: 'break' }),
            e({ duration: 30 }),
        ]);
        expect(rows).toEqual([]);
    });
});

describe('할 일에 적어 본 이름만 남기기', () => {
    const known = new Set(['혼공머신', '방송대과제'].map(taskBase));

    it('할 일과 맞는 이름은 그대로 둔다', () => {
        expect(keepKnownRows([{ d: '2026-10-06', t: '혼공머신', m: 70 }], known))
            .toEqual([{ d: '2026-10-06', t: '혼공머신', m: 70 }]);
    });

    it('할 일에 없는 이름(내담자 실명 등)은 버린다', () => {
        expect(keepKnownRows([{ d: '2026-10-06', t: '홍길동', p: '상담센터', m: 50 }], known)).toEqual([]);
    });

    it('프로젝트만 할 일과 맞으면 이름을 지우고 프로젝트별 시간만 남긴다', () => {
        const rows = keepKnownRows([
            { d: '2026-10-06', t: '홍길동', p: '방송대 과제', m: 30 },
            { d: '2026-10-06', t: '김철수', p: '방송대 과제', m: 20 },
        ], known);
        expect(rows).toEqual([{ d: '2026-10-06', t: '', p: '방송대 과제', m: 50 }]);
    });

    it('이름이 맞고 프로젝트는 모르면 프로젝트를 뗀다', () => {
        expect(keepKnownRows([{ d: '2026-10-06', t: '혼공머신', p: '모르는 프로젝트', m: 40 }], known))
            .toEqual([{ d: '2026-10-06', t: '혼공머신', m: 40 }]);
    });
});
