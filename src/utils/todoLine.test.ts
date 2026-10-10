import { describe, it, expect } from 'vitest';
import { todoLineKey, findTodoLine, setLineMinutes, addLineEid } from './todoLine';

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
