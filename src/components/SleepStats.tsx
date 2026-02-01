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
interface WeeklyTrendData {
    label: string;
    score: number;
    isCurrentView: boolean;
}

function WeeklyTrendSection({ weeks }: { weeks: WeeklyTrendData[] }) {
    const validScores = weeks.filter(w => w.score > 0).map(w => w.score);
    const maxScore = Math.max(...validScores, 100);
    const minScore = Math.min(...validScores, 0);
    const range = Math.max(maxScore - minScore, 30);
    
    const getYPosition = (score: number) => {
        if (score === 0) return 85;
        const normalized = (score - minScore) / range;
        return 85 - (normalized * 50);
    };

    const getScoreColor = (score: number) => {
        if (score === 0) return '#4b5563';
        if (score >= 70) return '#34d399';
        if (score >= 50) return '#fbbf24';
        return '#f87171';
    };

    const currentIdx = weeks.findIndex(w => w.isCurrentView);
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : -1;
    const scoreDiff = prevIdx >= 0 && weeks[prevIdx].score > 0 
        ? weeks[currentIdx].score - weeks[prevIdx].score 
        : null;

    const points = weeks.map((week, idx) => ({
        x: 12.5 + idx * 25,
        y: getYPosition(week.score),
        score: week.score,
        color: getScoreColor(week.score),
        isCurrentView: week.isCurrentView,
        label: week.label
    }));

    const linePath = points
        .filter(p => p.score > 0)
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
        .join(' ');

    return (
        <div className="bg-bg-tertiary/30 rounded-xl p-4">
            <div className="text-[11px] text-text-secondary/70 mb-2 font-medium">4주 흐름</div>
            
            <div className="relative h-24">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
                        </linearGradient>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    
                    {linePath && (
                        <path
                            d={linePath}
                            fill="none"
                            stroke="url(#lineGradient)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}
                    
                    {points.map((point, idx) => (
                        <g key={idx}>
                            {point.score > 0 && (
                                <>
                                    <circle
                                        cx={point.x}
                                        cy={point.y}
                                        r={point.isCurrentView ? 4 : 2.5}
                                        fill={point.color}
                                        filter={point.isCurrentView ? "url(#glow)" : undefined}
                                        className="transition-all duration-300"
                                    />
                                    {point.isCurrentView && (
                                        <circle
                                            cx={point.x}
                                            cy={point.y}
                                            r="6"
                                            fill="none"
                                            stroke={point.color}
                                            strokeWidth="1"
                                            opacity="0.4"
                                        />
                                    )}
                                </>
                            )}
                        </g>
                    ))}
                </svg>
                
                <div className="absolute inset-x-0 top-0 flex justify-between px-1">
                    {points.map((point, idx) => (
                        <div key={idx} className="flex-1 text-center">
                            <span 
                                className={`text-[11px] font-semibold ${point.isCurrentView ? 'text-indigo-300' : ''}`}
                                style={{ color: point.isCurrentView ? undefined : point.color }}
                            >
                                {point.score > 0 ? point.score : '-'}
                            </span>
                        </div>
                    ))}
                </div>
                
                <div className="absolute inset-x-0 bottom-0 flex justify-between px-1">
                    {points.map((point, idx) => (
                        <div key={idx} className="flex-1 text-center">
                            <span className={`text-[10px] ${point.isCurrentView ? 'text-indigo-400 font-medium' : 'text-text-secondary/60'}`}>
                                {point.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {scoreDiff !== null && (
                <div className="flex items-center justify-center gap-1.5 mt-1 pt-2 border-t border-white/5">
                    {scoreDiff > 0 ? (
                        <TrendingUp size={11} className="text-emerald-400" />
                    ) : scoreDiff < 0 ? (
                        <TrendingDown size={11} className="text-red-400" />
                    ) : (
                        <Minus size={11} className="text-text-secondary/50" />
                    )}
                    <span className={`text-[11px] font-medium ${scoreDiff > 0 ? 'text-emerald-400' : scoreDiff < 0 ? 'text-red-400' : 'text-text-secondary/50'}`}>
                        지난주 대비 {scoreDiff > 0 ? '+' : ''}{scoreDiff}점
                    </span>
                </div>
            )}
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

        // 4주 데이터 계산 (현재 보고 있는 주 기준 ±1~2주)
        const weeksToShow = 4;
        const weekScores: WeeklyTrendData[] = [];
        
        let currentWeekFullScore: ReturnType<typeof calculateSleepScore> | null = null;
        
        for (let i = weeksToShow - 1; i >= 0; i--) {
            const offset = weekOffset + i;
            const weekData = getWeeklyRecords(allRecords, offset);
            const contextData = getWeeklyRecords(allRecords, offset + 1);
            const score = calculateSleepScore(weekData.records, contextData.records);
            
            if (i === 0) {
                currentWeekFullScore = score;
            }
            
            const weekStartDate = startOfWeek(subWeeks(new Date(), offset), { weekStartsOn: 1 });
            let label: string;
            if (offset === 0) {
                label = '이번주';
            } else if (offset === 1) {
                label = '지난주';
            } else {
                label = format(weekStartDate, 'M/d', { locale: ko });
            }
            
            weekScores.push({
                label,
                score: score.total,
                isCurrentView: i === 0
            });
        }

        const streak = checkWeeklyGoalStreak(allRecords, weekOffset);

        return {
            weeklyBar,
            weekScores,
            currentScore: currentWeekFullScore!,
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
                        {weekLabel} {weeklyStats.currentScore.total}점
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
                    <ScoreSection score={weeklyStats.currentScore} streak={weeklyStats.streak} />
                    <WeeklyTrendSection weeks={weeklyStats.weekScores} />
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
