import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Expense } from '../types/types';

interface ExpenseCalendarProps {
    expenses: Expense[];
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
}

const ExpenseCalendar: React.FC<ExpenseCalendarProps> = ({ expenses, selectedDate, onSelectDate }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [isExpanded, setIsExpanded] = useState(false);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // 일요일 시작
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    // 날짜별 합계를 한 번만 훑어 만들어 둔다.
    // 예전에는 달력 칸(42개)마다 전체 지출을 filter하며 건건이 format()을 호출해
    // 렌더당 O(칸수 × 지출수)의 날짜 포맷이 발생했다. 기록이 쌓이면 모바일에서
    // 렌더 한 번에 수백 ms가 걸려, 달력을 펼쳐둔 채로 스냅샷이 몇 번 들어오면
    // 탭이 수 초간 멈춘 것처럼 보였다.
    const { dayTotals, monthTotal } = useMemo(() => {
        const map = new Map<string, number>();
        let month = 0;
        for (const e of expenses) {
            if (e.amount <= 0) continue;   // 기존 동작 유지: 지출만 합산
            const key = format(e.timestamp, 'yyyy-MM-dd');
            map.set(key, (map.get(key) ?? 0) + e.amount);
            if (isSameMonth(e.timestamp, currentMonth)) month += e.amount;
        }
        return { dayTotals: map, monthTotal: month };
    }, [expenses, currentMonth]);

    const getDayTotal = (date: Date): number => dayTotals.get(format(date, 'yyyy-MM-dd')) ?? 0;

    return (
        <div className="bg-bg-secondary rounded-xl mb-6 overflow-hidden">
            {/* Header - Always visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex justify-between items-center hover:bg-bg-tertiary transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-lg">📅</span>
                    <span className="font-bold text-text-primary">
                        {format(currentMonth, 'yyyy년 M월', { locale: ko })}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-text-secondary">
                        {monthTotal > 0 && `-`}{Math.abs(monthTotal).toLocaleString()}원
                    </span>
                    <ChevronRight
                        size={20}
                        className={`text-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                </div>
            </button>

            {/* Calendar - Collapsible */}
            {isExpanded && (
                <div className="p-4 pt-0 border-t border-bg-tertiary">
                    <div className="flex justify-between items-center mb-4">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentMonth(subMonths(currentMonth, 1));
                            }}
                            className="p-1 text-text-secondary hover:text-text-primary transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <h3 className="text-sm font-medium text-text-primary">
                            {format(currentMonth, 'yyyy년 M월', { locale: ko })}
                        </h3>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentMonth(addMonths(currentMonth, 1));
                            }}
                            className="p-1 text-text-secondary hover:text-text-primary transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                            <div key={day} className="text-center text-xs text-text-secondary font-medium py-1">
                                {day}
                            </div>
                        ))}
                        {days.map(day => {
                            const total = getDayTotal(day);
                            const isSelected = isSameDay(day, selectedDate);
                            const isCurrentMonth = isSameMonth(day, currentMonth);
                            const isHighExpense = total > 15000;

                            return (
                                <button
                                    key={day.toISOString()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectDate(day);
                                    }}
                                    className={`
                                        p-1.5 rounded-lg text-xs transition-all relative
                                        ${isSelected ? 'bg-accent text-white' : 'hover:bg-bg-tertiary'}
                                        ${isToday(day) ? 'ring-1 ring-accent' : ''}
                                        ${isHighExpense && isCurrentMonth ? 'ring-2 ring-red-500' : ''}
                                        ${!isCurrentMonth ? 'text-text-secondary/30' : 'text-text-primary'}
                                    `}
                                >
                                    <div className="font-medium">{format(day, 'd')}</div>
                                    {total !== 0 && isCurrentMonth && (
                                        <div className={`text-[9px] mt-0.5 font-medium ${total < 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {total > 0 ? '-' : '+'}{Math.abs(total).toLocaleString()}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// 지출 배열이 그대로면 다시 그리지 않는다 (부모의 다른 상태 변경에 딸려 재계산되지 않도록)
export default React.memo(ExpenseCalendar);
