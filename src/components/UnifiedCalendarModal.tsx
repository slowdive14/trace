import React, { useState, useMemo, useEffect } from 'react';
import { X, Copy, Check, ChevronDown, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Entry, Expense, Todo, Worry, WorryEntry, MonthlyInsight, MonthlyReview } from '../types/types';
import { exportDailyMarkdown } from '../utils/exportUtils';
import { getLogicalDate } from '../utils/dateUtils';
import { getRepresentativePhotoByDate } from '../utils/photoUtils';
import { analyzeEmotionsInText, moodMeterQuadrants, getMoodQuadrantKey, getEmotionName, type EmotionTag } from '../utils/emotionTags';
import { getReflections, getMonthlyInsight, saveMonthlyInsight } from '../services/firestore';
import { analyzeMonth } from '../services/gemini';
import { useAuth } from './AuthContext';

// 이번 달 기분 흐름 라인 차트 (일일 긍정−부정 점수)
const MoodTrendChart: React.FC<{ data: { net: number; total: number }[]; maxNet: number }> = ({ data, maxNet }) => {
    const W = 600, H = 80, pad = 10;
    const n = data.length;
    const zeroY = H / 2;
    const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (W - 2 * pad);
    const y = (net: number) => zeroY - (net / maxNet) * (H / 2 - pad);
    const linePoints = data.map((d, i) => `${x(i).toFixed(1)},${y(d.net).toFixed(1)}`).join(' ');
    const areaPath = `M ${x(0).toFixed(1)},${zeroY} L ${linePoints.split(' ').join(' L ')} L ${x(n - 1).toFixed(1)},${zeroY} Z`;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
            <defs>
                <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.55" />
                    <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.05" />
                    <stop offset="50%" stopColor="#fb923c" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#fb923c" stopOpacity="0.55" />
                </linearGradient>
            </defs>
            <line x1={pad} y1={zeroY} x2={W - pad} y2={zeroY} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="4 4" />
            <path d={areaPath} fill="url(#moodGrad)" />
            <polyline points={linePoints} fill="none" stroke="#a78bfa" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            {data.map((d, i) => d.total > 0 ? (
                <circle key={i} cx={x(i)} cy={y(d.net)} r="2.5" fill={d.net > 0 ? '#60a5fa' : d.net < 0 ? '#fb923c' : '#9ca3af'} vectorEffect="non-scaling-stroke" />
            ) : null)}
        </svg>
    );
};

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
    const { user } = useAuth();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<CalendarTab>('records');
    const [reflections, setReflections] = useState<Record<string, string>>({});

    // AI 월간 회고 상태
    const [monthlyInsight, setMonthlyInsight] = useState<MonthlyInsight | null>(null);
    const [insightLoading, setInsightLoading] = useState(false);
    const [insightError, setInsightError] = useState<string | null>(null);
    // 수정·피드백 루프
    const [isEditingReview, setIsEditingReview] = useState(false);
    const [editedReview, setEditedReview] = useState<MonthlyReview | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedbackNote, setFeedbackNote] = useState('');

    useEffect(() => {
        if (!user) return;
        getReflections(user.uid).then(items => {
            const map: Record<string, string> = {};
            items.forEach(r => { map[r.id] = r.content; });
            setReflections(map);
        });
    }, [user]);

    // 월 변경 시 저장된 회고 불러오기
    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        setMonthlyInsight(null);
        setInsightError(null);
        setIsEditingReview(false);
        setEditedReview(null);
        setShowFeedback(false);
        setFeedbackNote('');
        getMonthlyInsight(user.uid, format(currentMonth, 'yyyy-MM'))
            .then(ins => { if (!cancelled) setMonthlyInsight(ins); })
            .catch(() => { });
        return () => { cancelled = true; };
    }, [user, currentMonth]);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // 일요일 시작
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const handleCopy = () => {
        if (!selectedDate) return;

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const todo = todos.find(t => t.id === dateStr);
        const markdown = exportDailyMarkdown(selectedDate, entries, [], expenses, todo, worryEntries, worries, reflections[dateStr]);
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

        // Inline getEmotionData logic to ensure proper dependency tracking
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
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

        const data = {
            positive,
            negative,
            neutral,
            hasEmotions: positive.length > 0 || negative.length > 0 || neutral.length > 0,
            dominant: positive.length > negative.length ? 'positive' :
                negative.length > positive.length ? 'negative' : 'neutral'
        };

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

    // 이번 달 감정 집계 (흐름 차트 + 요약 대시보드용)
    const monthEmotionStats = useMemo(() => {
        const mStart = startOfMonth(currentMonth);
        const mEnd = endOfMonth(currentMonth);
        const monthDays = eachDayOfInterval({ start: mStart, end: mEnd });

        const perDay: { net: number; total: number }[] = [];
        let totalPos = 0, totalNeg = 0, totalNeu = 0;
        const quadrantCounts: Record<string, number> = { highNegative: 0, highPositive: 0, lowNegative: 0, lowPositive: 0 };
        const tagCounts = new Map<string, { emotion: EmotionTag; count: number }>();

        monthDays.forEach((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayEntries = entries.filter(e => format(getLogicalDate(e.timestamp), 'yyyy-MM-dd') === dateStr);
            let pos = 0, neg = 0, neu = 0;
            dayEntries.forEach(entry => {
                const a = analyzeEmotionsInText(entry.content);
                pos += a.positive.length;
                neg += a.negative.length;
                neu += a.neutral.length;
                a.all.forEach(emo => {
                    const ex = tagCounts.get(emo.tag);
                    if (ex) ex.count++; else tagCounts.set(emo.tag, { emotion: emo, count: 1 });
                    const qk = getMoodQuadrantKey(emo.tag);
                    if (qk) quadrantCounts[qk]++;
                });
            });
            totalPos += pos; totalNeg += neg; totalNeu += neu;
            perDay.push({ net: pos - neg, total: pos + neg + neu });
        });

        const total = totalPos + totalNeg + totalNeu;
        const topEmotions = [...tagCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
        const maxNet = Math.max(1, ...perDay.map(d => Math.abs(d.net)));

        return { perDay, totalPos, totalNeg, totalNeu, total, quadrantCounts, topEmotions, maxNet };
    }, [entries, currentMonth]);

    // 날짜별 "오늘의 한 장" 대표 사진 (기록 탭 셀 썸네일용)
    const representativePhotos = useMemo(() => getRepresentativePhotoByDate(entries), [entries]);

    // 이번 달 전체 기록 수 (회고 재생성 판단용)
    const monthEntryCount = useMemo(() => {
        const mStart = startOfMonth(currentMonth);
        const mEnd = endOfMonth(currentMonth);
        return entries.filter(e => {
            const d = getLogicalDate(e.timestamp);
            return d >= mStart && d <= mEnd;
        }).length;
    }, [entries, currentMonth]);

    const handleGenerateMonthly = async (feedback?: string) => {
        if (!user || insightLoading) return;
        setInsightLoading(true);
        setInsightError(null);
        setIsEditingReview(false);
        try {
            const monthKey = format(currentMonth, 'yyyy-MM');
            const monthLabel = format(currentMonth, 'yyyy년 M월', { locale: ko });
            const s = monthEmotionStats;
            const statsText = [
                `총 감정 기록 ${s.total}개 (긍정 ${s.totalPos}, 부정 ${s.totalNeg}, 중립 ${s.totalNeu})`,
                `무드미터 분포 - 활기·긍정 ${s.quadrantCounts.highPositive}, 활기·부정 ${s.quadrantCounts.highNegative}, 차분·긍정 ${s.quadrantCounts.lowPositive}, 차분·부정 ${s.quadrantCounts.lowNegative}`,
                `많이 느낀 감정 - ${s.topEmotions.map(t => `${getEmotionName(t.emotion.tag)}(${t.count})`).join(', ') || '없음'}`,
            ].join('\n');

            const mStart = startOfMonth(currentMonth);
            const mEnd = endOfMonth(currentMonth);
            const inMonth = (ts: Date) => { const d = getLogicalDate(ts); return d >= mStart && d <= mEnd; };
            const byTime = (a: { timestamp: Date }, b: { timestamp: Date }) => a.timestamp.getTime() - b.timestamp.getTime();

            // 일상·생각 기록 + 각 기록에 태깅된 감정 추출 (감정→출처 매핑으로 오귀인 방지)
            const monthEntries = entries.filter(e => inMonth(e.timestamp)).sort(byTime);
            const entryEmotions = monthEntries.map(e => ({ e, emotions: analyzeEmotionsInText(e.content).all }));

            // (C) 감정이 직접 태깅된 기록 — 트리거 분석의 유일한 근거
            const emotionTaggedText = entryEmotions
                .filter(x => x.emotions.length > 0)
                .map(x => `[${format(x.e.timestamp, 'M/d(EEE) HH:mm', { locale: ko })}] 감정[${x.emotions.map(em => getEmotionName(em.tag)).join(', ')}] — ${x.e.content}`)
                .join('\n');

            // 감정 태그 없는 일상·생각 (배경 맥락)
            const bgEntriesText = entryEmotions
                .filter(x => x.emotions.length === 0)
                .map(x => `[${format(x.e.timestamp, 'M/d(EEE) HH:mm', { locale: ko })}] ${x.e.content}`)
                .join('\n');

            // 지출 (그날 무엇을 했는지 배경 단서)
            const monthExpenses = expenses.filter(e => inMonth(e.timestamp)).sort(byTime);
            const expensesText = monthExpenses
                .map(e => `[${format(e.timestamp, 'M/d HH:mm', { locale: ko })}] ${e.description} ${e.amount.toLocaleString()}원${e.category ? ` (${e.category})` : ''}`)
                .join('\n');

            // 고민
            const monthWorry = worryEntries.filter(w => inMonth(w.timestamp)).sort(byTime);
            const worryText = monthWorry
                .map(w => `[${format(w.timestamp, 'M/d', { locale: ko })}] (${w.type}) ${w.content}`)
                .join('\n');

            const recordsText = [
                `## 감정이 직접 기록된 항목 (triggers는 반드시 이 항목들에만 근거할 것)\n${emotionTaggedText || '(없음)'}`,
                bgEntriesText ? `## 배경 맥락 — 그 외 일상·생각 기록\n${bgEntriesText}` : '',
                monthExpenses.length ? `## 배경 맥락 — 지출 기록\n${expensesText}` : '',
                monthWorry.length ? `## 배경 맥락 — 고민 기록\n${worryText}` : '',
            ].filter(Boolean).join('\n\n').slice(0, 40000);

            const review = await analyzeMonth(monthLabel, statsText, recordsText, feedback);
            await saveMonthlyInsight(user.uid, monthKey, review, monthEntries.length);
            setMonthlyInsight({ id: monthKey, review, entryCount: monthEntries.length, generatedAt: new Date() });
            setShowFeedback(false);
            setFeedbackNote('');
        } catch (e) {
            const msg = e instanceof Error ? e.message : '';
            setInsightError(msg.includes('API key')
                ? 'Gemini API 키가 설정되지 않았습니다. 설정(⚙️)에서 키를 입력해주세요.'
                : '분석에 실패했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setInsightLoading(false);
        }
    };

    // 회고 직접 편집
    const startEditReview = () => {
        if (!monthlyInsight) return;
        setEditedReview(JSON.parse(JSON.stringify(monthlyInsight.review)));
        setShowFeedback(false);
        setIsEditingReview(true);
    };

    const cancelEditReview = () => {
        setIsEditingReview(false);
        setEditedReview(null);
    };

    const saveEditedReview = async () => {
        if (!user || !editedReview || !monthlyInsight) return;
        const monthKey = format(currentMonth, 'yyyy-MM');
        const cleaned: MonthlyReview = {
            moodSummary: editedReview.moodSummary.trim(),
            triggers: editedReview.triggers.filter(t => (t.trigger || '').trim()).map(t => ({ ...t, trigger: t.trigger.trim() })),
            patterns: editedReview.patterns.map(s => s.trim()).filter(Boolean),
            positives: editedReview.positives.map(s => s.trim()).filter(Boolean),
            challenges: editedReview.challenges.map(s => s.trim()).filter(Boolean),
            insights: editedReview.insights.map(s => s.trim()).filter(Boolean),
            suggestion: editedReview.suggestion.trim(),
        };
        try {
            await saveMonthlyInsight(user.uid, monthKey, cleaned, monthlyInsight.entryCount);
            setMonthlyInsight({ ...monthlyInsight, review: cleaned, generatedAt: new Date() });
            setIsEditingReview(false);
            setEditedReview(null);
        } catch {
            setInsightError('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
        }
    };

    // editedReview 부분 수정 헬퍼
    type ListKey = 'patterns' | 'positives' | 'challenges' | 'insights';
    const editListItem = (key: ListKey, i: number, value: string) =>
        setEditedReview(prev => prev ? { ...prev, [key]: prev[key].map((v, idx) => idx === i ? value : v) } : prev);
    const removeListItem = (key: ListKey, i: number) =>
        setEditedReview(prev => prev ? { ...prev, [key]: prev[key].filter((_, idx) => idx !== i) } : prev);
    const editTrigger = (i: number, value: string) =>
        setEditedReview(prev => prev ? { ...prev, triggers: prev.triggers.map((t, idx) => idx === i ? { ...t, trigger: value } : t) } : prev);
    const removeTrigger = (i: number) =>
        setEditedReview(prev => prev ? { ...prev, triggers: prev.triggers.filter((_, idx) => idx !== i) } : prev);

    const insightStale = monthlyInsight !== null && monthEntryCount > monthlyInsight.entryCount;

    const renderInsightList = (title: string, items: string[], colorClass: string) => {
        if (!items || items.length === 0) return null;
        return (
            <div>
                <div className={`text-xs font-semibold mb-1.5 ${colorClass}`}>{title}</div>
                <ul className="space-y-1">
                    {items.map((it, i) => (
                        <li key={i} className="text-sm text-text-primary flex gap-2 leading-relaxed">
                            <span className="text-text-secondary mt-0.5 shrink-0">·</span>
                            <span>{it}</span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    // 편집 모드용 리스트 (각 항목 수정/삭제)
    const renderEditList = (title: string, key: ListKey) => {
        if (!editedReview) return null;
        const items = editedReview[key];
        return (
            <div>
                <div className="text-xs font-semibold text-text-secondary mb-1.5">{title}</div>
                <div className="space-y-1.5">
                    {items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <textarea
                                value={item}
                                onChange={e => editListItem(key, i, e.target.value)}
                                rows={2}
                                className="flex-1 text-sm bg-bg-primary rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent text-text-primary"
                            />
                            <button onClick={() => removeListItem(key, i)} className="text-text-secondary hover:text-red-400 p-1 shrink-0 mt-1" aria-label="삭제">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                    {items.length === 0 && <div className="text-xs text-text-secondary/60">(항목 없음)</div>}
                </div>
            </div>
        );
    };

    const selectedTodo = selectedDate ? todos.find(t => t.id === format(selectedDate, 'yyyy-MM-dd')) : undefined;
    const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
    const selectedMarkdown = selectedDate ? exportDailyMarkdown(selectedDate, entries, [], expenses, selectedTodo, worryEntries, worries, reflections[selectedDateStr]) : '';

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
                    {/* 이번 달 기분 흐름 */}
                    {activeTab === 'emotions' && monthEmotionStats.total > 0 && (
                        <div className="mb-5 bg-bg-tertiary rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-text-secondary">이번 달 기분 흐름</span>
                                <span className="text-[10px] text-text-secondary">
                                    <span className="text-blue-400">▲ 긍정</span> · <span className="text-orange-400">▼ 부정</span>
                                </span>
                            </div>
                            <MoodTrendChart data={monthEmotionStats.perDay} maxNet={monthEmotionStats.maxNet} />
                            <div className="flex justify-between text-[10px] text-text-secondary mt-0.5 px-1">
                                <span>1일</span>
                                <span>{monthEmotionStats.perDay.length}일</span>
                            </div>
                        </div>
                    )}

                    {/* Calendar */}
                    <div className="mb-6">
                        <div className="relative flex justify-between items-center mb-4">
                            <button
                                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                                className="text-text-primary hover:text-accent px-2"
                                aria-label="이전 달"
                            >
                                ←
                            </button>
                            <button
                                onClick={() => { setPickerYear(currentMonth.getFullYear()); setShowMonthPicker(v => !v); }}
                                className="text-lg font-bold text-text-primary hover:text-accent flex items-center gap-1"
                            >
                                {format(currentMonth, 'yyyy년 M월', { locale: ko })}
                                <ChevronDown size={16} className={`transition-transform ${showMonthPicker ? 'rotate-180' : ''}`} />
                            </button>
                            <button
                                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                                className="text-text-primary hover:text-accent px-2"
                                aria-label="다음 달"
                            >
                                →
                            </button>

                            {/* 월 선택 드롭다운 (빠른 이동) */}
                            {showMonthPicker && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setShowMonthPicker(false)} />
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-30 bg-bg-secondary border border-bg-tertiary rounded-xl shadow-2xl p-3 w-64">
                                        <div className="flex items-center justify-between mb-2.5">
                                            <button onClick={() => setPickerYear(y => y - 1)} className="px-2.5 py-1 rounded-lg hover:bg-bg-tertiary text-text-primary text-lg" aria-label="이전 해">‹</button>
                                            <span className="font-bold text-text-primary">{pickerYear}년</span>
                                            <button onClick={() => setPickerYear(y => y + 1)} className="px-2.5 py-1 rounded-lg hover:bg-bg-tertiary text-text-primary text-lg" aria-label="다음 해">›</button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {Array.from({ length: 12 }, (_, m) => {
                                                const isCurrent = currentMonth.getFullYear() === pickerYear && currentMonth.getMonth() === m;
                                                return (
                                                    <button
                                                        key={m}
                                                        onClick={() => {
                                                            setCurrentMonth(new Date(pickerYear, m, 1));
                                                            setSelectedDate(null);
                                                            setShowMonthPicker(false);
                                                        }}
                                                        className={`py-2 rounded-lg text-sm transition-colors ${isCurrent ? 'bg-purple-600 text-white font-bold' : 'text-text-primary hover:bg-bg-tertiary'}`}
                                                    >
                                                        {m + 1}월
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
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
                                const repPhoto = representativePhotos[format(day, 'yyyy-MM-dd')];

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
                                        {/* 기록 탭: "오늘의 한 장" 대표 사진을 셀 배경으로 (날짜·개수는 위에 표시) */}
                                        {activeTab === 'records' && repPhoto && !isSelected && (
                                            <img
                                                src={repPhoto.url}
                                                alt=""
                                                className="absolute inset-0 w-full h-full object-cover rounded-lg pointer-events-none opacity-40"
                                            />
                                        )}
                                        {activeTab === 'emotions' && emotionData.hasEmotions && !isSelected && (
                                            <div
                                                className="absolute inset-0 rounded-lg pointer-events-none"
                                                style={{
                                                    backgroundColor: emotionData.dominant === 'positive' ? '#60a5fa' : emotionData.dominant === 'negative' ? '#fb923c' : '#9ca3af',
                                                    opacity: Math.min(0.3, 0.08 + (emotionData.positive.length + emotionData.negative.length + emotionData.neutral.length) * 0.045),
                                                }}
                                            />
                                        )}
                                        <div className="relative">{format(day, 'd')}</div>
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
                                            <div className="relative mt-1 flex flex-col items-center gap-0.5">
                                                <div
                                                    className="flex h-1.5 rounded-full overflow-hidden bg-bg-primary/40"
                                                    style={{ width: `${Math.min(26, 8 + (emotionData.positive.length + emotionData.negative.length + emotionData.neutral.length) * 3)}px` }}
                                                >
                                                    {emotionData.positive.length > 0 && <div className="bg-blue-400" style={{ flex: emotionData.positive.length }} />}
                                                    {emotionData.neutral.length > 0 && <div className="bg-gray-400" style={{ flex: emotionData.neutral.length }} />}
                                                    {emotionData.negative.length > 0 && <div className="bg-orange-400" style={{ flex: emotionData.negative.length }} />}
                                                </div>
                                                <span className="text-[9px] leading-none opacity-60">
                                                    {emotionData.positive.length + emotionData.negative.length + emotionData.neutral.length}
                                                </span>
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

                    {/* 이달 감정 요약 대시보드 (날짜 미선택 시) */}
                    {!selectedDate && activeTab === 'emotions' && (
                        <div className="bg-bg-tertiary rounded-lg p-4 space-y-5">
                            <h4 className="font-bold text-text-primary">
                                {format(currentMonth, 'yyyy년 M월', { locale: ko })} 감정 요약
                            </h4>

                            {monthEmotionStats.total === 0 ? (
                                <p className="text-text-secondary text-sm">
                                    이번 달 기록된 감정이 없습니다. 날짜를 눌러 자세히 보거나 감정을 기록해보세요.
                                </p>
                            ) : (
                                <>
                                    {/* 긍정 : 부정 비율 */}
                                    <div>
                                        <div className="flex justify-between text-xs mb-1.5">
                                            <span className="text-blue-400 font-medium">긍정 {monthEmotionStats.totalPos}</span>
                                            <span className="text-text-secondary">총 {monthEmotionStats.total}개</span>
                                            <span className="text-orange-400 font-medium">부정 {monthEmotionStats.totalNeg}</span>
                                        </div>
                                        <div className="flex h-2.5 rounded-full overflow-hidden bg-bg-primary">
                                            {monthEmotionStats.totalPos > 0 && <div className="bg-blue-400" style={{ flex: monthEmotionStats.totalPos }} />}
                                            {monthEmotionStats.totalNeu > 0 && <div className="bg-gray-400" style={{ flex: monthEmotionStats.totalNeu }} />}
                                            {monthEmotionStats.totalNeg > 0 && <div className="bg-orange-400" style={{ flex: monthEmotionStats.totalNeg }} />}
                                        </div>
                                    </div>

                                    {/* 무드미터 2x2 분포 */}
                                    <div>
                                        <div className="text-xs text-text-secondary mb-2">무드미터 분포 <span className="opacity-60">(복합·중간 제외)</span></div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {moodMeterQuadrants.map(q => (
                                                <div key={q.key} className={`p-2.5 rounded-lg border ${q.border} ${q.cellBg} flex items-center justify-between`}>
                                                    <span className="text-xs font-semibold text-text-primary">{q.energyIcon} {q.label}</span>
                                                    <span className="text-lg font-bold text-text-primary">{monthEmotionStats.quadrantCounts[q.key]}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 이달 많이 느낀 감정 Top 5 */}
                                    <div>
                                        <div className="text-xs text-text-secondary mb-2">이달 많이 느낀 감정</div>
                                        <div className="space-y-1.5">
                                            {monthEmotionStats.topEmotions.map(({ emotion, count }) => (
                                                <div key={emotion.tag} className="flex items-center gap-2">
                                                    <span className="text-base w-5 text-center">{emotion.emoji}</span>
                                                    <span className="text-sm w-16 shrink-0 truncate">{getEmotionName(emotion.tag)}</span>
                                                    <div className="flex-1 h-2 bg-bg-primary rounded-full overflow-hidden">
                                                        <div className="h-full bg-purple-400 rounded-full" style={{ width: `${(count / monthEmotionStats.topEmotions[0].count) * 100}%` }} />
                                                    </div>
                                                    <span className="text-xs text-text-secondary w-6 text-right">{count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* AI 월간 회고 (날짜 미선택 시) */}
                    {!selectedDate && activeTab === 'emotions' && (
                        <div className="bg-bg-tertiary rounded-lg p-4 mt-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-text-primary">✨ {format(currentMonth, 'M월', { locale: ko })} AI 회고</h4>
                                {monthlyInsight && !insightLoading && !isEditingReview && (
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={startEditReview}
                                            className="text-xs text-text-secondary hover:text-accent transition-colors"
                                        >
                                            ✏️ 편집
                                        </button>
                                        <button
                                            onClick={() => setShowFeedback(v => !v)}
                                            className={`text-xs transition-colors ${showFeedback ? 'text-purple-300 font-semibold' : 'text-text-secondary hover:text-accent'}`}
                                        >
                                            🔧 피드백
                                        </button>
                                        <button
                                            onClick={() => handleGenerateMonthly()}
                                            className={`text-xs transition-colors ${insightStale ? 'text-accent font-semibold' : 'text-text-secondary hover:text-accent'}`}
                                        >
                                            {insightStale ? '🔄 새 기록 반영' : '다시 생성'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {insightLoading ? (
                                <div className="text-sm text-text-secondary py-6 text-center animate-pulse">
                                    한 달을 천천히 돌아보는 중...
                                </div>
                            ) : insightError ? (
                                <div className="space-y-3">
                                    <p className="text-sm text-red-400">{insightError}</p>
                                    <button onClick={() => handleGenerateMonthly()} className="text-xs text-accent hover:underline">다시 시도</button>
                                </div>
                            ) : monthlyInsight && isEditingReview && editedReview ? (
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-xs font-semibold text-text-secondary mb-1">감정 흐름</div>
                                        <textarea
                                            value={editedReview.moodSummary}
                                            onChange={e => setEditedReview(prev => prev ? { ...prev, moodSummary: e.target.value } : prev)}
                                            rows={3}
                                            className="w-full text-sm bg-bg-primary rounded-lg p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-accent text-text-primary"
                                        />
                                    </div>

                                    {editedReview.triggers.length > 0 && (
                                        <div>
                                            <div className="text-xs font-semibold mb-1.5 text-rose-300">🎯 감정 트리거</div>
                                            <div className="space-y-1.5">
                                                {editedReview.triggers.map((t, i) => (
                                                    <div key={i} className="bg-bg-primary/40 rounded-lg p-2">
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-sm font-medium text-text-primary shrink-0 mt-1.5">{t.emotion}</span>
                                                            <textarea
                                                                value={t.trigger}
                                                                onChange={e => editTrigger(i, e.target.value)}
                                                                rows={2}
                                                                className="flex-1 text-sm bg-bg-primary rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent text-text-primary"
                                                            />
                                                            <button onClick={() => removeTrigger(i)} className="text-text-secondary hover:text-red-400 p-1 shrink-0 mt-1" aria-label="삭제">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                        {t.source && <div className="text-[11px] text-text-secondary mt-1 pl-1">📎 {t.source}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {renderEditList('🔁 패턴', 'patterns')}
                                    {renderEditList('🌤️ 좋았던 점', 'positives')}
                                    {renderEditList('🌧️ 힘들었던 점', 'challenges')}
                                    {renderEditList('💡 통찰', 'insights')}

                                    <div>
                                        <div className="text-xs font-semibold text-accent mb-1">🌱 다음 달 제안</div>
                                        <textarea
                                            value={editedReview.suggestion}
                                            onChange={e => setEditedReview(prev => prev ? { ...prev, suggestion: e.target.value } : prev)}
                                            rows={2}
                                            className="w-full text-sm bg-bg-primary rounded-lg p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-accent text-text-primary"
                                        />
                                    </div>

                                    <div className="flex gap-2 justify-end pt-1">
                                        <button onClick={cancelEditReview} className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">취소</button>
                                        <button onClick={saveEditedReview} className="px-4 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors">저장</button>
                                    </div>
                                </div>
                            ) : monthlyInsight ? (
                                <div className="space-y-4">
                                    {showFeedback && (
                                        <div className="bg-bg-primary/40 border border-purple-500/30 rounded-lg p-3 space-y-2">
                                            <div className="text-xs font-semibold text-purple-300">🔧 틀린 부분을 알려주고 다시 생성</div>
                                            <textarea
                                                value={feedbackNote}
                                                onChange={e => setFeedbackNote(e.target.value)}
                                                placeholder="예: 2/10 트리거는 장모님이 아니라 장인어른이었어. 2/18 통찰은 사실과 달라."
                                                rows={2}
                                                autoFocus
                                                className="w-full text-sm bg-bg-primary rounded-lg p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-accent text-text-primary"
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => { setShowFeedback(false); setFeedbackNote(''); }} className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">취소</button>
                                                <button
                                                    onClick={() => handleGenerateMonthly(feedbackNote)}
                                                    disabled={!feedbackNote.trim()}
                                                    className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    피드백 반영해 재생성
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{monthlyInsight.review.moodSummary}</p>

                                    {monthlyInsight.review.triggers && monthlyInsight.review.triggers.length > 0 && (
                                        <div>
                                            <div className="text-xs font-semibold mb-1.5 text-rose-300">🎯 감정 트리거</div>
                                            <div className="space-y-1.5">
                                                {monthlyInsight.review.triggers.map((t, i) => (
                                                    <div key={i} className="text-sm bg-bg-primary/40 rounded-lg px-2.5 py-2">
                                                        <div className="flex items-start gap-2">
                                                            <span className="font-medium text-text-primary shrink-0">{t.emotion}</span>
                                                            <span className="text-text-secondary shrink-0 mt-0.5">←</span>
                                                            <span className="text-text-primary">{t.trigger}</span>
                                                        </div>
                                                        {t.source && (
                                                            <div className="text-[11px] text-text-secondary mt-1.5 pl-1">📎 근거: {t.source}</div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {renderInsightList('🔁 패턴', monthlyInsight.review.patterns, 'text-purple-300')}
                                    {renderInsightList('🌤️ 좋았던 점', monthlyInsight.review.positives, 'text-blue-300')}
                                    {renderInsightList('🌧️ 힘들었던 점', monthlyInsight.review.challenges, 'text-orange-300')}
                                    {renderInsightList('💡 통찰', monthlyInsight.review.insights, 'text-yellow-300')}

                                    {monthlyInsight.review.suggestion && (
                                        <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                                            <div className="text-xs text-accent font-semibold mb-1">🌱 다음 달 제안</div>
                                            <p className="text-sm text-text-primary leading-relaxed">{monthlyInsight.review.suggestion}</p>
                                        </div>
                                    )}

                                    <div className="text-[10px] text-text-secondary text-right">
                                        {format(monthlyInsight.generatedAt, 'M월 d일 생성', { locale: ko })} · 기록 {monthlyInsight.entryCount}개 기준
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-2">
                                    <p className="text-sm text-text-secondary mb-3">
                                        {monthEntryCount > 0
                                            ? '이번 달 기록을 AI가 분석해 감정 흐름·패턴·통찰을 정리해드려요.'
                                            : '이번 달 기록이 아직 없어요.'}
                                    </p>
                                    {monthEntryCount > 0 && (
                                        <button
                                            onClick={() => handleGenerateMonthly()}
                                            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors"
                                        >
                                            ✨ 월간 회고 생성
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UnifiedCalendarModal;
