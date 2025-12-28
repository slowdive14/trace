import { useMemo } from 'react';
import { Moon, Sun, Clock } from 'lucide-react';
import type { Entry } from '../types/types';
import {
    extractSleepRecords,
    getRecentRecords,
    getAverageDuration,
    getAverageSleepTime,
    getAverageWakeTime,
} from '../utils/sleepUtils';

interface Props {
    entries: Entry[];
}

export function SleepStats({ entries }: Props) {
    const stats = useMemo(() => {
        const allRecords = extractSleepRecords(entries);
        const recentRecords = getRecentRecords(allRecords, 7);

        return {
            avgDuration: getAverageDuration(recentRecords),
            avgSleepTime: getAverageSleepTime(recentRecords),
            avgWakeTime: getAverageWakeTime(recentRecords),
            recordCount: recentRecords.length,
        };
    }, [entries]);

    // 기록이 없으면 표시하지 않음
    if (stats.recordCount === 0) {
        return null;
    }

    return (
        <div className="p-3 bg-bg-secondary rounded-lg mb-4">
            <div className="text-xs text-text-secondary mb-2">최근 7일 수면</div>
            <div className="flex justify-between items-center text-sm">
                <div className="text-center flex-1">
                    <div className="flex items-center justify-center gap-1 text-indigo-400 mb-1">
                        <Moon size={14} />
                        <span className="text-xs">취침</span>
                    </div>
                    <div className="text-base font-medium">
                        {stats.avgSleepTime || '--:--'}
                    </div>
                </div>
                <div className="text-center flex-1">
                    <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
                        <Sun size={14} />
                        <span className="text-xs">기상</span>
                    </div>
                    <div className="text-base font-medium">
                        {stats.avgWakeTime || '--:--'}
                    </div>
                </div>
                <div className="text-center flex-1">
                    <div className="flex items-center justify-center gap-1 text-text-secondary mb-1">
                        <Clock size={14} />
                        <span className="text-xs">수면</span>
                    </div>
                    <div className="text-base font-medium">
                        {stats.avgDuration !== null ? `${stats.avgDuration}h` : '--'}
                    </div>
                </div>
            </div>
        </div>
    );
}
