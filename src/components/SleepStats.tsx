import { useState, useMemo } from 'react';
import { Moon, Sun, Clock, ChevronDown, ChevronLeft, ChevronRight, Check, TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import { startOfWeek, endOfWeek, format, subWeeks } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Entry } from '../types/types';
import {
    extractSleepRecords,
    getRecentRecords,
    getAverageDuration,
    getAverageSleepTime,
    getAverageWakeTime,
    getWeeklyBarData,
    getWeeklyRecords,
    calculateSleepScore,
    checkWeeklyGoalStreak,
    type DailyBarData,
    type SleepScore,
    type WeeklyComparison,
    type WeeklyStreak,
} from '../utils/sleepUtils';

interface Props {
    entries: Entry[];
}

function InfoTooltip({ content }: { content: React.ReactNode }) {
    return (
        <div className="group relative flex items-center ml-1 z-10">
            <HelpCircle size={10} className="text-text-tertiary cursor-help hover:text-text-secondary transition-colors" />
            <div className="absolute bottom-full left-[-12px] mb-2 w-60 p-3 bg-gray-800 border border-gray-700 text-text-primary text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-50 whitespace-normal break-keep">
                {content}
                <div className="absolute top-full left-[15px] border-4 border-transparent border-t-gray-800" />
            </div>
        </div>
    );
}

// 주간 바 차트 컴포넌트
function WeeklyBarChart({ data, weekOffset, onPrevWeek, onNextWeek }: { 
    data: DailyBarData[]; 
    weekOffset: number;
    onPrevWeek: () => void;
    onNextWeek: () => void;
}) {
    const maxDuration = 9; // 9시간 기준 스케일
    const maxBarHeight = 60; // 바 최대 높이 (픽셀)

    const weekStart = startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    const weekLabel = weekOffset === 0 
        ? '이번 주' 
        : weekOffset === 1 
            ? '지난 주' 
            : `${format(weekStart, 'M/d', { locale: ko })} ~ ${format(weekEnd, 'M/d', { locale: ko })}`;

    return (
        <div className="bg-bg-tertiary/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
                <button 
                    onClick={onPrevWeek}
                    className="p-1 text-text-secondary hover:text-text-primary transition-colors"
                >
                    <ChevronLeft size={16} />
                </button>
                <span className="text-xs text-text-secondary">{weekLabel} 수면</span>
                <button 
                    onClick={onNextWeek}
                    disabled={weekOffset === 0}
                    className={`p-1 transition-colors ${weekOffset === 0 ? 'text-text-tertiary cursor-not-allowed' : 'text-text-secondary hover:text-text-primary'}`}
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* 바 차트 */}
            <div className="flex items-end justify-between gap-1">
                {data.map((day) => {
                    const barHeight = day.duration
                        ? Math.min((day.duration / maxDuration) * maxBarHeight, maxBarHeight)
                        : 0;

                    let barColor = 'bg-bg-tertiary';
                    if (day.status === 'sufficient') barColor = 'bg-green-500';
                    else if (day.status === 'insufficient') barColor = 'bg-red-400';

                    return (
                        <div key={day.date} className="flex-1 flex flex-col items-center">
                            <div className="flex justify-center mb-1" style={{ height: `${maxBarHeight}px`, alignItems: 'flex-end' }}>
                                <div
                                    className={`w-5 rounded-t ${barColor} transition-all`}
                                    style={{ height: `${barHeight}px`, minHeight: day.duration ? '4px' : '2px' }}
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
                <div className="flex items-center">
                    <span className="text-xs text-text-secondary">수면 점수</span>
                    <InfoTooltip content={
                        <div className="space-y-1 text-left">
                            <div className="font-bold text-indigo-300 mb-1">총점 100점 만점</div>
                            <div>• 수면 시간: <span className="text-white">40점</span></div>
                            <div>• 규칙성(목표 달성): <span className="text-white">30점</span> (취침15+기상15)</div>
                            <div>• 일관성(편차): <span className="text-white">30점</span> (취침15+기상15)</div>
                        </div>
                    } />
                </div>
                <span className={`text-2xl font-bold ${getScoreColor(score.total)}`}>
                    {score.total}점
                </span>
            </div>

            {/* 점수 세부 */}
            <div className="space-y-2">
                {/* 수면시간 충족도 */}
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center">
                        <span className="text-text-secondary">수면시간</span>
                        <InfoTooltip content={
                            <div className="space-y-1 text-left">
                                <div className="font-bold text-indigo-300">목표: 7.5시간 (40점)</div>
                                <div className="text-gray-400">7.5시간에서 멀어질수록 감점됩니다.</div>
                                <div>• 1시간 차이: -8점</div>
                                <div>• 30분 차이: -4점</div>
                            </div>
                        } />
                    </div>
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

                {/* 취침 점수 (목표 15 + 일관성 15) */}
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center">
                        <span className="text-text-secondary">취침 규칙성</span>
                        <InfoTooltip content={
                            <div className="space-y-1 text-left">
                                <div className="font-bold text-purple-300">규칙성 30점 만점</div>
                                <div>• <span className="text-white">목표 달성 (15점)</span>: <br />23:00 ~ 00:30 사이 취침</div>
                                <div>• <span className="text-white">일관성 (15점)</span>: <br />매일 비슷한 시간에 자는지 평가 (편차↓ 점수↑)</div>
                            </div>
                        } />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-purple-400 rounded-full"
                                style={{ width: `${((score.sleepRegularity + (score.consistencyScore / 2)) / 30) * 100}%` }}
                            />
                        </div>
                        <span className="w-12 text-right text-text-secondary">{score.sleepRegularity + Math.round(score.consistencyScore / 2)}/30</span>
                    </div>
                </div>

                {/* 기상 점수 (목표 15 + 일관성 15) */}
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center">
                        <span className="text-text-secondary">기상 규칙성</span>
                        <InfoTooltip content={
                            <div className="space-y-1 text-left">
                                <div className="font-bold text-amber-300">규칙성 30점 만점</div>
                                <div>• <span className="text-white">목표 달성 (15점)</span>: <br />06:00 ~ 07:30 사이 기상</div>
                                <div>• <span className="text-white">일관성 (15점)</span>: <br />매일 비슷한 시간에 일어나는지 평가 (편차↓ 점수↑)</div>
                            </div>
                        } />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-amber-400 rounded-full"
                                style={{ width: `${((score.wakeRegularity + (score.consistencyScore / 2)) / 30) * 100}%` }}
                            />
                        </div>
                        <span className="w-12 text-right text-text-secondary">{score.wakeRegularity + Math.round(score.consistencyScore / 2)}/30</span>
                    </div>
                </div>

                {/* 일관성 상세 */}
                <div className="flex justify-end gap-3 mt-1 text-[9px] text-text-secondary">
                    <span>취침 편차: {score.details.sleepConsistency}분</span>
                    <span>기상 편차: {score.details.wakeConsistency}분</span>
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
    const [weekOffset, setWeekOffset] = useState(0);

    const allRecords = useMemo(() => extractSleepRecords(entries), [entries]);

    const stats = useMemo(() => {
        const recentRecords = getRecentRecords(allRecords, 7);
        const monthlyRecords = getRecentRecords(allRecords, 30);
        
        return {
            avgDuration: getAverageDuration(recentRecords),
            avgSleepTime: getAverageSleepTime(recentRecords),
            avgWakeTime: getAverageWakeTime(recentRecords),
            monthlyAvgSleepTime: getAverageSleepTime(monthlyRecords),
            monthlyAvgWakeTime: getAverageWakeTime(monthlyRecords),
            recordCount: recentRecords.length,
        };
    }, [allRecords]);

    const weeklyStats = useMemo(() => {
        const weeklyBar = getWeeklyBarData(allRecords, weekOffset);

        const currentWeekData = getWeeklyRecords(allRecords, weekOffset);
        const prevWeekData = getWeeklyRecords(allRecords, weekOffset + 1);

        const currentWeekScore = calculateSleepScore(currentWeekData.records, prevWeekData.records);
        const prevWeekScore = calculateSleepScore(prevWeekData.records);

        const scoreDiff = currentWeekScore.total - prevWeekScore.total;

        let durationDiff: number | null = null;
        if (currentWeekScore.details.avgDuration !== null && prevWeekScore.details.avgDuration !== null) {
            durationDiff = currentWeekScore.details.avgDuration - prevWeekScore.details.avgDuration;
        }

        let trend: 'improved' | 'declined' | 'stable' = 'stable';
        if (scoreDiff > 5) trend = 'improved';
        else if (scoreDiff < -5) trend = 'declined';

        const comparison: WeeklyComparison = {
            thisWeek: currentWeekScore,
            lastWeek: prevWeekScore,
            scoreDiff,
            durationDiff,
            trend
        };

        const streak = checkWeeklyGoalStreak(allRecords, weekOffset);

        return {
            weeklyBar,
            comparison,
            streak,
        };
    }, [allRecords, weekOffset]);

    // 기록이 없으면 표시하지 않음
    if (stats.recordCount === 0) {
        return null;
    }

    const weekStart = startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    const weekLabel = weekOffset === 0 
        ? '이번 주' 
        : weekOffset === 1 
            ? '지난 주' 
            : `${format(weekStart, 'M/d', { locale: ko })} 주`;

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
                        {weekLabel} {weeklyStats.comparison.thisWeek.total}점
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
                    <WeeklyBarChart 
                        data={weeklyStats.weeklyBar} 
                        weekOffset={weekOffset}
                        onPrevWeek={() => setWeekOffset(prev => prev + 1)}
                        onNextWeek={() => setWeekOffset(prev => Math.max(0, prev - 1))}
                    />
                    <ScoreSection score={weeklyStats.comparison.thisWeek} streak={weeklyStats.streak} />
                    <ComparisonSection comparison={weeklyStats.comparison} />
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
