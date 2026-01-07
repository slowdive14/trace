import { useState, useMemo } from 'react';
import { Moon, Sun, Clock, ChevronDown, Check, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Entry } from '../types/types';
import {
    extractSleepRecords,
    getRecentRecords,
    getAverageDuration,
    getAverageSleepTime,
    getAverageWakeTime,
    getWeeklyBarData,
    compareWeeks,
    checkWeeklyGoalStreak,
    type DailyBarData,
    type SleepScore,
    type WeeklyComparison,
    type WeeklyStreak,
} from '../utils/sleepUtils';

interface Props {
    entries: Entry[];
}

// 주간 바 차트 컴포넌트
function WeeklyBarChart({ data }: { data: DailyBarData[] }) {
    const maxDuration = 10; // 10시간 기준 스케일

    return (
        <div className="bg-bg-tertiary/50 rounded-lg p-3">
            <div className="text-xs text-text-secondary mb-2">이번 주 수면</div>

            {/* 바 차트 */}
            <div className="flex items-end justify-between gap-1 h-20">
                {data.map((day) => {
                    const heightPercent = day.duration
                        ? Math.min((day.duration / maxDuration) * 100, 100)
                        : 0;

                    let barColor = 'bg-bg-tertiary';
                    if (day.status === 'sufficient') barColor = 'bg-green-500';
                    else if (day.status === 'insufficient') barColor = 'bg-red-400';

                    return (
                        <div key={day.date} className="flex-1 flex flex-col items-center">
                            <div className="w-full flex justify-center mb-1">
                                <div
                                    className={`w-5 rounded-t ${barColor} transition-all`}
                                    style={{ height: `${heightPercent}%`, minHeight: day.duration ? '4px' : '2px' }}
                                />
                            </div>
                            <div className="text-[9px] text-text-secondary">
                                {day.duration ? `${day.duration.toFixed(1)}` : '-'}
                            </div>
                            <div className="text-[10px] text-text-secondary">
                                {day.dayLabel}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 범례 */}
            <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-text-secondary">
                <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" /> 7h+
                </span>
                <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-400" /> 7h 미만
                </span>
            </div>
        </div>
    );
}

// 점수 섹션 컴포넌트
function ScoreSection({ score, streak }: { score: SleepScore; streak: WeeklyStreak }) {
    const getScoreColor = (total: number) => {
        if (total >= 80) return 'text-green-400';
        if (total >= 60) return 'text-yellow-400';
        if (total >= 40) return 'text-orange-400';
        return 'text-red-400';
    };

    return (
        <div className="bg-bg-tertiary/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-text-secondary">수면 점수</span>
                <span className={`text-2xl font-bold ${getScoreColor(score.total)}`}>
                    {score.total}점
                </span>
            </div>

            {/* 점수 세부 */}
            <div className="space-y-2">
                {/* 수면시간 충족도 */}
                <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">수면시간</span>
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-400 rounded-full"
                                style={{ width: `${(score.durationScore / 40) * 100}%` }}
                            />
                        </div>
                        <span className="w-12 text-right text-text-secondary">{score.durationScore}/40</span>
                    </div>
                </div>

                {/* 취침 규칙성 */}
                <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">취침 규칙성</span>
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-purple-400 rounded-full"
                                style={{ width: `${(score.sleepRegularity / 30) * 100}%` }}
                            />
                        </div>
                        <span className="w-12 text-right text-text-secondary">{score.sleepRegularity}/30</span>
                    </div>
                </div>

                {/* 기상 규칙성 */}
                <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">기상 규칙성</span>
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-amber-400 rounded-full"
                                style={{ width: `${(score.wakeRegularity / 30) * 100}%` }}
                            />
                        </div>
                        <span className="w-12 text-right text-text-secondary">{score.wakeRegularity}/30</span>
                    </div>
                </div>
            </div>

            {/* 5일 달성 배지 */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-bg-tertiary">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] ${streak.sleepStreakMet
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'bg-bg-tertiary text-text-secondary'
                    }`}>
                    <Moon size={10} />
                    취침 {streak.sleepStreak}/5
                    {streak.sleepStreakMet && <Check size={10} />}
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] ${streak.wakeStreakMet
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-bg-tertiary text-text-secondary'
                    }`}>
                    <Sun size={10} />
                    기상 {streak.wakeStreak}/5
                    {streak.wakeStreakMet && <Check size={10} />}
                </div>
            </div>
        </div>
    );
}

// 주간 비교 컴포넌트
function ComparisonSection({ comparison }: { comparison: WeeklyComparison }) {
    const { thisWeek, lastWeek, scoreDiff, trend } = comparison;

    const trendIcon = trend === 'improved'
        ? <TrendingUp size={14} className="text-green-400" />
        : trend === 'declined'
            ? <TrendingDown size={14} className="text-red-400" />
            : <Minus size={14} className="text-text-secondary" />;

    const trendColor = trend === 'improved'
        ? 'text-green-400'
        : trend === 'declined'
            ? 'text-red-400'
            : 'text-text-secondary';

    return (
        <div className="bg-bg-tertiary/50 rounded-lg p-3">
            <div className="text-xs text-text-secondary mb-2">주간 비교</div>

            <div className="flex items-center justify-between">
                {/* 지난 주 */}
                <div className="text-center">
                    <div className="text-[10px] text-text-secondary">지난 주</div>
                    <div className="text-lg font-medium text-text-secondary">
                        {lastWeek.total}점
                    </div>
                </div>

                {/* 화살표 & 차이 */}
                <div className="flex flex-col items-center">
                    {trendIcon}
                    <span className={`text-xs font-medium ${trendColor}`}>
                        {scoreDiff > 0 ? '+' : ''}{scoreDiff}점
                    </span>
                </div>

                {/* 이번 주 */}
                <div className="text-center">
                    <div className="text-[10px] text-text-secondary">이번 주</div>
                    <div className="text-lg font-bold text-text-primary">
                        {thisWeek.total}점
                    </div>
                </div>
            </div>
        </div>
    );
}

// 평균 시간 섹션 (기존)
function AverageTimesSection({
    avgSleepTime,
    avgWakeTime,
    avgDuration
}: {
    avgSleepTime: string | null;
    avgWakeTime: string | null;
    avgDuration: number | null;
}) {
    return (
        <div className="bg-bg-tertiary/50 rounded-lg p-3">
            <div className="text-xs text-text-secondary mb-2">최근 7일 평균</div>
            <div className="flex justify-between items-center text-sm">
                <div className="text-center flex-1">
                    <div className="flex items-center justify-center gap-1 text-indigo-400 mb-1">
                        <Moon size={12} />
                        <span className="text-[10px]">취침</span>
                    </div>
                    <div className="text-sm font-medium">
                        {avgSleepTime || '--:--'}
                    </div>
                </div>
                <div className="text-center flex-1">
                    <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
                        <Sun size={12} />
                        <span className="text-[10px]">기상</span>
                    </div>
                    <div className="text-sm font-medium">
                        {avgWakeTime || '--:--'}
                    </div>
                </div>
                <div className="text-center flex-1">
                    <div className="flex items-center justify-center gap-1 text-text-secondary mb-1">
                        <Clock size={12} />
                        <span className="text-[10px]">수면</span>
                    </div>
                    <div className="text-sm font-medium">
                        {avgDuration !== null ? `${avgDuration}h` : '--'}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function SleepStats({ entries }: Props) {
    const [isExpanded, setIsExpanded] = useState(false);

    const stats = useMemo(() => {
        const allRecords = extractSleepRecords(entries);
        const recentRecords = getRecentRecords(allRecords, 7);
        const monthlyRecords = getRecentRecords(allRecords, 30);
        const weeklyBar = getWeeklyBarData(allRecords);
        const comparison = compareWeeks(allRecords);
        const streak = checkWeeklyGoalStreak(allRecords);

        return {
            weeklyBar,
            comparison,
            streak,
            avgDuration: getAverageDuration(recentRecords),
            avgSleepTime: getAverageSleepTime(recentRecords),
            avgWakeTime: getAverageWakeTime(recentRecords),
            // 이번 달 평균
            monthlyAvgSleepTime: getAverageSleepTime(monthlyRecords),
            monthlyAvgWakeTime: getAverageWakeTime(monthlyRecords),
            recordCount: recentRecords.length,
        };
    }, [entries]);

    // 기록이 없으면 표시하지 않음
    if (stats.recordCount === 0) {
        return null;
    }

    return (
        <div className="bg-bg-secondary rounded-xl overflow-hidden mb-4">
            {/* 접힌 상태 - 요약 헤더 */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-3 flex items-center justify-between"
            >
                <div className="flex items-center gap-2">
                    <Moon size={16} className="text-indigo-400" />
                    <span className="text-sm font-medium">수면</span>
                    <span className="text-xs text-text-secondary">
                        이번 주 {stats.comparison.thisWeek.total}점
                    </span>
                    <span className="text-[10px] text-text-secondary">
                        · 월평균 {stats.monthlyAvgSleepTime || '--:--'}~{stats.monthlyAvgWakeTime || '--:--'}
                    </span>
                </div>
                <ChevronDown
                    size={16}
                    className={`text-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
            </button>

            {/* 펼친 상태 */}
            {isExpanded && (
                <div className="px-3 pb-4 space-y-3">
                    <WeeklyBarChart data={stats.weeklyBar} />
                    <ScoreSection score={stats.comparison.thisWeek} streak={stats.streak} />
                    <ComparisonSection comparison={stats.comparison} />
                    <AverageTimesSection
                        avgSleepTime={stats.avgSleepTime}
                        avgWakeTime={stats.avgWakeTime}
                        avgDuration={stats.avgDuration}
                    />
                </div>
            )}
        </div>
    );
}
