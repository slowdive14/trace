import { describe, it, expect } from 'vitest';
import type { RecurringTodo } from '../types/types';
import {
    isRepeatDueOn,
    getDueRepeats,
    describeRepeat,
    nthWeekdayOfMonth,
    weeksBetween,
    appendTodoLine,
    appendTodoLines,
    parseBacklog,
    formatBacklog,
    removeBacklogItem,
    parseBacklogLine,
    setBacklogDue,
    sortBacklog,
    daysUntil,
    describeDue,
    countDueSoon,
    formatDayLabel,
} from './todoRepeat';

const rule = (over: Partial<RecurringTodo> = {}): RecurringTodo => ({
    id: 'r1',
    text: '뉴스레터 초안 (90m)',
    kind: 'weekly',
    weekday: 1,           // 월요일
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
});

// 2026-09-21은 월요일, 09-22는 화요일
describe('매주', () => {
    it('그 요일에만 들어간다', () => {
        expect(isRepeatDueOn(rule(), '2026-09-21')).toBe(true);
        expect(isRepeatDueOn(rule(), '2026-09-22')).toBe(false);
    });

    it('다음 주 같은 요일에도 들어간다', () => {
        expect(isRepeatDueOn(rule(), '2026-09-28')).toBe(true);
    });

    it('꺼 두면 들어가지 않는다', () => {
        expect(isRepeatDueOn(rule({ active: false }), '2026-09-21')).toBe(false);
    });
});

describe('격주', () => {
    const biweekly = rule({ kind: 'biweekly', anchorDate: '2026-09-21' });

    it('기준 주에는 들어간다', () => {
        expect(isRepeatDueOn(biweekly, '2026-09-21')).toBe(true);
    });

    it('한 주 뒤는 건너뛴다', () => {
        expect(isRepeatDueOn(biweekly, '2026-09-28')).toBe(false);
    });

    it('두 주 뒤에 다시 들어간다', () => {
        expect(isRepeatDueOn(biweekly, '2026-10-05')).toBe(true);
        expect(isRepeatDueOn(biweekly, '2026-10-12')).toBe(false);
        expect(isRepeatDueOn(biweekly, '2026-10-19')).toBe(true);
    });

    it('기준일보다 앞선 날짜에는 넣지 않는다', () => {
        expect(isRepeatDueOn(biweekly, '2026-09-14')).toBe(false);
    });

    it('기준일이 없으면 매주로 떨어지지 않고 건너뛴다', () => {
        expect(isRepeatDueOn(rule({ kind: 'biweekly' }), '2026-09-21')).toBe(false);
    });
});

describe('매월 N번째 요일', () => {
    // 2026년 9월의 수요일: 2일(1번째), 9일(2번째), 16일(3번째), 23일(4번째), 30일(5번째)
    const podcast = rule({ kind: 'monthlyNth', weekday: 3, nth: 2, text: '팟캐스트 녹음' });

    it('그 달의 N번째 그 요일에만 들어간다', () => {
        expect(isRepeatDueOn(podcast, '2026-09-09')).toBe(true);
        expect(isRepeatDueOn(podcast, '2026-09-02')).toBe(false);
        expect(isRepeatDueOn(podcast, '2026-09-16')).toBe(false);
    });

    it('달이 바뀌면 그 달 기준으로 다시 센다', () => {
        // 2026년 10월의 수요일: 7일(1번째), 14일(2번째)
        expect(isRepeatDueOn(podcast, '2026-10-14')).toBe(true);
        expect(isRepeatDueOn(podcast, '2026-10-07')).toBe(false);
    });

    it('nthWeekdayOfMonth는 1일부터 7일씩 끊어 센다', () => {
        expect(nthWeekdayOfMonth('2026-09-02')).toBe(1);
        expect(nthWeekdayOfMonth('2026-09-09')).toBe(2);
        expect(nthWeekdayOfMonth('2026-09-30')).toBe(5);
    });
});

describe('weeksBetween — 월요일 기준', () => {
    it('같은 주면 0', () => {
        expect(weeksBetween('2026-09-21', '2026-09-27')).toBe(0);   // 월~일
    });

    it('일요일은 그 주에 속한다', () => {
        expect(weeksBetween('2026-09-21', '2026-09-28')).toBe(1);   // 다음 주 월요일
    });

    it('거슬러 가면 음수', () => {
        expect(weeksBetween('2026-09-21', '2026-09-14')).toBe(-1);
    });
});

describe('getDueRepeats', () => {
    const rules = [
        rule({ id: 'a', weekday: 1, text: '뉴스레터' }),
        rule({ id: 'b', weekday: 1, text: '주간 회고' }),
        rule({ id: 'c', weekday: 3, text: '팟캐스트' }),
    ];

    it('그날 해당하는 것만 고른다', () => {
        expect(getDueRepeats(rules, '2026-09-21').map(r => r.id)).toEqual(['a', 'b']);
    });

    it('이미 넣은 것은 빼고 준다 (지운 항목이 되살아나지 않게)', () => {
        expect(getDueRepeats(rules, '2026-09-21', ['a']).map(r => r.id)).toEqual(['b']);
    });
});

describe('describeRepeat', () => {
    it('사람이 읽을 문구로 바꾼다', () => {
        expect(describeRepeat(rule())).toBe('매주 월요일');
        expect(describeRepeat(rule({ kind: 'biweekly' }))).toBe('격주 월요일');
        expect(describeRepeat(rule({ kind: 'monthlyNth', weekday: 3, nth: 2 }))).toBe('매월 2번째 수요일');
    });
});

describe('목록에 줄 넣기', () => {
    it('빈 본문에도 넣는다', () => {
        expect(appendTodoLine('', '팟캐스트')).toBe('- [ ] 팟캐스트');
    });

    it('끝 개행이 있든 없든 줄이 겹치지 않는다', () => {
        expect(appendTodoLine('- [x] 달리기', '팟캐스트')).toBe('- [x] 달리기\n- [ ] 팟캐스트');
        expect(appendTodoLine('- [x] 달리기\n', '팟캐스트')).toBe('- [x] 달리기\n- [ ] 팟캐스트');
    });

    it('여러 개를 순서대로 넣는다', () => {
        expect(appendTodoLines('- [x] 달리기', ['A', 'B'])).toBe('- [x] 달리기\n- [ ] A\n- [ ] B');
    });
});

describe('대기 목록', () => {
    it('저장 형식과 목록을 오간다', () => {
        const items = [{ text: '팟캐스트 대본 초안' }, { text: '이산수학 8강 복습' }];
        expect(parseBacklog(formatBacklog(items))).toEqual(items);
    });

    it('빈 줄은 버린다', () => {
        expect(parseBacklog('- [ ] A\n\n- [ ] B\n')).toEqual([{ text: 'A' }, { text: 'B' }]);
    });

    it('체크 표시가 있어도 문구만 남긴다', () => {
        expect(parseBacklog('- [x] 이미 한 일')).toEqual([{ text: '이미 한 일' }]);
    });

    it('한 줄 빼기', () => {
        const items = [{ text: 'A' }, { text: 'B' }, { text: 'C' }];
        expect(removeBacklogItem(items, 1)).toEqual([{ text: 'A' }, { text: 'C' }]);
    });
});

describe('대기 항목의 예정일', () => {
    it('본문 끝의 ~날짜를 떼어 낸다', () => {
        expect(parseBacklogLine('- [ ] 팟캐스트 대본 (120m) ~2026-09-25'))
            .toEqual({ text: '팟캐스트 대본 (120m)', due: '2026-09-25' });
    });

    it('예정일이 없으면 본문만', () => {
        expect(parseBacklogLine('- [ ] 그냥 할 일')).toEqual({ text: '그냥 할 일' });
    });

    it('저장 형식과 왕복해도 그대로다', () => {
        const items = [{ text: 'A', due: '2026-09-25' }, { text: 'B' }];
        expect(parseBacklog(formatBacklog(items))).toEqual(items);
    });

    it('본문 가운데의 ~숫자는 예정일로 보지 않는다', () => {
        expect(parseBacklogLine('- [ ] 3~4장 읽기')).toEqual({ text: '3~4장 읽기' });
    });

    it('예정일을 붙이고 지운다', () => {
        const items = [{ text: 'A' }, { text: 'B', due: '2026-09-30' }];
        expect(setBacklogDue(items, 0, '2026-09-25')[0]).toEqual({ text: 'A', due: '2026-09-25' });
        expect(setBacklogDue(items, 1, undefined)[1]).toEqual({ text: 'B' });
    });

    it('빠른 날짜부터, 안 정한 것은 뒤로 보낸다', () => {
        const items = [
            { text: '나중' },
            { text: '10월', due: '2026-10-01' },
            { text: '내일', due: '2026-09-23' },
            { text: '아직' },
        ];
        expect(sortBacklog(items).map(i => i.text)).toEqual(['내일', '10월', '나중', '아직']);
    });

    it('남은 날짜를 센다', () => {
        expect(daysUntil('2026-09-25', '2026-09-22')).toBe(3);
        expect(daysUntil('2026-09-20', '2026-09-22')).toBe(-2);
        expect(daysUntil('2026-10-01', '2026-09-30')).toBe(1);   // 월 경계
    });

    it('사람이 읽을 문구로 바꾼다', () => {
        expect(describeDue('2026-09-22', '2026-09-22')).toBe('오늘');
        expect(describeDue('2026-09-23', '2026-09-22')).toBe('내일');
        expect(describeDue('2026-09-24', '2026-09-22')).toBe('모레');
        expect(describeDue('2026-09-27', '2026-09-22')).toBe('5일 뒤');
        expect(describeDue('2026-09-21', '2026-09-22')).toBe('어제');
        expect(describeDue('2026-09-19', '2026-09-22')).toBe('3일 지남');
    });

    it('오늘까지 온 것만 센다 (접어 둔 채로도 보이게)', () => {
        const items = [
            { text: '지남', due: '2026-09-20' },
            { text: '오늘', due: '2026-09-22' },
            { text: '내일', due: '2026-09-23' },
            { text: '미정' },
        ];
        expect(countDueSoon(items, '2026-09-22')).toBe(2);
    });
});

describe('formatDayLabel — 날짜에 요일을 함께', () => {
    it('M/d(요일) 로 적는다', () => {
        // 2026-09-24는 목요일
        expect(formatDayLabel(new Date(2026, 8, 24, 12))).toBe('9/24(목)');
        expect(formatDayLabel(new Date(2026, 8, 26, 12))).toBe('9/26(토)');
        expect(formatDayLabel(new Date(2026, 8, 27, 12))).toBe('9/27(일)');
    });

    it('한 자리 월·일도 그대로 쓴다 (0을 붙이지 않는다)', () => {
        expect(formatDayLabel(new Date(2026, 0, 5, 12))).toBe('1/5(월)');
    });

    it('일곱 요일이 한 바퀴 돈다', () => {
        const labels = Array.from({ length: 7 }, (_, i) => formatDayLabel(new Date(2026, 8, 21 + i, 12)));
        expect(labels.map(l => l.slice(-2, -1))).toEqual(['월', '화', '수', '목', '금', '토', '일']);
    });
});
