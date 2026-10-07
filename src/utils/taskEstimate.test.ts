import { describe, it, expect } from 'vitest';
import {
    normalizeTaskText, taskKey, taskBase, pageCount, trailingNumber,
    collectAppSamples, buildEstimator, describeEstimate,
    type DurationSample, type TogglRow,
} from './taskEstimate';

const app = (date: string, text: string, minutes: number): DurationSample =>
    ({ date, text, minutes, source: 'app' });

describe('이름 다듬기', () => {
    it('표식(eid·소요시간·사분면·강조·추가)을 걷어 낸다', () => {
        expect(normalizeTaskText('**트레드밀 및 웨이트**  (40m) {eid:abc123} #q2')).toBe('트레드밀 및 웨이트');
        expect(normalizeTaskText('+갑자기 온 상담 (1h30m)')).toBe('갑자기 온 상담');
    });

    it('똑같은 이름인지는 공백·대소문자만 무시한다', () => {
        expect(taskKey('보고서 1')).toBe(taskKey('보고서1'));
        expect(taskKey('보고서 1')).not.toBe(taskKey('보고서 2'));
    });

    it('바탕 이름은 숫자·쪽수·괄호를 걷어 낸다', () => {
        expect(taskBase('넥서스 30쪽')).toBe('넥서스');
        expect(taskBase('넥서스 60')).toBe('넥서스');
        expect(taskBase('미니닌 영어(리스닝 필수)')).toBe(taskBase('미니닌 영어'));
        expect(taskBase('보고서 0.5')).toBe('보고서');
        expect(taskBase('회기 리뷰 2')).toBe(taskBase('회기리뷰 3'));
    });

    it('가려 쓴 사람 이름은 걷어 내 같은 종류의 일로 묶는다', () => {
        const base = taskBase('보고서 작성');
        expect(taskBase('신OO 보고서 작성')).toBe(base);
        expect(taskBase('이oo 보고서 작성')).toBe(base);
        expect(taskBase('신ㅇㅇ 보고서 작성')).toBe(base);
        expect(taskBase('김라O 보고서')).toBe(taskBase('보고서'));
        expect(taskBase('이OO님 바우처 사례 정리')).toBe(taskBase('바우처 사례 정리'));
    });

    it('영어 단어의 o는 건드리지 않는다', () => {
        expect(taskBase('트레드밀 및 웨이트 or 러닝')).toBe('트레드밀및웨이트or러닝');
    });

    it('숫자뿐인 이름(하위 항목 1, 2)은 바탕 이름이 비어 있다', () => {
        expect(taskBase('1')).toBe('');
        expect(taskBase('2')).toBe('');
    });

    it('쪽수를 읽는다', () => {
        expect(pageCount('넥서스 30쪽')).toBe(30);
        expect(pageCount('권력과 진보 41p')).toBe(41);
        expect(pageCount('오뒷세이아(전자책 120p)')).toBe(120);
        expect(pageCount('넥서스 60')).toBeUndefined();
        expect(pageCount('30 people')).toBeUndefined();
        expect(trailingNumber('넥서스 60')).toBe(60);
    });
});

describe('앱 기록 모으기', () => {
    const days = [
        { date: '2026-10-05', content: '- [x] 혼공머신 (80m)\n- [ ] 방송대 강의 한 강 (60m)\n- [x] 미니닌 영어' },
        { date: '2026-10-07', content: '- [x] 혼공머신 (30m)' },
    ];

    it('완료하고 시간을 적은 것만 쓴다', () => {
        const samples = collectAppSamples(days, '2026-10-07');
        expect(samples).toHaveLength(1);
        expect(samples[0]).toMatchObject({ date: '2026-10-05', minutes: 80 });
    });

    it('오늘 것은 뺀다 (아직 계획일 수 있다)', () => {
        expect(collectAppSamples(days, '2026-10-07').some(s => s.date === '2026-10-07')).toBe(false);
    });
});

describe('예상 시간', () => {
    it('같은 이름의 최근 기록 중간값 (5분 단위)', () => {
        const est = buildEstimator([
            app('2026-09-01', '혼공머신', 80),
            app('2026-09-02', '혼공머신', 70),
            app('2026-09-03', '혼공머신', 60),
            app('2026-09-04', '혼공머신', 90),
            app('2026-09-05', '혼공머신', 82),
        ], [])('혼공머신');
        expect(est).toMatchObject({ minutes: 80, method: 'same', count: 5, app: 5, toggl: 0 });
    });

    it('튀는 기록 하나에 끌려가지 않는다 (중간값)', () => {
        const est = buildEstimator([
            app('2026-09-01', '넥서스 30쪽', 30),
            app('2026-09-02', '넥서스 30쪽', 30),
            app('2026-09-03', '넥서스 30쪽', 140),
        ], [])('넥서스 30쪽');
        expect(est!.minutes).toBe(30);
    });

    it('쪽수가 다르면 쪽당 시간으로 환산한다 (쪽 단위를 안 적어도)', () => {
        const est = buildEstimator([
            app('2026-09-01', '넥서스 30쪽', 30),
            app('2026-09-02', '넥서스 30쪽', 40),
            app('2026-09-03', '넥서스 30쪽', 30),
        ], [])('넥서스 60');
        expect(est).toMatchObject({ method: 'perPage', pages: 60, minutes: 60 });
        expect(est!.perPage).toBe(1);
    });

    it('지난 기록에 쪽수가 없으면 끝 숫자를 쪽수로 보지 않는다 (보고서 1 ≠ 1쪽)', () => {
        const est = buildEstimator([
            app('2026-09-01', '보고서 1', 120),
            app('2026-09-02', '보고서1', 140),
            app('2026-09-03', '보고서 2', 60),
        ], [])('보고서 1');
        expect(est).toMatchObject({ method: 'same', count: 2, minutes: 130 });
    });

    it('처음 보는 번호는 바탕 이름이 같은 기록 전체로', () => {
        const est = buildEstimator([
            app('2026-09-01', '보고서 1', 120),
            app('2026-09-02', '보고서 2', 60),
        ], [])('보고서 3');
        expect(est).toMatchObject({ method: 'similar', count: 2, minutes: 90 });
    });

    it('괄호 속 메모가 붙어도 같은 일로 본다', () => {
        const est = buildEstimator([app('2026-09-01', '미니닌 영어', 15)], [])('미니닌 영어(리스닝 필수)');
        expect(est!.minutes).toBe(15);
    });

    it('숫자뿐인 이름은 예상하지 않는다', () => {
        expect(buildEstimator([app('2026-09-01', '1', 35)], [])('1')).toBeNull();
    });

    it('기록이 없으면 null', () => {
        expect(buildEstimator([], [])('배터리 찾아오기')).toBeNull();
    });

    it('최근 8건만 본다', () => {
        const old = Array.from({ length: 10 }, (_, i) => app(`2026-08-${String(i + 1).padStart(2, '0')}`, '달리기', 120));
        const recent = Array.from({ length: 8 }, (_, i) => app(`2026-09-${String(i + 1).padStart(2, '0')}`, '달리기', 50));
        expect(buildEstimator([...old, ...recent], [])('달리기')!.minutes).toBe(50);
    });
});

describe('앱과 Toggl 합치기', () => {
    const toggl = (d: string, t: string, m: number, p?: string): TogglRow => (p ? { d, t, m, p } : { d, t, m });

    it('Toggl에만 있는 기록도 쓴다', () => {
        const est = buildEstimator([], [toggl('2026-09-01', '혼공머신', 75)])('혼공머신');
        expect(est).toMatchObject({ minutes: 75, toggl: 1, app: 0 });
    });

    it('같은 날 같은 일이 양쪽에 있으면 한 번만 세고 시간은 Toggl 값을 쓴다', () => {
        const est = buildEstimator(
            [app('2026-09-01', '혼공머신', 60)],
            [toggl('2026-09-01', '혼공머신', 83)],
        )('혼공머신');
        expect(est).toMatchObject({ count: 1, minutes: 85, toggl: 1, app: 0 });
    });

    it('짝지을 때 쪽수는 앱 이름에서 가져온다 (Toggl 설명엔 쪽수가 없어도)', () => {
        const est = buildEstimator(
            [app('2026-09-01', '넥서스 30쪽', 30)],
            [toggl('2026-09-01', '넥서스', 45)],
        )('넥서스 60');
        // 30쪽에 45분 → 쪽당 1.5분 × 60쪽
        expect(est).toMatchObject({ method: 'perPage', minutes: 90, toggl: 1 });
    });

    it('날이 다르면 둘 다 표본이다', () => {
        const est = buildEstimator(
            [app('2026-09-01', '혼공머신', 60)],
            [toggl('2026-09-02', '혼공머신', 80)],
        )('혼공머신');
        expect(est).toMatchObject({ count: 2, minutes: 70, app: 1, toggl: 1 });
    });

    it('같은 날 여러 건이 섞여 짝을 모르면 Toggl 쪽만 남긴다', () => {
        const est = buildEstimator(
            [app('2026-09-01', '보고서 1', 100), app('2026-09-01', '보고서 2', 100)],
            [toggl('2026-09-01', '보고서', 150)],
        )('보고서');
        expect(est).toMatchObject({ count: 1, minutes: 150, toggl: 1, app: 0 });
    });

    it('이름이 같은 것끼리는 여러 건이어도 짝짓는다', () => {
        const est = buildEstimator(
            [app('2026-09-01', '보고서 1', 100), app('2026-09-01', '보고서 2', 100)],
            [toggl('2026-09-01', '보고서 1', 130), toggl('2026-09-01', '보고서 2', 90)],
        )('보고서 1');
        expect(est).toMatchObject({ method: 'same', count: 1, minutes: 130, toggl: 1 });
    });

    it('설명으로 못 찾으면 Toggl 프로젝트 이름으로 찾는다', () => {
        const est = buildEstimator([], [
            toggl('2026-09-01', '3장 실습', 40, '방송대 과제'),
            toggl('2026-09-01', '자료 조사', 20, '방송대 과제'),
            toggl('2026-09-02', '4장', 90, '방송대 과제'),
        ])('방송대 과제');
        // 하루 합계: 60, 90 → 중간값 75
        expect(est).toMatchObject({ method: 'project', minutes: 75, count: 2, project: '방송대 과제' });
    });
});

describe('근거 문구', () => {
    it('방법과 출처를 함께 적는다', () => {
        expect(describeEstimate({ minutes: 60, method: 'perPage', count: 3, app: 2, toggl: 1, perPage: 1, pages: 60 }))
            .toBe('쪽당 1.0분 × 60쪽 (최근 기록 3번: Toggl 1 · 앱 2)');
        expect(describeEstimate({ minutes: 80, method: 'same', count: 5, app: 5, toggl: 0 }))
            .toBe('같은 일 최근 5번의 중간값 (앱 5)');
    });
});
