import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Entry, Expense, Todo } from '../types/types';
import { exportDailyMarkdown } from '../utils/exportUtils';

interface UnifiedCalendarModalProps {
    onClose: () => void;
    entries: Entry[];
    expenses: Expense[];
    todos: Todo[];
}

const UnifiedCalendarModal: React.FC<UnifiedCalendarModalProps> = ({ onClose, entries, expenses, todos }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [copied, setCopied] = useState(false);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // 일요일 시작
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const handleCopy = () => {
        if (!selectedDate) return;

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const todo = todos.find(t => format(t.date, 'yyyy-MM-dd') === dateStr);
        const markdown = exportDailyMarkdown(selectedDate, entries, expenses, todo);
        navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getDayData = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayEntries = entries.filter(e => format(e.timestamp, 'yyyy-MM-dd') === dateStr);
        const dayExpenses = expenses.filter(e => format(e.timestamp, 'yyyy-MM-dd') === dateStr);
        const dayTodo = todos.find(t => format(t.date, 'yyyy-MM-dd') === dateStr);
        const total = dayExpenses.reduce((sum, e) => sum + e.amount, 0);

        return {
            count: dayEntries.length + dayExpenses.length + (dayTodo ? 1 : 0),
            total,
            hasData: dayEntries.length > 0 || dayExpenses.length > 0 || !!dayTodo
        };
    };

    const selectedTodo = selectedDate ? todos.find(t => format(t.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')) : undefined;
    const selectedMarkdown = selectedDate ? exportDailyMarkdown(selectedDate, entries, expenses, selectedTodo) : '';

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-bg-secondary rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b border-bg-tertiary">
                    <h2 className="text-xl font-bold text-text-primary">📅 통합 캘린더</h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                    {/* Calendar */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <button
                                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                                className="text-text-primary hover:text-accent"
                            >
                                ←
                            </button>
                            <h3 className="text-lg font-bold text-text-primary">
                                {format(currentMonth, 'yyyy년 M월', { locale: ko })}
                            </h3>
                            <button
                                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                                className="text-text-primary hover:text-accent"
                            >
                                →
                            </button>
                        </div>

                        <div className="grid grid-cols-7 gap-2">
                            {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                                <div key={day} className="text-center text-xs text-text-secondary font-medium py-2">
                                    {day}
                                </div>
                            ))}
                            {days.map(day => {
                                const dayData = getDayData(day);
                                const isSelected = selectedDate && isSameDay(day, selectedDate);

                                return (
                                    <button
                                        key={day.toISOString()}
                                        onClick={() => setSelectedDate(day)}
                                        className={`
                                            p-2 rounded-lg text-sm transition-all relative
                                            ${isSelected ? 'bg-accent text-white' : 'hover:bg-bg-tertiary'}
                                            ${isToday(day) ? 'ring-2 ring-accent' : ''}
                                            ${!isSameMonth(day, currentMonth) ? 'text-text-secondary/30' : 'text-text-primary'}
                                        `}
                                    >
                                        <div>{format(day, 'd')}</div>
                                        {dayData.hasData && (
                                            <div className="flex flex-col gap-0.5 mt-1">
                                                <div className="text-[10px] opacity-70">{dayData.count}개</div>
                                                {dayData.total !== 0 && (
                                                    <div className={`text-[10px] font-medium ${dayData.total < 0 ? 'text-green-400' : ''}`}>
                                                        {dayData.total > 0 ? '-' : '+'}{Math.abs(dayData.total).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Selected day details */}
                    {selectedDate && (
                        <div className="bg-bg-tertiary rounded-lg p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-text-primary">
                                    {format(selectedDate, 'M월 d일 (eee)', { locale: ko })}
                                </h4>
                                <button
                                    onClick={handleCopy}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${copied
                                        ? 'bg-green-500 text-white'
                                        : 'bg-accent text-white hover:bg-opacity-90'
                                        }`}
                                >
                                    {copied ? <><Check size={16} /> 복사됨</> : <><Copy size={16} /> 마크다운 복사</>}
                                </button>
                            </div>

                            {selectedMarkdown ? (
                                <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono bg-bg-primary p-3 rounded">
                                    {selectedMarkdown}
                                </pre>
                            ) : (
                                <p className="text-text-secondary text-sm">이 날짜에 기록이 없습니다.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UnifiedCalendarModal;
