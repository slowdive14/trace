import { format, subDays, differenceInMinutes, getHours, getMinutes } from 'date-fns';
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
