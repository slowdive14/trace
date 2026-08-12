/**
 * 수면 점수의 '잃은 점수'를 항목별로 분해하고, 무엇을 얼마나 바꾸면 몇 점이
 * 오르는지 계산한다 (순수 함수 — AI 호출 없음).
 *
 * 점수 산정은 코드가 하고 AI는 서술만 맡는다. 언어모델에 산수를 시키면
 * 그럴듯한 숫자를 지어내는데, 점수 이야기가 틀리면 조언 전체가 무용지물이 된다.
 *
 * calculateSleepScore()의 배점을 그대로 따른다:
 *   수면시간 40 · 취침목표 18 · 기상목표 18 · 취침일관성 12 · 기상일관성 12
 */
import type { SleepRecord, SleepScore } from './sleepUtils';

/** 이상적인 수면 시간 (calculateSleepScore와 동일) */
export const IDEAL_HOURS = 7.5;
/** 부족 수면 감점 기울기 (점/시간) */
export const UNDER_PENALTY_PER_HOUR = 8;
/** 과수면 감점 기울기 (점/시간) */
export const OVER_PENALTY_PER_HOUR = 4;
/** 일관성 점수는 편차 6분당 1점 */
export const CONSISTENCY_MIN_PER_POINT = 6;

export type GapKey = 'duration' | 'sleepGoal' | 'wakeGoal' | 'sleepConsistency' | 'wakeConsistency';

export interface ScoreGap {
    key: GapKey;
    label: string;
    current: number;
    max: number;
    /** 잃고 있는 점수 */
    lost: number;
    /** 왜 잃었는지 (수치 포함) */
    reason: string;
    /** 무엇을 바꾸면 몇 점 오르는지 */
    lever: string;
}

export interface SleepDiagnosis {
    total: number;
    gaps: ScoreGap[];
    /** 되찾을 점수가 가장 큰 항목 */
    biggest: ScoreGap | null;
    /** 낮잠 평균 (분) — 수면시간 점수에 합산되므로 따로 알린다 */
    avgNapMinutes: number;
    recordedDays: number;
    /** 취침·기상 시각이 기록된 날 수 */
    daysWithSleepTime: number;
    daysWithWakeTime: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const hoursToText = (h: number) => {
    const sign = h < 0 ? '-' : '';
    const abs = Math.abs(h);
    const hh = Math.floor(abs);
    const mm = Math.round((abs - hh) * 60);
    return hh > 0 ? `${sign}${hh}시간 ${mm}분` : `${sign}${mm}분`;
};

export function analyzeSleepGaps(score: SleepScore, records: SleepRecord[]): SleepDiagnosis {
    const d = score.details;
    const daysWithSleepTime = records.filter(r => r.sleepTime).length;
    const daysWithWakeTime = records.filter(r => r.wakeTime).length;

    const napTotal = records.reduce((s, r) => s + (r.napDuration ?? 0), 0);
    const avgNapMinutes = records.length ? Math.round(napTotal / records.length) : 0;

    const gaps: ScoreGap[] = [];

    // 1) 수면 시간 (40점)
    {
        const lost = 40 - score.durationScore;
        const avg = d.avgDuration;
        let reason: string;
        let lever: string;

        if (avg === null) {
            reason = '수면 시간이 기록된 날이 없어 점수를 낼 수 없음';
            lever = '취침·기상을 함께 기록하기만 해도 이 40점이 살아난다';
        } else {
            const diff = avg - IDEAL_HOURS;
            if (diff < 0) {
                const need = Math.abs(diff);
                reason = `평균 ${round1(avg)}시간 — 기준 ${IDEAL_HOURS}시간보다 ${hoursToText(need)} 부족 (부족분은 시간당 ${UNDER_PENALTY_PER_HOUR}점 감점)`;
                lever = `하루 30분 더 자면 +${round1(0.5 * UNDER_PENALTY_PER_HOUR)}점, ${hoursToText(need)}을 채워 ${IDEAL_HOURS}시간이 되면 +${Math.round(lost)}점 (이 항목 만점)`;
            } else if (diff > 0) {
                reason = `평균 ${round1(avg)}시간 — 기준 ${IDEAL_HOURS}시간보다 ${hoursToText(diff)} 많음 (초과분은 시간당 ${OVER_PENALTY_PER_HOUR}점 감점)`;
                lever = `${hoursToText(diff)} 줄여 ${IDEAL_HOURS}시간에 맞추면 +${Math.round(lost)}점`;
            } else {
                reason = `평균 ${round1(avg)}시간 — 기준과 일치`;
                lever = '이미 만점 구간. 유지가 목표';
            }
        }
        gaps.push({ key: 'duration', label: '수면 시간', current: score.durationScore, max: 40, lost, reason, lever });
    }

    // 2) 취침 목표 22:00~00:30 (18점)
    {
        const lost = 18 - score.sleepRegularity;
        const denom = daysWithSleepTime;
        const perDay = denom > 0 ? 18 / denom : 0;
        gaps.push({
            key: 'sleepGoal',
            label: '취침 목표 (22:00~00:30)',
            current: score.sleepRegularity,
            max: 18,
            lost,
            reason: denom > 0
                ? `취침을 기록한 ${denom}일 중 ${d.sleepGoalDays}일만 목표 구간 안`
                : '취침 시각이 기록된 날이 없음',
            lever: denom > 0
                ? `하루 더 지킬 때마다 +${round1(perDay)}점, 모든 날 지키면 +${Math.round(lost)}점`
                : '취침 시각을 기록해야 점수가 매겨진다',
        });
    }

    // 3) 기상 목표 05:45~07:30 (18점)
    {
        const lost = 18 - score.wakeRegularity;
        const denom = daysWithWakeTime;
        const perDay = denom > 0 ? 18 / denom : 0;
        gaps.push({
            key: 'wakeGoal',
            label: '기상 목표 (05:45~07:30)',
            current: score.wakeRegularity,
            max: 18,
            lost,
            reason: denom > 0
                ? `기상을 기록한 ${denom}일 중 ${d.wakeGoalDays}일만 목표 구간 안`
                : '기상 시각이 기록된 날이 없음',
            lever: denom > 0
                ? `하루 더 지킬 때마다 +${round1(perDay)}점, 모든 날 지키면 +${Math.round(lost)}점`
                : '기상 시각을 기록해야 점수가 매겨진다',
        });
    }

    // 4)(5) 일관성 — 편차 6분당 1점
    const consistency: Array<[GapKey, string, number, number]> = [
        ['sleepConsistency', '취침 일관성', score.sleepConsistencyScore, d.sleepConsistency],
        ['wakeConsistency', '기상 일관성', score.wakeConsistencyScore, d.wakeConsistency],
    ];
    for (const [key, label, current, mad] of consistency) {
        const lost = 12 - current;
        gaps.push({
            key, label, current, max: 12, lost,
            reason: `날마다 시각이 평균 ${mad}분씩 흔들림 (편차 ${CONSISTENCY_MIN_PER_POINT}분마다 1점 감점, ${CONSISTENCY_MIN_PER_POINT * 12}분이면 0점)`,
            lever: lost > 0
                ? `편차를 ${CONSISTENCY_MIN_PER_POINT}분 줄일 때마다 +1점, 매일 같은 시각이면 +${Math.round(lost)}점`
                : '이미 만점 구간. 유지가 목표',
        });
    }

    const candidates = gaps.filter(g => g.lost > 0).sort((a, b) => b.lost - a.lost);

    return {
        total: score.total,
        gaps,
        biggest: candidates[0] ?? null,
        avgNapMinutes,
        recordedDays: d.totalRecordedDays,
        daysWithSleepTime,
        daysWithWakeTime,
    };
}

/** AI 프롬프트에 넣을 진단 요약 텍스트 */
export function formatDiagnosisForPrompt(diag: SleepDiagnosis): string {
    const lines: string[] = [];
    lines.push(`총점 ${diag.total}/100 (기록된 날 ${diag.recordedDays}일)`);
    lines.push('');
    lines.push('[항목별 점수와 개선 여지] — 아래 숫자는 앱의 실제 계산식에서 나온 값이다. 그대로 인용하고 새로 계산하지 마.');
    for (const g of diag.gaps) {
        lines.push(`- ${g.label}: ${g.current}/${g.max}점 (잃은 점수 ${round1(g.lost)})`);
        lines.push(`  · 원인: ${g.reason}`);
        lines.push(`  · 개선 시: ${g.lever}`);
    }
    if (diag.biggest) {
        lines.push('');
        lines.push(`가장 크게 되찾을 수 있는 항목: ${diag.biggest.label} (+${round1(diag.biggest.lost)}점)`);
    }
    if (diag.avgNapMinutes > 0) {
        lines.push('');
        lines.push(`낮잠 평균 ${diag.avgNapMinutes}분/일 — 낮잠도 수면 시간에 합산되어 점수에 반영된다.`);
    }
    return lines.join('\n');
}

/** AI 프롬프트에 넣을 최근 기록 텍스트 */
export function formatRecordsForPrompt(records: SleepRecord[]): string {
    const fmt = (d?: Date) => d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '—';
    return [...records]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(r => {
            const dur = r.totalDuration ?? r.duration;
            const parts = [
                `${r.date}`,
                `취침 ${fmt(r.sleepTime)}`,
                `기상 ${fmt(r.wakeTime)}`,
                dur !== undefined ? `${Math.floor(dur / 60)}시간 ${dur % 60}분` : '시간 미상',
            ];
            if (r.napDuration) parts.push(`낮잠 ${r.napDuration}분`);
            return `- ${parts.join(' · ')}`;
        })
        .join('\n');
}
