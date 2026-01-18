import React, { useState, useMemo } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Entry, Expense, Todo, Worry, WorryEntry } from '../types/types';
import { exportDailyMarkdown } from '../utils/exportUtils';
import { getLogicalDate } from '../utils/dateUtils';
import { analyzeEmotionsInText, type EmotionTag } from '../utils/emotionTags';

interface UnifiedCalendarModalProps {
    onClose: () => void;
    entries: Entry[];
    books: Entry[];
    expenses: Expense[];
    todos: Todo[];
    worryEntries: WorryEntry[];
    worries: Worry[];
}

type CalendarTab = 'records' | 'emotions';

const UnifiedCalendarModal: React.FC<UnifiedCalendarModalProps> = ({ onClose, entries, books: _books, expenses, todos, worryEntries, worries }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<CalendarTab>('records');

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // 일요일 시작
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const handleCopy = () => {
        if (!selectedDate) return;

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const todo = todos.find(t => t.id === dateStr);
        const markdown = exportDailyMarkdown(selectedDate, entries, [], expenses, todo, worryEntries, worries);
        navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getDayData = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayEntries = entries.filter(e => format(getLogicalDate(e.timestamp), 'yyyy-MM-dd') === dateStr);
        const dayExpenses = expenses.filter(e => format(getLogicalDate(e.timestamp), 'yyyy-MM-dd') === dateStr);
        const dayWorryEntries = worryEntries.filter(e => format(getLogicalDate(e.timestamp), 'yyyy-MM-dd') === dateStr);
        // Lookup by ID (YYYY-MM-DD) instead of date field for robustness
        const dayTodo = todos.find(t => t.id === dateStr);
        const total = dayExpenses
            .filter(e => e.amount > 0)
            .reduce((sum, e) => sum + e.amount, 0);

        return {
            count: dayEntries.length + dayExpenses.length + dayWorryEntries.length + (dayTodo ? 1 : 0),
            total,
            hasData: dayEntries.length > 0 || dayExpenses.length > 0 || dayWorryEntries.length > 0 || !!dayTodo
        };
    };

    // 날짜별 감정 데이터 분석
    const getEmotionData = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayEntries = entries.filter(e => format(getLogicalDate(e.timestamp), 'yyyy-MM-dd') === dateStr);

        let positive: EmotionTag[] = [];
        let negative: EmotionTag[] = [];
        let neutral: EmotionTag[] = [];

        dayEntries.forEach(entry => {
            const analysis = analyzeEmotionsInText(entry.content);
            positive = [...positive, ...analysis.positive];
            negative = [...negative, ...analysis.negative];
            neutral = [...neutral, ...analysis.neutral];
        });

        return {
            positive,
            negative,
            neutral,
            hasEmotions: positive.length > 0 || negative.length > 0 || neutral.length > 0,
            dominant: positive.length > negative.length ? 'positive' :
                negative.length > positive.length ? 'negative' : 'neutral'
        };
    };

    // 선택된 날짜의 감정 태그 빈도 계산
    const getSelectedDateEmotions = useMemo(() => {
        if (!selectedDate) return null;
        const data = getEmotionData(selectedDate);

        // 태그별 빈도수 계산
        const tagCounts = new Map<string, { emotion: EmotionTag; count: number; type: 'positive' | 'negative' | 'neutral' }>();

        const countTags = (emotions: EmotionTag[], type: 'positive' | 'negative' | 'neutral') => {
            emotions.forEach(emotion => {
                const existing = tagCounts.get(emotion.tag);
                if (existing) {
                    existing.count++;
                } else {
                    tagCounts.set(emotion.tag, { emotion, count: 1, type });
                }
            });
        };

        countTags(data.positive, 'positive');
        countTags(data.negative, 'negative');
        countTags(data.neutral, 'neutral');

        return {
            ...data,
            tagCounts: Array.from(tagCounts.values()).sort((a, b) => b.count - a.count)
        };
    }, [selectedDate, entries]);

    const selectedTodo = selectedDate ? todos.find(t => t.id === format(selectedDate, 'yyyy-MM-dd')) : undefined;
    const selectedMarkdown = selectedDate ? exportDailyMarkdown(selectedDate, entries, [], expenses, selectedTodo, worryEntries, worries) : '';

    return (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-bg-secondary rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b border-bg-tertiary">
                    <h2 className="text-xl font-bold text-text-primary">📅 통합 캘린더</h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
                        <X size={24} />
                    </button>
                </div>

                {/* Tab UI */}
                <div className="flex gap-2 px-6 pt-4">
                    <button
                        onClick={() => setActiveTab('records')}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === 'records'
                                ? 'bg-accent text-white'
                                : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        📝 기록
                    </button>
                    <button
                        onClick={() => setActiveTab('emotions')}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === 'emotions'
                                ? 'bg-purple-600 text-white'
                                : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        😊 감정
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
                                const emotionData = getEmotionData(day);
                                const isSelected = selectedDate && isSameDay(day, selectedDate);
                                const isLogicalToday = isSameDay(day, getLogicalDate());

                                return (
                                    <button
                                        key={day.toISOString()}
                                        onClick={() => setSelectedDate(day)}
                                        className={`
                                            p-2 rounded-lg text-sm transition-all relative
                                            ${isSelected ? (activeTab === 'emotions' ? 'bg-purple-600 text-white' : 'bg-accent text-white') : 'hover:bg-bg-tertiary'}
                                            ${isLogicalToday ? (activeTab === 'emotions' ? 'ring-2 ring-purple-500' : 'ring-2 ring-accent') : ''}
                                            ${!isSameMonth(day, currentMonth) ? 'text-text-secondary/30' : 'text-text-primary'}
                                        `}
                                    >
                                        <div>{format(day, 'd')}</div>
                                        {/* Records Tab Content */}
                                        {activeTab === 'records' && dayData.hasData && (
                                            <div className="flex flex-col gap-0.5 mt-1">
                                                <div className="text-[10px] opacity-70">{dayData.count}개</div>
                                                {dayData.total !== 0 && (
                                                    <div className={`text-[10px] font-medium ${dayData.total < 0 ? 'text-green-400' : ''}`}>
                                                        {dayData.total > 0 ? '-' : '+'}{Math.abs(dayData.total).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {/* Emotions Tab Content - 적록색약 대응: 파란색(긍정), 주황색(부정) */}
                                        {activeTab === 'emotions' && emotionData.hasEmotions && (
                                            <div className="flex justify-center mt-1">
                                                <div className={`w-3 h-3 rounded-full ${
                                                    emotionData.dominant === 'positive' ? 'bg-blue-400' :
                                                    emotionData.dominant === 'negative' ? 'bg-orange-400' :
                                                    'bg-gray-400'
                                                }`} />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Selected day details */}
                    {selectedDate && activeTab === 'records' && (
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

                    {/* Selected day emotion details - 적록색약 대응 */}
                    {selectedDate && activeTab === 'emotions' && (
                        <div className="bg-bg-tertiary rounded-lg p-4">
                            <h4 className="font-bold text-text-primary mb-4">
                                {format(selectedDate, 'M월 d일 (eee)', { locale: ko })} 감정
                            </h4>

                            {getSelectedDateEmotions && getSelectedDateEmotions.hasEmotions ? (
                                <div className="space-y-4">
                                    {/* 긍정/부정 요약 */}
                                    <div className="flex gap-4 text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-blue-400" />
                                            <span className="text-blue-400 font-medium">
                                                긍정 {getSelectedDateEmotions.positive.length}개
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-orange-400" />
                                            <span className="text-orange-400 font-medium">
                                                부정 {getSelectedDateEmotions.negative.length}개
                                            </span>
                                        </div>
                                        {getSelectedDateEmotions.neutral.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-gray-400" />
                                                <span className="text-gray-400 font-medium">
                                                    기타 {getSelectedDateEmotions.neutral.length}개
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* 감정 태그 목록 */}
                                    <div className="space-y-2">
                                        {getSelectedDateEmotions.tagCounts.map(({ emotion, count, type }) => (
                                            <div
                                                key={emotion.tag}
                                                className={`flex items-center justify-between p-2 rounded-lg ${
                                                    type === 'positive' ? 'bg-blue-900/20 border border-blue-800/30' :
                                                    type === 'negative' ? 'bg-orange-900/20 border border-orange-800/30' :
                                                    'bg-gray-900/20 border border-gray-800/30'
                                                }`}
                                            >
                                                <div>
                                                    <span className={`text-sm font-medium ${
                                                        type === 'positive' ? 'text-blue-300' :
                                                        type === 'negative' ? 'text-orange-300' :
                                                        'text-gray-300'
                                                    }`}>
                                                        {emotion.tag}
                                                    </span>
                                                    <p className="text-xs text-text-secondary mt-0.5">
                                                        {emotion.meaning}
                                                    </p>
                                                </div>
                                                {count > 1 && (
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                        type === 'positive' ? 'bg-blue-500 text-white' :
                                                        type === 'negative' ? 'bg-orange-500 text-white' :
                                                        'bg-gray-500 text-white'
                                                    }`}>
                                                        {count}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-text-secondary text-sm">이 날짜에 기록된 감정이 없습니다.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UnifiedCalendarModal;
