import { useState, useEffect, useMemo } from 'react';
import { startOfWeek, endOfWeek, addDays, format, subWeeks, addWeeks, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from './AuthContext';
import { getTodos } from '../services/firestore';
import { parseTodos, calculateWeightedSummary } from '../utils/todoUtils';
import { getLogicalDate } from '../utils/dateUtils';
import type { Todo } from '../types/types';

interface WeeklyProgressProps {
    collectionName?: string;
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export const WeeklyProgress: React.FC<WeeklyProgressProps> = ({ collectionName = 'todos' }) => {
    const { user } = useAuth();
    const [weekOffset, setWeekOffset] = useState(0);
    const [todos, setTodos] = useState<Todo[]>([]);

    const weekStart = useMemo(() => {
        const base = getLogicalDate();
        const shifted = weekOffset === 0 ? base : (weekOffset > 0 ? addWeeks(base, weekOffset) : subWeeks(base, Math.abs(weekOffset)));
        return startOfWeek(shifted, { weekStartsOn: 1 });
    }, [weekOffset]);

    const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);

    useEffect(() => {
        if (!user) return;
        getTodos(user.uid, weekStart, weekEnd, collectionName)
            .then(setTodos)
            .catch(console.error);
    }, [user, weekStart, weekEnd, collectionName]);

    const dailyRates = useMemo(() => {
        return DAY_LABELS.map((_, i) => {
            const day = addDays(weekStart, i);
            const dateStr = format(day, 'yyyy-MM-dd');
            const todo = todos.find(t => t.id === dateStr);
            if (!todo || !todo.content.trim()) return { date: day, dateStr, percentage: -1 }; // -1 = no data
            const items = parseTodos(todo.content);
            if (items.length === 0) return { date: day, dateStr, percentage: -1 };
            const { percentage } = calculateWeightedSummary(items);
            return { date: day, dateStr, percentage };
        });
    }, [weekStart, todos]);

    const weekAvg = useMemo(() => {
        const valid = dailyRates.filter(d => d.percentage >= 0);
        if (valid.length === 0) return 0;
        return Math.round(valid.reduce((s, d) => s + d.percentage, 0) / valid.length);
    }, [dailyRates]);

    const getBarColor = (pct: number) => {
        if (pct >= 90) return 'bg-green-500';
        if (pct >= 70) return 'bg-lime-500';
        if (pct >= 50) return 'bg-yellow-500';
        if (pct >= 25) return 'bg-orange-500';
        return 'bg-red-500/70';
    };

    const weekLabel = `${format(weekStart, 'M/d')}–${format(weekEnd, 'M/d')}`;

    return (
        <div className="bg-bg-secondary/50 rounded-xl p-3 mb-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-secondary">주간 완료율</span>
                    <span className="text-[10px] text-text-tertiary">{weekLabel}</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-accent mr-1">{weekAvg}%</span>
                    <button onClick={() => setWeekOffset(prev => prev - 1)} className="p-0.5 text-text-tertiary hover:text-text-primary transition-colors">
                        <ChevronLeft size={14} />
                    </button>
                    {weekOffset !== 0 && (
                        <button onClick={() => setWeekOffset(0)} className="text-[9px] text-text-tertiary hover:text-accent transition-colors px-1">
                            오늘
                        </button>
                    )}
                    <button onClick={() => setWeekOffset(prev => prev + 1)} className="p-0.5 text-text-tertiary hover:text-text-primary transition-colors">
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
            <div className="flex gap-1.5 items-end h-16">
                {dailyRates.map((day, i) => {
                    const isCurrentDay = isToday(day.date);
                    const hasData = day.percentage >= 0;
                    const barHeight = hasData ? Math.max(day.percentage, 4) : 0;

                    return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full h-12 flex items-end justify-center">
                                {hasData ? (
                                    <div
                                        className={`w-full rounded-sm ${getBarColor(day.percentage)} transition-all duration-300`}
                                        style={{ height: `${barHeight}%` }}
                                        title={`${format(day.date, 'M/d (EEE)', { locale: ko })} - ${day.percentage}%`}
                                    />
                                ) : (
                                    <div className="w-full h-[2px] bg-bg-tertiary rounded-sm" />
                                )}
                            </div>
                            <div className="text-center">
                                <div className={`text-[9px] leading-none ${isCurrentDay ? 'text-accent font-bold' : 'text-text-tertiary'}`}>
                                    {DAY_LABELS[i]}
                                </div>
                                {hasData && (
                                    <div className={`text-[8px] leading-tight mt-0.5 ${day.percentage >= 75 ? 'text-green-400' : 'text-text-tertiary'}`}>
                                        {day.percentage}%
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
