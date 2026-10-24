import { describe, it, expect } from 'vitest';
import {
    todoLineKey, findTodoLine, setLineMinutes, addLineEid, splitForMove, appendLines,
    deferKey, collectDeferrals, deferralCount, removeDeferredTrace,
} from './todoLine';
import { parseTodos, calculateWeightedSummary } from './todoUtils';

describe('항목 열쇠', () => {
    it('체크 상태, 줄 끝 시간, 연결 표시를 빼고 비교한다', () => {
        expect(todoLineKey('- [x] 운동 (40m) {eid:abc}')).toBe(todoLineKey('- [ ] 운동'));
        expect(todoLineKey('- [x] 운동 (1h30m)')).toBe('운동');
    });

    it('들여쓰기는 남긴다', () => {
        expect(todoLineKey('  - [ ] 1')).toBe('  1');
        expect(todoLineKey('  - [ ] 1')).not.toBe(todoLineKey('- [ ] 1'));
    });

    it('이름 속 괄호는 건드리지 않는다', () => {
        expect(todoLineKey('- [ ] 메일 정리(업무 메일 확인)')).toBe('메일 정리(업무 메일 확인)');
    });
});

describe('체크한 줄 다시 찾기', () => {
    const lines = [
        '## 오늘',
        '- [x] 운동',
        '- [ ] +책 112쪽',
        '  - [x] 1',
        '  - [ ] 2',
    ];

    it('원래 자리에 그대로 있으면 그 자리', () => {
        expect(findTodoLine(lines, 1, '- [x] 운동')).toBe(1);
    });

    it('계획 시간이 실제 시간으로 바뀐 뒤에도 찾는다 (예전에는 여기서 연결 표시를 못 붙였다)', () => {
        const after = ['- [x] 공부 (90m)'];
        expect(findTodoLine(after, 0, '- [x] 공부 (60m)')).toBe(0);
    });

    it('위에 줄이 끼어 자리가 밀려도 찾는다', () => {
        const shifted = ['- [ ] 새로 넣은 일', ...lines];
        expect(findTodoLine(shifted, 1, '- [x] 운동')).toBe(2);
    });

    it('같은 이름이 여럿이면 원래 자리에서 가장 가까운 것', () => {
        const twice = ['- [ ] 가', '  - [x] 1', '- [ ] 나', '- [ ] 다', '- [ ] 라', '  - [x] 1'];
        expect(findTodoLine(['- [ ] 끼어듦', ...twice], 5, '  - [x] 1')).toBe(6);
    });

    it('거리가 같으면 아래쪽 (위에 한 줄 끼어 밀린 경우)', () => {
        const twice = ['- [ ] 가', '  - [x] 1', '- [ ] 나', '  - [x] 1'];
        expect(findTodoLine(['- [ ] 끼어듦', ...twice], 3, '  - [x] 1')).toBe(4);
    });

    it('제목 줄은 고르지 않는다', () => {
        expect(findTodoLine(['운동', '- [x] 운동'], 0, '- [x] 운동')).toBe(1);
    });

    it('없으면 -1', () => {
        expect(findTodoLine(lines, 1, '- [x] 없는 일')).toBe(-1);
    });
});

describe('걸린 시간 붙이기', () => {
    it('시간이 없으면 붙인다', () => {
        expect(setLineMinutes('- [x] 운동', 40)).toBe('- [x] 운동 (40m)');
    });

    it('계획 시간은 실제 시간으로 바꾼다 (시간 단위로 적은 것도)', () => {
        expect(setLineMinutes('- [x] 공부 (60m)', 90)).toBe('- [x] 공부 (90m)');
        expect(setLineMinutes('- [x] 공부(1h30m)', 75)).toBe('- [x] 공부 (75m)');
    });

    it('연결 표시는 맨 뒤에 둔다', () => {
        expect(setLineMinutes('- [x] 운동 (30m) {eid:abc}', 45)).toBe('- [x] 운동 (45m) {eid:abc}');
    });

    it('줄 끝 공백을 정리한다', () => {
        expect(setLineMinutes('- [x] 보고서 ', 30)).toBe('- [x] 보고서 (30m)');
    });

    it('하위 항목 들여쓰기는 그대로', () => {
        expect(setLineMinutes('  - [x] 1', 25)).toBe('  - [x] 1 (25m)');
    });
});

describe('연결 표시 붙이기', () => {
    it('맨 뒤에 붙인다', () => {
        expect(addLineEid('- [x] 운동 (40m)', 'e1')).toBe('- [x] 운동 (40m) {eid:e1}');
    });

    it('이미 있으면 그대로', () => {
        expect(addLineEid('- [x] 운동 (40m) {eid:e1}', 'e1')).toBe('- [x] 운동 (40m) {eid:e1}');
    });
});

describe('다른 날로 옮기기', () => {
    const day = [
        '## 오늘',
        '- [x] 아침 정리 (20m)',
        '- [ ] 운동',
        '- [ ] 보고서',
        '  - [x] 자료 모으기 (30m) {eid:e1}',
        '  - [ ] 초안 쓰기',
        '    - [ ] 결론',
        '- [ ] 책 읽기',
    ].join('\n');

    it('하위 항목이 없으면 그 줄만 옮기고 이 날에서는 뺀다', () => {
        const r = splitForMove(day, 2)!;
        expect(r.moved).toEqual(['- [ ] 운동']);
        expect(r.keptDone).toBe(false);
        expect(r.remaining.split('\n')).not.toContain('- [ ] 운동');
        expect(r.remaining.split('\n')).toContain('- [ ] 책 읽기');
    });

    it('끝낸 하위 항목은 이 날에 남기고, 안 끝낸 것만 데려간다', () => {
        const r = splitForMove(day, 3)!;
        expect(r.moved).toEqual(['- [ ] 보고서', '  - [ ] 초안 쓰기', '    - [ ] 결론']);
        expect(r.keptDone).toBe(true);
        expect(r.remaining.split('\n').slice(3, 6)).toEqual([
            '- [ ] 보고서',
            '  - [x] 자료 모으기 (30m) {eid:e1}',
            '- [ ] 책 읽기',
        ]);
    });

    it('하위 항목을 따로 옮기면 맨 앞으로 끌어올린다', () => {
        const r = splitForMove(day, 5)!;
        expect(r.moved).toEqual(['- [ ] 초안 쓰기', '  - [ ] 결론']);
    });

    it("옮겨 가면 그날의 계획이 되므로 '추가(+)' 표시를 뗀다", () => {
        expect(splitForMove('- [ ] +급한 일', 0)!.moved).toEqual(['- [ ] 급한 일']);
    });

    it('빈 줄에서 묶음이 끝난다', () => {
        const r = splitForMove(['- [ ] 가', '', '  - [ ] 다음 묶음처럼 보이는 줄'].join('\n'), 0)!;
        expect(r.moved).toEqual(['- [ ] 가']);
    });

    it('끝낸 항목이나 항목이 아닌 줄은 옮기지 않는다', () => {
        expect(splitForMove(day, 1)).toBeNull();
        expect(splitForMove(day, 0)).toBeNull();
        expect(splitForMove(day, 99)).toBeNull();
    });

    it('받는 날 끝에 덧붙인다', () => {
        expect(appendLines('', ['- [ ] 운동'])).toBe('- [ ] 운동');
        expect(appendLines('- [ ] 가', ['- [ ] 나', '  - [ ] 다'])).toBe('- [ ] 가\n- [ ] 나\n  - [ ] 다');
        expect(appendLines('- [ ] 가\n', ['- [ ] 나'])).toBe('- [ ] 가\n- [ ] 나');
    });
});

describe('이미 시작한 날에서 옮기면 미룸 흔적을 남긴다', () => {
    const today = [
        '- [x] 강의 (60m)',
        '- [ ] 뉴스레터 (60m)',
        '- [ ] 보고서',
        '  - [x] 자료 모으기 (30m)',
        '  - [ ] 초안 쓰기',
    ].join('\n');

    it('지우지 않고 [>] 줄로 바꾸고 받는 날을 적는다', () => {
        const r = splitForMove(today, 1, '2026-10-25')!;
        expect(r.remaining.split('\n')[1]).toBe('- [>] 뉴스레터 (60m) {moved:2026-10-25}');
        expect(r.moved).toEqual(['- [ ] 뉴스레터 (60m)']);
    });

    it('함께 가는 하위 항목도 흔적으로 남고, 끝낸 것은 그대로', () => {
        const r = splitForMove(today, 2, '2026-10-25')!;
        expect(r.remaining.split('\n').slice(2)).toEqual([
            '- [>] 보고서 {moved:2026-10-25}',
            '  - [x] 자료 모으기 (30m)',
            '  - [>] 초안 쓰기',
        ]);
        expect(r.moved).toEqual(['- [ ] 보고서', '  - [ ] 초안 쓰기']);
        expect(r.keptDone).toBe(true);
    });

    it('옮겨도 그날 달성률은 그대로다', () => {
        const before = calculateWeightedSummary(parseTodos(today));
        const after = calculateWeightedSummary(parseTodos(splitForMove(today, 1, '2026-10-25')!.remaining));
        expect(after).toEqual(before);
    });

    it('흔적은 미룬 항목으로 읽힌다 (받은 곳은 머리 줄에만)', () => {
        const items = parseTodos(splitForMove(today, 2, 'backlog')!.remaining);
        expect(items[2]).toMatchObject({ text: '보고서', deferred: true, deferredTo: 'backlog', checked: false });
        expect(items[4]).toMatchObject({ text: '초안 쓰기', deferred: true });
        expect(items[4].deferredTo).toBeUndefined();
    });
});

describe('미룬 횟수', () => {
    const days = [
        { date: '2026-10-22', content: '- [>] 뉴스레터 (60m) {moved:2026-10-23}' },
        { date: '2026-10-23', content: '- [x] 강의\n- [>] 뉴스레터 (60m) {moved:2026-10-24}' },
        { date: '2026-10-24', content: '- [>] **뉴스레터**  {moved:2026-10-25}\n- [>] 보고서 {moved:backlog}' },
    ];
    const index = collectDeferrals(days);

    it('보낸 날을 거슬러 올라가며 센다', () => {
        expect(deferralCount(index, '2026-10-25', deferKey('- [ ] 뉴스레터 (60m)'))).toBe(3);
        expect(deferralCount(index, '2026-10-24', deferKey('- [ ] 뉴스레터'))).toBe(2);
    });

    it('한 번도 안 미룬 항목은 0', () => {
        expect(deferralCount(index, '2026-10-25', deferKey('- [ ] 강의'))).toBe(0);
    });

    it('이름의 시간·굵게·공백 차이는 같은 항목으로 본다', () => {
        expect(deferKey('- [>] **뉴스레터**  {moved:2026-10-25}')).toBe(deferKey('- [ ] 뉴스레터 (60m)'));
    });

    it('흔적이 엉켜 돌아도 멈춘다', () => {
        const loop = collectDeferrals([
            { date: '2026-10-01', content: '- [>] 가 {moved:2026-10-02}' },
            { date: '2026-10-02', content: '- [>] 가 {moved:2026-10-01}' },
        ]);
        expect(deferralCount(loop, '2026-10-02', deferKey('- [ ] 가'))).toBe(2);
    });
});

describe('미룸 흔적 지우기', () => {
    it('하위 항목이 없으면 그 줄을 지운다 (그날 계획에서도 빠진다)', () => {
        const day = '- [x] 강의\n- [>] 뉴스레터 {moved:2026-10-25}\n- [ ] 책';
        expect(removeDeferredTrace(day, 1)).toBe('- [x] 강의\n- [ ] 책');
    });

    it('끝낸 하위 항목은 남기고 머리 줄은 끝낸 것으로 둔다', () => {
        const day = [
            '- [>] 보고서 {moved:2026-10-25}',
            '  - [x] 자료 모으기 (30m)',
            '  - [>] 초안 쓰기',
            '- [ ] 책',
        ].join('\n');
        expect(removeDeferredTrace(day, 0)).toBe('- [x] 보고서\n  - [x] 자료 모으기 (30m)\n- [ ] 책');
    });

    it('흔적 줄이 아니면 null', () => {
        expect(removeDeferredTrace('- [ ] 책', 0)).toBeNull();
    });
});
