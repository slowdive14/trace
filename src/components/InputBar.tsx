import React, { useState, useRef, useEffect } from 'react';
import { Send, Maximize2, Minimize2, Calendar, Smile, Moon, Sun, CloudMoon } from 'lucide-react';
import { extractTags } from '../utils/tagUtils';
import { addEntry } from '../services/firestore';
import { useAuth } from './AuthContext';
import { format, isSameDay } from 'date-fns';
import { searchEmotions, type EmotionTag } from '../utils/emotionTags';
import EmotionPickerModal from './EmotionPickerModal';
import { extractSleepRecords, getIdealSleepSchedule } from '../utils/sleepUtils';
import type { Entry } from '../types/types';

interface InputBarProps {
    activeCategory?: 'action' | 'thought' | 'chore' | 'book';
    collectionName?: string;
    entries?: Entry[];
}

const InputBar: React.FC<InputBarProps> = ({ activeCategory = 'action', collectionName = 'entries', entries = [] }) => {
    const [content, setContent] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    // Use null to represent "Now/Today". This prevents stale timestamps when the app is left open.
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showEmotionModal, setShowEmotionModal] = useState(false);

    // 수면 시간 선택 모달 관련 상태
    const [showSleepTimeModal, setShowSleepTimeModal] = useState(false);
    const [sleepModalType, setSleepModalType] = useState<'sleep' | 'wake'>('sleep');
    const [sleepTime, setSleepTime] = useState('');
    const [sleepDate, setSleepDate] = useState<Date>(new Date());
    const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 낮잠 기록 모달
    const [showNapModal, setShowNapModal] = useState(false);
    const [napStartTime, setNapStartTime] = useState('');
    const [napEndTime, setNapEndTime] = useState('');

    // 자동완성 관련 상태
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autocompleteEmotions, setAutocompleteEmotions] = useState<EmotionTag[]>([]);
    const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0);
    const [autocompletePosition, setAutocompletePosition] = useState({ start: 0, end: 0 });

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const autocompleteRef = useRef<HTMLDivElement>(null);
    const { user } = useAuth();

    // 자동완성 감지 및 업데이트
    const updateAutocomplete = (text: string, cursorPos: number) => {
        // 커서 위치 기준으로 현재 단어 추출
        const beforeCursor = text.substring(0, cursorPos);
        const afterCursor = text.substring(cursorPos);

        // #감정/ 패턴 찾기
        const hashtagMatch = beforeCursor.match(/#감정\/([^#\s]*?)$/);

        if (hashtagMatch) {
            const query = hashtagMatch[1]; // #감정/ 이후의 텍스트
            const startPos = hashtagMatch.index!;
            const endPos = cursorPos;

            const afterMatch = afterCursor.match(/^[^#\s]*/);
            setAutocompletePosition({ start: startPos, end: endPos + (afterMatch?.[0]?.length || 0) });

            // 검색 실행
            const results = searchEmotions(query || '감정');
            setAutocompleteEmotions(results.slice(0, 8)); // 최대 8개만 표시
            setShowAutocomplete(results.length > 0);
            setSelectedAutocompleteIndex(0);
        } else {
            setShowAutocomplete(false);
        }
    };

    const handleContentChange = (newContent: string) => {
        setContent(newContent);
        const cursorPos = textareaRef.current?.selectionStart || 0;
        updateAutocomplete(newContent, cursorPos);
    };

    const selectAutocompleteEmotion = (tag: string) => {
        const before = content.substring(0, autocompletePosition.start);
        const after = content.substring(autocompletePosition.end);
        const newContent = before + tag + ' ' + after;
        setContent(newContent);
        setShowAutocomplete(false);

        // 커서를 태그 뒤로 이동
        setTimeout(() => {
            if (textareaRef.current) {
                const newCursorPos = before.length + tag.length + 1;
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                textareaRef.current.focus();
            }
        }, 0);
    };

    // 수면 기록 핸들러 (즉시 기록)
    const handleSleepRecord = async (type: 'sleep' | 'wake', customTime?: Date) => {
        if (!user) return;

        const content = type === 'sleep' ? '잠자기 🌙' : '기상 ⛅';
        const tags = [type === 'sleep' ? '#sleep' : '#wake'];

        try {
            await addEntry(user.uid, content, tags, 'action', customTime, 'entries', false);
        } catch (error) {
            console.error('Failed to add sleep record:', error);
        }
    };

    // 수면 버튼 길게 누르기 핸들러
    const handleSleepButtonDown = (type: 'sleep' | 'wake') => {
        longPressTimeout.current = setTimeout(() => {
            // 길게 누름 → 모달 열기
            setSleepModalType(type);
            setSleepTime(format(new Date(), 'HH:mm'));
            setSleepDate(new Date());
            setShowSleepTimeModal(true);
            longPressTimeout.current = null;
        }, 500);
    };

    const handleSleepButtonUp = (type: 'sleep' | 'wake') => {
        if (longPressTimeout.current) {
            // 짧게 누름 → 즉시 기록
            clearTimeout(longPressTimeout.current);
            longPressTimeout.current = null;
            handleSleepRecord(type);
        }
    };

    const handleSleepButtonLeave = () => {
        if (longPressTimeout.current) {
            clearTimeout(longPressTimeout.current);
            longPressTimeout.current = null;
        }
    };

    // 시간 지정 수면 기록 제출
    const handleSleepTimeSubmit = async () => {
        if (!user || !sleepTime) return;

        const [hours, minutes] = sleepTime.split(':').map(Number);
        const selectedDateTime = new Date(sleepDate);
        selectedDateTime.setHours(hours, minutes, 0, 0);

        await handleSleepRecord(sleepModalType, selectedDateTime);
        setShowSleepTimeModal(false);
    };

    // 낮잠 기록 핸들러
    const handleNapRecord = async () => {
        if (!user || !napStartTime || !napEndTime) return;

        const [sh, sm] = napStartTime.split(':').map(Number);
        const [eh, em] = napEndTime.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const duration = endMin - startMin;
        if (duration <= 0) return;

        const content = `낮잠 ${duration}분 (${napStartTime}~${napEndTime}) 💤`;
        const tags = ['#nap'];

        try {
            await addEntry(user.uid, content, tags, 'action', undefined, 'entries', false);
            setShowNapModal(false);
            setNapStartTime('');
            setNapEndTime('');
        } catch (error) {
            console.error('Failed to add nap record:', error);
        }
    };

    const insertBookTag = (tag: string) => {
        const cursorPos = textareaRef.current?.selectionStart || content.length;
        const before = content.substring(0, cursorPos);
        const after = content.substring(cursorPos);

        // 스페이스 패딩 처리
        const needsSpaceBefore = before.length > 0 && !before.endsWith(' ');
        const spaceBefore = needsSpaceBefore ? ' ' : '';

        const newContent = before + spaceBefore + tag + ' ' + after;
        setContent(newContent);

        // 커서를 태그 뒤로 이동
        setTimeout(() => {
            if (textareaRef.current) {
                const newCursorPos = cursorPos + spaceBefore.length + tag.length + 1;
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                textareaRef.current.focus();
            }
        }, 0);
    };

    const handleSubmit = async () => {
        if (!content.trim() || !user) return;

        const tags = extractTags(content);
        const category = activeCategory;

        try {
            // If selectedDate is null, it means "Now".
            // If selectedDate is set, check if it's today. If it is today, we still use "Now" (undefined).
            // This preserves the behavior of using current time for today's entries.
            const isToday = selectedDate && isSameDay(selectedDate, new Date());
            const dateToUse = (selectedDate && !isToday) ? selectedDate : undefined;

            // Chores are pinned by default
            const isPinned = category === 'chore';

            await addEntry(user.uid, content, tags, category, dateToUse, collectionName, isPinned);
            setContent('');
            setIsExpanded(false);
            setSelectedDate(null); // Reset to "Now"
            setShowAutocomplete(false);
        } catch (error) {
            console.error("Failed to add entry:", error);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // 자동완성이 활성화된 경우
        if (showAutocomplete) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedAutocompleteIndex((prev) =>
                    prev < autocompleteEmotions.length - 1 ? prev + 1 : prev
                );
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedAutocompleteIndex((prev) => (prev > 0 ? prev - 1 : 0));
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (autocompleteEmotions[selectedAutocompleteIndex]) {
                    selectAutocompleteEmotion(autocompleteEmotions[selectedAutocompleteIndex].tag);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowAutocomplete(false);
                return;
            }
        }

        // Enter 키 처리
        if (e.key === 'Enter') {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            if (!isMobile && !e.shiftKey) {
                // 데스크톱에서는 Enter로 전송 (Shift+Enter는 줄바꿈)
                e.preventDefault();
                handleSubmit();
            }
            // 모바일에서는 Enter가 줄바꿈 (기본 동작), 전송은 버튼으로만
        }
    };

    // 자동완성 선택된 항목 스크롤
    useEffect(() => {
        if (autocompleteRef.current && showAutocomplete) {
            const selectedElement = autocompleteRef.current.children[selectedAutocompleteIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedAutocompleteIndex, showAutocomplete]);

    useEffect(() => {
        if (textareaRef.current) {
            if (isExpanded) {
                textareaRef.current.style.height = '100%';
            } else {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
            }
        }
    }, [content, isExpanded]);

    // For display purposes, default to today if null
    const displayDate = selectedDate || new Date();
    const isDisplayDateToday = isSameDay(displayDate, new Date());

    // 적정 수면 시간 계산
    const idealSchedule = React.useMemo(() => {
        if (!entries || entries.length === 0) return null;
        const records = extractSleepRecords(entries);
        return getIdealSleepSchedule(records);
    }, [entries]);

    return (
        <>
            {/* 수면 기록 버튼 바 - 일상 탭에서만 표시 */}
            {activeCategory === 'action' && !isExpanded && (
                <div className="fixed bottom-[136px] left-0 right-0 flex justify-center z-[60]">
                    <div className="max-w-md w-full px-4">
                        {/* 적정 수면 가이드 */}
                        {idealSchedule && (
                            <div className="flex justify-center mb-2">
                                <div className="bg-bg-secondary/80 backdrop-blur-sm border border-bg-tertiary px-3 py-1.5 rounded-full flex items-center gap-3 shadow-sm">
                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                        <Moon size={12} className="text-indigo-400" />
                                        <span className="text-[10px] text-text-secondary">적정 취침</span>
                                        <span className="text-[11px] font-bold text-indigo-400">{idealSchedule.bedtime}</span>
                                    </div>
                                    <div className="w-[1px] h-2.5 bg-bg-tertiary" />
                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                        <Sun size={12} className="text-amber-400" />
                                        <span className="text-[10px] text-text-secondary">적정 기상</span>
                                        <span className="text-[11px] font-bold text-amber-400">{idealSchedule.waketime}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="flex gap-2 p-2 bg-bg-secondary rounded-lg border border-bg-tertiary shadow-lg justify-center">
                            <button
                                type="button"
                                onMouseDown={() => handleSleepButtonDown('sleep')}
                                onMouseUp={() => handleSleepButtonUp('sleep')}
                                onMouseLeave={handleSleepButtonLeave}
                                onTouchStart={(e) => { e.preventDefault(); handleSleepButtonDown('sleep'); }}
                                onTouchEnd={(e) => { e.preventDefault(); handleSleepButtonUp('sleep'); }}
                                className="flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors select-none"
                            >
                                <Moon size={16} /> 잠자기
                            </button>
                            <button
                                type="button"
                                onMouseDown={() => handleSleepButtonDown('wake')}
                                onMouseUp={() => handleSleepButtonUp('wake')}
                                onMouseLeave={handleSleepButtonLeave}
                                onTouchStart={(e) => { e.preventDefault(); handleSleepButtonDown('wake'); }}
                                onTouchEnd={(e) => { e.preventDefault(); handleSleepButtonUp('wake'); }}
                                className="flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md bg-amber-500 text-white hover:bg-amber-400 transition-colors select-none"
                            >
                                <Sun size={16} /> 기상
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowNapModal(true);
                                    setNapStartTime('');
                                    setNapEndTime(format(new Date(), 'HH:mm'));
                                }}
                                className="flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md bg-slate-600 text-white hover:bg-slate-500 transition-colors select-none"
                            >
                                <CloudMoon size={16} /> 낮잠
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 자동완성 드롭다운 - Fixed positioning above everything */}
            {showAutocomplete && (
                <div className="fixed bottom-[120px] left-0 right-0 flex justify-center z-[100] pointer-events-none">
                    <div className="max-w-md w-full px-4 pointer-events-auto">
                        <div
                            ref={autocompleteRef}
                            className="bg-bg-tertiary border border-bg-primary rounded-lg shadow-2xl max-h-64 overflow-y-auto"
                        >
                            {autocompleteEmotions.map((emotion, index) => (
                                <button
                                    key={emotion.tag}
                                    onClick={() => selectAutocompleteEmotion(emotion.tag)}
                                    className={`w-full text-left p-3 transition-colors border-b border-bg-primary last:border-b-0 ${index === selectedAutocompleteIndex
                                        ? 'bg-accent text-white'
                                        : 'hover:bg-bg-secondary'
                                        }`}
                                >
                                    <div className={`font-medium text-sm ${index === selectedAutocompleteIndex ? 'text-white' : 'text-accent'}`}>
                                        {emotion.tag}
                                    </div>
                                    <div className={`text-xs mt-1 ${index === selectedAutocompleteIndex ? 'text-white/80' : 'text-text-secondary'}`}>
                                        {emotion.meaning}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 책 태그 버튼 바 - Fixed positioning (only when not expanded) */}
            {activeCategory === 'book' && !isExpanded && (
                <div className="fixed bottom-[136px] left-0 right-0 flex justify-center z-[60]">
                    <div className="max-w-md w-full px-4">
                        <div className="flex gap-2 flex-wrap p-2 bg-bg-secondary rounded-lg border border-bg-tertiary shadow-lg">
                            <button
                                type="button"
                                onClick={() => insertBookTag('#발췌')}
                                className="py-1.5 px-3 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                            >
                                #발췌
                            </button>
                            <button
                                type="button"
                                onClick={() => insertBookTag('#읽을책')}
                                className="py-1.5 px-3 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                            >
                                #읽을책
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 할일/정보 태그 버튼 바 - Fixed positioning (only when not expanded) */}
            {activeCategory === 'chore' && !isExpanded && (
                <div className="fixed bottom-[136px] left-0 right-0 flex justify-center z-[60]">
                    <div className="max-w-md w-full px-4">
                        <div className="flex gap-2 flex-wrap p-2 bg-bg-secondary rounded-lg border border-bg-tertiary shadow-lg">
                            {['#q1', '#q2', '#q3', '#q4'].map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => insertBookTag(tag)}
                                    className="py-1.5 px-3 text-xs font-medium rounded-md bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className={`fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-bg-tertiary p-3 transition-all duration-300 ${isExpanded ? 'h-1/2 z-50' : 'h-auto z-40'}`}>
                <div className="max-w-md mx-auto flex flex-col h-full gap-2 relative">
                    {/* 확장 모드에서 책 태그 버튼 바를 InputBar 상단에 표시 */}
                    {activeCategory === 'book' && isExpanded && (
                        <div className="flex gap-2 flex-wrap p-2 bg-bg-tertiary rounded-lg border-b border-bg-primary">
                            <button
                                type="button"
                                onClick={() => insertBookTag('#발췌')}
                                className="py-1.5 px-3 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                            >
                                #발췌
                            </button>
                            <button
                                type="button"
                                onClick={() => insertBookTag('#읽을책')}
                                className="py-1.5 px-3 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                            >
                                #읽을책
                            </button>
                        </div>
                    )}

                    {/* 확장 모드에서 할일/정보 태그 버튼 바를 InputBar 상단에 표시 */}
                    {activeCategory === 'chore' && isExpanded && (
                        <div className="flex gap-2 flex-wrap p-2 bg-bg-tertiary rounded-lg border-b border-bg-primary">
                            {['#q1', '#q2', '#q3', '#q4'].map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => insertBookTag(tag)}
                                    className="py-1.5 px-3 text-xs font-medium rounded-md bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    )}

                    {!isDisplayDateToday && (
                        <div className="text-xs text-accent text-center">
                            📅 {format(displayDate, 'yyyy년 M월 d일')} 기록
                        </div>
                    )}

                    <div className={`flex gap-2 flex-1 ${isExpanded ? 'items-stretch' : 'items-end'}`}>
                        <div className={`flex-1 relative ${isExpanded ? 'flex flex-col' : ''}`}>
                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={(e) => handleContentChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onSelect={() => {
                                    const cursorPos = textareaRef.current?.selectionStart || 0;
                                    updateAutocomplete(content, cursorPos);
                                }}
                                placeholder={activeCategory === 'book' ? '책 내용을 기록하세요... (#발췌, #읽을책)' : '#감정/ 입력하면 자동완성'}
                                className={`w-full bg-bg-tertiary text-text-primary rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-accent min-h-[44px] overflow-y-auto ${isExpanded ? 'h-full max-h-full' : 'max-h-24'}`}
                                rows={1}
                            />
                        </div>
                        <button
                            onClick={() => setShowEmotionModal(true)}
                            className="p-2 text-yellow-500 hover:text-yellow-400 transition-colors"
                            title="감정 태그 선택"
                        >
                            <Smile size={20} />
                        </button>
                        <button
                            onClick={() => setShowDatePicker(true)}
                            className={`p-2 transition-colors ${isDisplayDateToday ? 'text-text-secondary hover:text-text-primary' : 'text-accent'}`}
                            title="날짜 선택"
                        >
                            <Calendar size={20} />
                        </button>
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-2 text-text-secondary hover:text-text-primary transition-colors"
                        >
                            {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!content.trim()}
                            className={`p-2 text-white rounded-full hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${activeCategory === 'thought' ? 'bg-purple-500' :
                                activeCategory === 'chore' ? 'bg-orange-500' :
                                    activeCategory === 'book' ? 'bg-amber-700' :
                                        'bg-blue-500'
                                }`}
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {showDatePicker && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDatePicker(false)}>
                    <div className="bg-bg-secondary rounded-2xl p-6 max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4 text-center">날짜 선택</h3>
                        <input
                            type="date"
                            value={format(displayDate, 'yyyy-MM-dd')}
                            onChange={(e) => {
                                // 정오(12:00)로 설정: getLogicalDate가 5AM 이전을 전날로 처리하는 문제 방지
                                setSelectedDate(new Date(e.target.value + 'T12:00:00'));
                                setShowDatePicker(false);
                            }}
                            className="w-full bg-bg-tertiary text-text-primary rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={() => {
                                    setSelectedDate(null); // Set to "Now"
                                    setShowDatePicker(false);
                                }}
                                className="flex-1 py-2 px-4 bg-accent text-white rounded-lg hover:bg-opacity-90"
                            >
                                오늘
                            </button>
                            <button
                                onClick={() => setShowDatePicker(false)}
                                className="flex-1 py-2 px-4 bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-primary"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 감정 선택 모달 */}
            <EmotionPickerModal
                isOpen={showEmotionModal}
                onClose={() => setShowEmotionModal(false)}
                onSelect={(tag) => {
                    const cursorPos = textareaRef.current?.selectionStart || content.length;
                    const before = content.substring(0, cursorPos);
                    const after = content.substring(cursorPos);
                    const newContent = before + (before.endsWith(' ') || before.length === 0 ? '' : ' ') + tag + ' ' + after;
                    setContent(newContent);

                    // 커서를 태그 뒤로 이동
                    setTimeout(() => {
                        if (textareaRef.current) {
                            const newCursorPos = cursorPos + (before.endsWith(' ') || before.length === 0 ? 0 : 1) + tag.length + 1;
                            textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                            textareaRef.current.focus();
                        }
                    }, 0);
                }}
            />

            {/* 수면 시간 선택 모달 */}
            {showSleepTimeModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSleepTimeModal(false)}>
                    <div className="bg-bg-secondary rounded-2xl p-6 max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4 text-center">
                            {sleepModalType === 'sleep' ? '🌙 취침 시간' : '⛅ 기상 시간'}
                        </h3>
                        <p className="text-xs text-text-secondary text-center mb-4">
                            날짜와 시간을 선택하세요
                        </p>
                        <div className="mb-3">
                            <label className="block text-xs text-text-secondary mb-1">날짜</label>
                            <input
                                type="date"
                                value={format(sleepDate, 'yyyy-MM-dd')}
                                onChange={(e) => setSleepDate(new Date(e.target.value + 'T00:00:00'))}
                                className="w-full bg-bg-tertiary text-text-primary rounded-lg p-3 text-center focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs text-text-secondary mb-1">시간</label>
                            <input
                                type="time"
                                value={sleepTime}
                                onChange={(e) => setSleepTime(e.target.value)}
                                className="w-full bg-bg-tertiary text-text-primary rounded-lg p-3 text-center text-xl focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSleepTimeSubmit}
                                className={`flex-1 py-2 px-4 text-white rounded-lg hover:bg-opacity-90 ${sleepModalType === 'sleep' ? 'bg-indigo-600' : 'bg-amber-500'}`}
                            >
                                확인
                            </button>
                            <button
                                onClick={() => setShowSleepTimeModal(false)}
                                className="flex-1 py-2 px-4 bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-primary"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 낮잠 시간 입력 모달 */}
            {showNapModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowNapModal(false)}>
                    <div className="bg-bg-secondary rounded-2xl p-6 max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4 text-center">💤 낮잠 기록</h3>
                        <form onSubmit={(e) => { e.preventDefault(); handleNapRecord(); }}>
                            <div className="mb-3">
                                <label className="block text-xs text-text-secondary mb-1">시작 시간</label>
                                <input
                                    type="time"
                                    value={napStartTime}
                                    onChange={(e) => setNapStartTime(e.target.value)}
                                    className="w-full bg-bg-tertiary text-text-primary rounded-lg p-3 text-center text-xl focus:outline-none focus:ring-1 focus:ring-accent"
                                />
                            </div>
                            <div className="mb-3">
                                <label className="block text-xs text-text-secondary mb-1">종료 시간</label>
                                <input
                                    type="time"
                                    value={napEndTime}
                                    onChange={(e) => setNapEndTime(e.target.value)}
                                    className="w-full bg-bg-tertiary text-text-primary rounded-lg p-3 text-center text-xl focus:outline-none focus:ring-1 focus:ring-accent"
                                />
                            </div>
                            {napStartTime && napEndTime && (() => {
                                const [sh, sm] = napStartTime.split(':').map(Number);
                                const [eh, em] = napEndTime.split(':').map(Number);
                                const d = (eh * 60 + em) - (sh * 60 + sm);
                                return d > 0 ? (
                                    <p className="text-center text-sm text-accent mb-3">{Math.floor(d / 60) > 0 ? `${Math.floor(d / 60)}시간 ` : ''}{d % 60 > 0 ? `${d % 60}분` : ''}</p>
                                ) : null;
                            })()}
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    className="flex-1 py-2 px-4 bg-slate-600 text-white rounded-lg hover:bg-slate-500"
                                >
                                    확인
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowNapModal(false)}
                                    className="flex-1 py-2 px-4 bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-primary"
                                >
                                    취소
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default InputBar;
