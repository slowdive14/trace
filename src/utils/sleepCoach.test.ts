import { describe, it, expect } from 'vitest';
import { calculateSleepScore, type SleepRecord } from './sleepUtils';
import { analyzeSleepGaps, formatDiagnosisForPrompt, getWeekPlanDays } from './sleepCoach';

/** YYYY-MM-DD 하루치 기록 만들기 */
const rec = (date: string, sleep: string, wake: string, napMin = 0): SleepRecord => {
    const [sh, sm] = sleep.split(':').map(Number);
    const [wh, wm] = wake.split(':').map(Number);
    const [y, m, d] = date.split('-').map(Number);

    // 취침이 22시 이후면 전날 밤, 자정 이후면 당일 새벽
    const sleepTime = new Date(y, m - 1, sh >= 12 ? d - 1 : d, sh, sm);
    const wakeTime = new Date(y, m - 1, d, wh, wm);
    const duration = Math.round((wakeTime.getTime() - sleepTime.getTime()) / 60000);

    return {
        date, sleepTime, wakeTime, duration,
        napDuration: napMin,
        totalDuration: duration + napMin,
    };
};

const week = (sleep: string, wake: string, napMin = 0) =>
    ['2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10']
        .map(d => rec(d, sleep, wake, napMin));

describe('analyzeSleepGaps — 배점 분해', () => {
    it('모든 항목을 배점대로 분해한다 (합 100)', () => {
        const records = week('23:00', '06:30');
        const diag = analyzeSleepGaps(calculateSleepScore(records), records);
        expect(diag.gaps.map(g => g.max)).toEqual([40, 18, 18, 12, 12]);
        expect(diag.gaps.reduce((s, g) => s + g.max, 0)).toBe(100);
    });

    it('이상적인 주는 잃은 점수가 없다', () => {
        // 23:00 취침 · 06:30 기상 = 7.5시간, 목표 구간 안, 편차 0
        const records = week('23:00', '06:30');
        const score = calculateSleepScore(records);
        const diag = analyzeSleepGaps(score, records);
        expect(score.total).toBe(100);
        expect(diag.biggest).toBeNull();
    });

    it('가장 크게 되찾을 항목을 고른다', () => {
        // 02:00 취침 · 06:30 기상 = 4.5시간 (수면시간 크게 부족 + 취침목표 실패)
        const records = week('02:00', '06:30');
        const diag = analyzeSleepGaps(calculateSleepScore(records), records);
        expect(diag.biggest?.key).toBe('duration');
    });
});

describe('개선 지침이 실제 점수와 맞는가 (왕복 검증)', () => {
    it('"30분 더 자면 +4점" 이 실제로 성립한다', () => {
        const before = week('00:00', '06:00');          // 6시간
        const after = week('23:30', '06:00');           // 6.5시간 (30분 더)
        const sBefore = calculateSleepScore(before);
        const sAfter = calculateSleepScore(after);

        const diag = analyzeSleepGaps(sBefore, before);
        const durationGap = diag.gaps.find(g => g.key === 'duration')!;
        expect(durationGap.lever).toContain('+4점');    // 0.5시간 × 8점

        // 실제 점수도 4점 오른다
        expect(sAfter.durationScore - sBefore.durationScore).toBe(4);
    });

    it('"7.5시간을 채우면 이 항목 만점" 이 실제로 성립한다', () => {
        const before = week('00:30', '06:00');          // 5.5시간
        const diag = analyzeSleepGaps(calculateSleepScore(before), before);
        const gap = diag.gaps.find(g => g.key === 'duration')!;
        expect(gap.lever).toContain(`+${Math.round(gap.lost)}점`);

        const after = week('22:30', '06:00');           // 7.5시간
        expect(calculateSleepScore(after).durationScore).toBe(40);
    });

    it('취침 목표: "하루 더 지킬 때마다" 점수가 그만큼 오른다', () => {
        // 7일 중 3일만 목표 구간(22:00~00:30) 안
        const bad = ['2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'].map(d => rec(d, '01:30', '07:00'));
        const good = ['2026-08-08', '2026-08-09', '2026-08-10'].map(d => rec(d, '23:00', '07:00'));
        const records = [...bad, ...good];

        const score = calculateSleepScore(records);
        const diag = analyzeSleepGaps(score, records);
        const gap = diag.gaps.find(g => g.key === 'sleepGoal')!;

        expect(gap.reason).toContain('7일 중 3일');
        expect(gap.lever).toContain('+2.6점');   // 18/7 = 2.57

        // 하루를 더 지키면 실제로 약 2.6점 오른다
        const oneMore = [...bad.slice(1), rec('2026-08-04', '23:00', '07:00'), ...good];
        const after = calculateSleepScore(oneMore);
        expect(after.sleepRegularity - score.sleepRegularity).toBeGreaterThanOrEqual(2);
        expect(after.sleepRegularity - score.sleepRegularity).toBeLessThanOrEqual(3);
    });

    it('일관성: 편차 6분마다 1점이 실제로 성립한다', () => {
        // 취침 시각이 하루씩 흔들리는 주
        const records = [
            rec('2026-08-04', '23:00', '06:30'),
            rec('2026-08-05', '23:30', '06:30'),
            rec('2026-08-06', '23:00', '06:30'),
            rec('2026-08-07', '23:30', '06:30'),
            rec('2026-08-08', '23:00', '06:30'),
            rec('2026-08-09', '23:30', '06:30'),
            rec('2026-08-10', '23:00', '06:30'),
        ];
        const score = calculateSleepScore(records);
        const diag = analyzeSleepGaps(score, records);
        const gap = diag.gaps.find(g => g.key === 'sleepConsistency')!;

        // MAD ≈ 15분 → 12 - 15/6 = 9.5 → 10점
        expect(score.sleepConsistencyScore).toBe(10);
        expect(gap.reason).toContain('분씩 흔들림');

        // 편차를 없애면 만점
        expect(calculateSleepScore(week('23:00', '06:30')).sleepConsistencyScore).toBe(12);
    });

    it('과수면은 시간당 4점만 깎인다고 알린다', () => {
        const records = week('22:00', '07:30');          // 9.5시간 (+2시간)
        const diag = analyzeSleepGaps(calculateSleepScore(records), records);
        const gap = diag.gaps.find(g => g.key === 'duration')!;
        expect(gap.reason).toContain('많음');
        expect(gap.reason).toContain('4점');
        expect(calculateSleepScore(records).durationScore).toBe(32);   // 40 - 2*4
    });
});

describe('낮잠·기록 누락 처리', () => {
    it('낮잠 평균을 따로 알린다 (수면시간에 합산되므로)', () => {
        const records = week('00:00', '06:00', 30);
        const diag = analyzeSleepGaps(calculateSleepScore(records), records);
        expect(diag.avgNapMinutes).toBe(30);
        expect(formatDiagnosisForPrompt(diag)).toContain('낮잠 평균 30분');
    });

    it('기록이 없으면 기록부터 하라고 안내한다', () => {
        const records: SleepRecord[] = [{ date: '2026-08-10' }];
        const diag = analyzeSleepGaps(calculateSleepScore(records), records);
        const gap = diag.gaps.find(g => g.key === 'duration')!;
        expect(gap.lever).toContain('기록');
    });
});

describe('formatDiagnosisForPrompt', () => {
    it('항목별 점수·원인·개선안을 모두 담는다', () => {
        const records = week('01:00', '06:00');
        const text = formatDiagnosisForPrompt(analyzeSleepGaps(calculateSleepScore(records), records));
        expect(text).toContain('수면 시간');
        expect(text).toContain('취침 목표');
        expect(text).toContain('기상 목표');
        expect(text).toContain('취침 일관성');
        expect(text).toContain('기상 일관성');
        expect(text).toContain('원인:');
        expect(text).toContain('개선 시:');
        // AI가 숫자를 새로 만들지 않도록 하는 지시가 들어 있어야 한다
        expect(text).toContain('그대로 인용하고 새로 계산하지 마');
    });
});

describe('getWeekPlanDays', () => {
    it('월요일이 아니라 오늘부터 7일을 만든다', () => {
        // 2026-09-04는 금요일 — 월요일(9/7)이 아니라 그날부터 시작해야 한다
        expect(getWeekPlanDays(new Date(2026, 8, 4))).toEqual([
            '9/4(금)', '9/5(토)', '9/6(일)', '9/7(월)', '9/8(화)', '9/9(수)', '9/10(목)',
        ]);
    });

    it('월 경계를 넘어가도 날짜가 이어진다', () => {
        expect(getWeekPlanDays(new Date(2026, 8, 29))).toEqual([
            '9/29(화)', '9/30(수)', '10/1(목)', '10/2(금)', '10/3(토)', '10/4(일)', '10/5(월)',
        ]);
    });

    it('연말을 넘어가도 날짜가 이어진다', () => {
        expect(getWeekPlanDays(new Date(2026, 11, 30))).toEqual([
            '12/30(수)', '12/31(목)', '1/1(금)', '1/2(토)', '1/3(일)', '1/4(월)', '1/5(화)',
        ]);
    });

    it('어느 요일에 시작하든 첫 줄은 그날이다', () => {
        for (let i = 0; i < 7; i++) {
            const day = new Date(2026, 8, 6 + i);   // 9/6(일)부터 한 바퀴
            const first = getWeekPlanDays(day)[0];
            expect(first).toBe(`${day.getMonth() + 1}/${day.getDate()}(${'일월화수목금토'[day.getDay()]})`);
        }
    });
});
