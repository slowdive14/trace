import React, { useState, useRef, useEffect } from 'react';
import { Send, Maximize2, Minimize2, Calendar } from 'lucide-react';
import { extractTags } from '../utils/tagUtils';
import { addEntry } from '../services/firestore';
import { useAuth } from './AuthContext';
import { format, isSameDay } from 'date-fns';

interface InputBarProps {
    activeCategory?: 'action' | 'thought' | 'chore';
    collectionName?: string;
}

const InputBar: React.FC<InputBarProps> = ({ activeCategory = 'action', collectionName = 'entries' }) => {
    const [content, setContent] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    // Use null to represent "Now/Today". This prevents stale timestamps when the app is left open.
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { user } = useAuth();

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

            await addEntry(user.uid, content, tags, category, dateToUse, collectionName);
            setContent('');
            setIsExpanded(false);
            setSelectedDate(null); // Reset to "Now"
        } catch (error) {
            console.error("Failed to add entry:", error);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

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

    return (
        <>
            <div className={`fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-bg-tertiary p-4 transition-all duration-300 z-40 ${isExpanded ? 'h-1/2' : 'h-auto'}`}>
                <div className="max-w-md mx-auto flex flex-col h-full gap-2">
                    {!isDisplayDateToday && (
                        <div className="text-xs text-accent text-center">
                            📅 {format(displayDate, 'yyyy년 M월 d일')} 기록
                        </div>
                    )}
                    <div className="flex items-end gap-2 h-full">
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="What's happening? #tag"
                            className={`flex-1 bg-bg-tertiary text-text-primary rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-accent min-h-[44px] overflow-y-auto ${isExpanded ? 'h-full max-h-full' : 'max-h-[120px]'}`}
                            rows={1}
                        />
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
                                setSelectedDate(new Date(e.target.value + 'T00:00:00'));
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
        </>
    );
};

export default InputBar;
