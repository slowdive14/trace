import { format, subDays, differenceInMinutes, getHours, getMinutes, startOfWeek, endOfWeek, subWeeks, addDays } from 'date-fns';
import type { Entry } from '../types/types';

export interface SleepRecord {
    date: string;        // YYYY-MM-DD (기상 날짜 기준)
    sleepTime?: Date;    // 취침 시각
    wakeTime?: Date;     // 기상 시각
    duration?: number;   // 수면 시간 (분)
}

/**
 * Entry 배열에서 수면 기록 추출
 * 취침(#sleep) → 기상(#wake) 매칭
 */
export function extractSleepRecords(entries: Entry[]): SleepRecord[] {
    // #sleep, #wake 태그가 있는 엔트리만 필터링
    const sleepEntries = entries
        .filter(e => e.tags.includes('#sleep'))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const wakeEntries = entries
        .filter(e => e.tags.includes('#wake'))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const records: SleepRecord[] = [];
    const usedSleepIndices = new Set<number>();

    // 각 기상에 대해 가장 가까운 이전 취침을 매칭
    for (const wake of wakeEntries) {
        const wakeTime = wake.timestamp;
        let bestSleepIdx = -1;
        let bestDiff = Infinity;

        for (let i = 0; i < sleepEntries.length; i++) {
            if (usedSleepIndices.has(i)) continue;

            const sleepTime = sleepEntries[i].timestamp;
            // 취침이 기상보다 앞서야 함
            if (sleepTime >= wakeTime) continue;

            const diff = wakeTime.getTime() - sleepTime.getTime();
            // 24시간 이내의 취침만 매칭
            if (diff < 24 * 60 * 60 * 1000 && diff < bestDiff) {
                bestDiff = diff;
                bestSleepIdx = i;
            }
        }

        const record: SleepRecord = {
            date: format(wakeTime, 'yyyy-MM-dd'),
            wakeTime: wakeTime,
        };

        if (bestSleepIdx !== -1) {
            const sleepTime = sleepEntries[bestSleepIdx].timestamp;
            record.sleepTime = sleepTime;
            record.duration = differenceInMinutes(wakeTime, sleepTime);
            usedSleepIndices.add(bestSleepIdx);
        }

        records.push(record);
    }

    // 매칭되지 않은 취침도 기록 (기상 미기록 상태)
    for (let i = 0; i < sleepEntries.length; i++) {
        if (usedSleepIndices.has(i)) continue;

        const sleepTime = sleepEntries[i].timestamp;
        records.push({
            date: format(sleepTime, 'yyyy-MM-dd'),
            sleepTime: sleepTime,
        });
    }

    return records.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * 최근 N일 간의 수면 기록 필터링
 */
export function getRecentRecords(records: SleepRecord[], days: number): SleepRecord[] {
    const cutoff = format(subDays(new Date(), days), 'yyyy-MM-dd');
    return records.filter(r => r.date >= cutoff);
}

/**
 * 평균 수면 시간 계산 (시간 단위, 소수점 1자리)
 */
export function getAverageDuration(records: SleepRecord[]): number | null {
    const validRecords = records.filter(r => r.duration !== undefined);
    if (validRecords.length === 0) return null;

    const totalMinutes = validRecords.reduce((sum, r) => sum + (r.duration || 0), 0);
    const avgMinutes = totalMinutes / validRecords.length;
    return Math.round(avgMinutes / 6) / 10; // 시간 단위, 소수점 1자리
}

/**
 * 시각을 분 단위로 변환 (00:00 기준, 자정 넘으면 +1440)
 * 새벽 6시 이전은 전날 밤으로 간주
 */
function timeToMinutes(date: Date): number {
    const hours = getHours(date);
    const minutes = getMinutes(date);
    const totalMinutes = hours * 60 + minutes;

    // 00:00~05:59는 전날 밤으로 간주 (1440분 추가)
    if (hours < 6) {
        return totalMinutes + 1440;
    }
    return totalMinutes;
}

/**
 * 분을 시각 문자열로 변환 (HH:mm)
 */
function minutesToTimeString(minutes: number): string {
    // 1440분 이상이면 다음날 새벽이므로 1440을 빼줌
    const normalizedMinutes = minutes >= 1440 ? minutes - 1440 : minutes;
    const hours = Math.floor(normalizedMinutes / 60);
    const mins = Math.round(normalizedMinutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * 평균 취침 시각 계산
 */
export function getAverageSleepTime(records: SleepRecord[]): string | null {
    const validRecords = records.filter(r => r.sleepTime !== undefined);
    if (validRecords.length === 0) return null;

    const totalMinutes = validRecords.reduce((sum, r) => sum + timeToMinutes(r.sleepTime!), 0);
    const avgMinutes = totalMinutes / validRecords.length;
    return minutesToTimeString(avgMinutes);
}

/**
 * 평균 기상 시각 계산
 */
export function getAverageWakeTime(records: SleepRecord[]): string | null {
    const validRecords = records.filter(r => r.wakeTime !== undefined);
    if (validRecords.length === 0) return null;

    const totalMinutes = validRecords.reduce((sum, r) => {
        const hours = getHours(r.wakeTime!);
        const minutes = getMinutes(r.wakeTime!);
        return sum + hours * 60 + minutes;
    }, 0);
    const avgMinutes = totalMinutes / validRecords.length;
    return minutesToTimeString(avgMinutes);
}

// ============================================
// 목표 달성 체크 관련 함수들
// ============================================

// 목표 시간 상수 (분 단위)
const WAKE_GOAL_START = 5 * 60 + 45; // 05:45 = 345분
const WAKE_GOAL_GRACE = 7 * 60 + 30; // 07:30 = 450분 (허용 한계)

const SLEEP_GOAL_START = 23 * 60;    // 23:00 = 1380분
const SLEEP_GOAL_GRACE = 30;         // 00:30 = 30분 (다음날)

export interface GoalAchievement {
    wakeGoalMet: boolean;
    sleepGoalMet: boolean;
}

/**
 * 개별 기록의 목표 달성 여부 체크
 * - 기상 목표: 05:45~07:30
 * - 취침 목표: 23:00~00:30
 */
export function checkGoalAchievement(record: SleepRecord): GoalAchievement {
    let wakeGoalMet = false;
    let sleepGoalMet = false;

    // 기상 목표 체크: 05:45 ~ 07:30
    if (record.wakeTime) {
        const wakeMinutes = getHours(record.wakeTime) * 60 + getMinutes(record.wakeTime);
        wakeGoalMet = wakeMinutes >= WAKE_GOAL_START && wakeMinutes <= WAKE_GOAL_GRACE;
    }

    // 취침 목표 체크: 23:00 ~ 00:30 (자정 넘김 처리)
    if (record.sleepTime) {
        const sleepMinutes = getHours(record.sleepTime) * 60 + getMinutes(record.sleepTime);
        // 23:00~23:59 OR 00:00~00:30
        sleepGoalMet = (sleepMinutes >= SLEEP_GOAL_START) || (sleepMinutes <= SLEEP_GOAL_GRACE);
    }

    return { wakeGoalMet, sleepGoalMet };
}

export interface WeeklyRecords {
    records: SleepRecord[];
    weekStart: Date;
    weekEnd: Date;
}

/**
 * 특정 주의 기록 필터링 (월~일, 한국 기준)
 * @param weekOffset 0 = 이번 주, 1 = 지난 주
 */
export function getWeeklyRecords(records: SleepRecord[], weekOffset: number = 0): WeeklyRecords {
    const now = new Date();
    const targetWeek = subWeeks(now, weekOffset);
    const monday = startOfWeek(targetWeek, { weekStartsOn: 1 });
    const sunday = endOfWeek(targetWeek, { weekStartsOn: 1 });

    const weekRecords = records.filter(r => {
        const recordDate = new Date(r.date + 'T00:00:00');
        return recordDate >= monday && recordDate <= sunday;
    });

    return {
        records: weekRecords,
        weekStart: monday,
        weekEnd: sunday,
    };
}

export interface SleepScore {
    total: number;           // 0-100
    durationScore: number;   // 0-40
    sleepRegularity: number; // 0-15 (목표 달성)
    wakeRegularity: number;  // 0-15 (목표 달성)
    sleepConsistencyScore: number; // 0-15 (취침 일관성)
    wakeConsistencyScore: number;  // 0-15 (기상 일관성)
    details: {
        avgDuration: number | null;
        sleepGoalDays: number;
        wakeGoalDays: number;
        totalRecordedDays: number;
        sleepConsistency: number; // 분 단위 편차
        wakeConsistency: number;  // 분 단위 편차
    };
}

/**
 * 평균 절대 편차(Mean Absolute Deviation) 계산
 * 시간이 얼마나 일정한지 측정 (분 단위)
 */
function calculateMAD(minutes: number[]): number {
    if (minutes.length < 2) return 0;
    const avg = minutes.reduce((a, b) => a + b, 0) / minutes.length;
    const deviationSum = minutes.reduce((sum, m) => sum + Math.abs(m - avg), 0);
    return deviationSum / minutes.length;
}

/**
 * 수면 점수 계산 (100점 만점)
 * - 수면시간 충족도: 40점 (7.5시간 기준)
 * - 목표 달성(규칙성): 30점 (취침 15 + 기상 15)
 * - 일관성 지표: 30점 (취침 15 + 기상 15)
 * 
 * @param contextRecords 일관성(MAD) 계산을 위한 맥락 데이터 (예: 지난 주 기록). 점수 계산 자체는 records 기준이지만, 편차 계산 시에는 더 많은 샘플을 사용함.
 */
export function calculateSleepScore(records: SleepRecord[], contextRecords: SleepRecord[] = []): SleepScore {
    if (records.length === 0) {
        return {
            total: 0,
            durationScore: 0,
            sleepRegularity: 0,
            wakeRegularity: 0,
            sleepConsistencyScore: 0,
            wakeConsistencyScore: 0,
            details: {
                avgDuration: null,
                sleepGoalDays: 0,
                wakeGoalDays: 0,
                totalRecordedDays: 0,
                sleepConsistency: 0,
                wakeConsistency: 0
            }
        };
    }

    const achievements = records.map(r => checkGoalAchievement(r));

    // 1. 수면시간 점수 (40점 만점)
    const avgDuration = getAverageDuration(records);
    let durationScore = 0;
    if (avgDuration !== null) {
        const idealHours = 7.5;
        const deviation = Math.abs(avgDuration - idealHours);
        durationScore = Math.max(0, 40 - (deviation * 8));
    }

    // 2. 목표 달성 점수 (30점 만점: 취침 15 + 기상 15)
    // 기록 수에 비례하여 점수 부여 (100% 달성 시 만점)
    const sleepGoalDays = achievements.filter(a => a.sleepGoalMet).length;
    const wakeGoalDays = achievements.filter(a => a.wakeGoalMet).length;
    const sleepGoalScore = (sleepGoalDays / records.length) * 15;
    const wakeGoalScore = (wakeGoalDays / records.length) * 15;


    // 3. 일관성 점수 (30점 만점: 취침 15 + 기상 15)
    // 일관성은 '최근 흐름'을 반영해야 하므로 contextRecords를 포함해 최소 3일 이상의 데이터로 계산 권장
    const consistencySample = [...contextRecords, ...records];

    // 중복 제거 (혹시 context와 current가 겹칠 경우)
    const uniqueSample = Array.from(new Map(consistencySample.map(item => [item.date, item])).values())
        .filter(r => r.sleepTime || r.wakeTime); // 유효한 기록만

    const sleepMinutes = uniqueSample.filter(r => r.sleepTime).map(r => timeToMinutes(r.sleepTime!));
    const wakeMinutes = uniqueSample.filter(r => r.wakeTime).map(r => {
        const h = getHours(r.wakeTime!);
        const m = getMinutes(r.wakeTime!);
        return h * 60 + m;
    });

    const sleepMAD = calculateMAD(sleepMinutes);
    const wakeMAD = calculateMAD(wakeMinutes);

    // MAD가 0이면 15점, 60분(1시간) 이상이면 0점 (선형 감점)
    const sleepConsistencyRaw = Math.max(0, 15 - (sleepMAD / 4));
    const wakeConsistencyRaw = Math.max(0, 15 - (wakeMAD / 4));

    // 개별 점수를 먼저 round한 뒤 합산하여 total = 세부 합과 일치하도록 보장
    const roundedDuration = Math.round(durationScore);
    const roundedSleepGoal = Math.round(sleepGoalScore);
    const roundedWakeGoal = Math.round(wakeGoalScore);
    const roundedSleepConsistency = Math.round(sleepConsistencyRaw);
    const roundedWakeConsistency = Math.round(wakeConsistencyRaw);

    const total = roundedDuration + roundedSleepGoal + roundedWakeGoal + roundedSleepConsistency + roundedWakeConsistency;

    return {
        total,
        durationScore: roundedDuration,
        sleepRegularity: roundedSleepGoal,
        wakeRegularity: roundedWakeGoal,
        sleepConsistencyScore: roundedSleepConsistency,
        wakeConsistencyScore: roundedWakeConsistency,
        details: {
            avgDuration,
            sleepGoalDays,
            wakeGoalDays,
            totalRecordedDays: records.length,
            sleepConsistency: Math.round(sleepMAD),
            wakeConsistency: Math.round(wakeMAD),
        }
    };
}

export interface WeeklyComparison {
    thisWeek: SleepScore;
    lastWeek: SleepScore;
    scoreDiff: number;
    durationDiff: number | null;
    trend: 'improved' | 'declined' | 'stable';
}

/**
 * 이번 주 vs 지난 주 비교
 */
export function compareWeeks(records: SleepRecord[]): WeeklyComparison {
    const thisWeekData = getWeeklyRecords(records, 0);
    const lastWeekData = getWeeklyRecords(records, 1);
    const prevLastWeekData = getWeeklyRecords(records, 2);

    const thisWeek = calculateSleepScore(thisWeekData.records, lastWeekData.records);
    const lastWeek = calculateSleepScore(lastWeekData.records, prevLastWeekData.records);

    const scoreDiff = thisWeek.total - lastWeek.total;

    let durationDiff: number | null = null;
    if (thisWeek.details.avgDuration !== null && lastWeek.details.avgDuration !== null) {
        durationDiff = thisWeek.details.avgDuration - lastWeek.details.avgDuration;
    }

    let trend: 'improved' | 'declined' | 'stable' = 'stable';
    if (scoreDiff > 5) trend = 'improved';
    else if (scoreDiff < -5) trend = 'declined';

    return { thisWeek, lastWeek, scoreDiff, durationDiff, trend };
}

export interface DailyBarData {
    date: string;
    dayLabel: string;
    duration: number | null;
    status: 'sufficient' | 'insufficient' | 'no-data';
    wakeGoalMet: boolean;
    sleepGoalMet: boolean;
}

/**
 * 주간 바 차트 데이터 생성 (월~일)
 */
export function getWeeklyBarData(records: SleepRecord[], weekOffset: number = 0): DailyBarData[] {
    const weekData = getWeeklyRecords(records, weekOffset);
    const days = ['월', '화', '수', '목', '금', '토', '일'];

    const result: DailyBarData[] = [];

    for (let i = 0; i < 7; i++) {
        const date = addDays(weekData.weekStart, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const record = records.find(r => r.date === dateStr);

        let status: 'sufficient' | 'insufficient' | 'no-data' = 'no-data';
        let duration: number | null = null;
        let wakeGoalMet = false;
        let sleepGoalMet = false;

        if (record && record.duration !== undefined) {
            duration = record.duration / 60; // 분 → 시간
            status = duration >= 7 ? 'sufficient' : 'insufficient';
            const achievement = checkGoalAchievement(record);
            wakeGoalMet = achievement.wakeGoalMet;
            sleepGoalMet = achievement.sleepGoalMet;
        }

        result.push({
            date: dateStr,
            dayLabel: days[i],
            duration,
            status,
            wakeGoalMet,
            sleepGoalMet,
        });
    }

    return result;
}

export interface WeeklyStreak {
    sleepStreak: number;
    wakeStreak: number;
    sleepStreakMet: boolean;
    wakeStreakMet: boolean;
}

/**
 * 주 5일 목표 달성 여부 체크
 */
export function checkWeeklyGoalStreak(records: SleepRecord[], weekOffset: number = 0): WeeklyStreak {
    const weekData = getWeeklyRecords(records, weekOffset);
    const achievements = weekData.records.map(r => checkGoalAchievement(r));

    const sleepStreak = achievements.filter(a => a.sleepGoalMet).length;
    const wakeStreak = achievements.filter(a => a.wakeGoalMet).length;

    return {
        sleepStreak,
        wakeStreak,
        sleepStreakMet: sleepStreak >= 5,
        wakeStreakMet: wakeStreak >= 5,
    };
}

export interface IdealSchedule {
    bedtime: string;
    waketime: string;
}

/**
 * 수면 점수 최대화를 위한 적정 취침/기상 시간 계산
 * - 궁극적 목표: 23:00 취침 / 06:30 기상 (기상 목표 05:45~07:30 만족)
 * - 점진적 개선: 현재 평균이 목표와 멀다면, 한 번에 목표를 제시하지 않고 15~30분씩 당기도록 유도
 */
export function getIdealSleepSchedule(records: SleepRecord[]): IdealSchedule {
    const TARGET_BEDTIME = 23 * 60; // 23:00

    // 기본값: 목표 시간
    let idealBedtimeMinutes = TARGET_BEDTIME;

    // 최근 7일 데이터만 사용 (UI의 "최근 7일 평균"과 일치)
    const recentRecords = getRecentRecords(records, 7);
    const validRecentSleeps = recentRecords
        .filter(r => r.sleepTime);

    if (validRecentSleeps.length > 0) {
        const avgBedtimeMinutes = validRecentSleeps.reduce((sum, r) => sum + timeToMinutes(r.sleepTime!), 0) / validRecentSleeps.length;

        // 점진적 Nudge 로직: 격차의 10%만 조정 (최소 5분, 최대 20분)
        // 예: 00:22 취침 → 목표 23:00과 82분 차이 → 8분만 앞당김 → 00:14 권장
        // 매주 꾸준히 지키면 자연스럽게 목표에 수렴
        if (avgBedtimeMinutes > TARGET_BEDTIME) {
            // 목표보다 늦게 자는 경우 → 격차의 10%만 앞당기기
            const gap = avgBedtimeMinutes - TARGET_BEDTIME;
            const nudge = Math.min(20, Math.max(5, Math.round(gap * 0.1)));
            idealBedtimeMinutes = avgBedtimeMinutes - nudge;
        } else {
            // 목표보다 일찍 자는 경우 → 격차의 10%만 늦추기 (최대 23:00까지)
            const gap = TARGET_BEDTIME - avgBedtimeMinutes;
            const nudge = Math.min(20, Math.max(5, Math.round(gap * 0.1)));
            idealBedtimeMinutes = Math.min(TARGET_BEDTIME, avgBedtimeMinutes + nudge);
        }
    }

    const idealWaketimeMinutes = idealBedtimeMinutes + (7.5 * 60);

    return {
        bedtime: minutesToTimeString(idealBedtimeMinutes),
        waketime: minutesToTimeString(idealWaketimeMinutes),
    };
}
