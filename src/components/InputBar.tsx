import React, { useState, useRef, useEffect } from 'react';
import { Send, Maximize2, Minimize2, Calendar } from 'lucide-react';
import { extractTags } from '../utils/tagUtils';
import { addEntry } from '../services/firestore';
import { useAuth } from './AuthContext';
import { format } from 'date-fns';

interface InputBarProps {
    activeCategory?: 'action' | 'thought';
}

const InputBar: React.FC<InputBarProps> = ({ activeCategory = 'action' }) => {
    const [content, setContent] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { user } = useAuth();

    const handleSubmit = async () => {
        if (!content.trim() || !user) return;

        const tags = extractTags(content);
        // Use activeCategory from props instead of determining from tags
        const category = activeCategory;

        try {
            // If selected date is today, don't pass a date so it uses current time
            // Otherwise, use the selected date with midnight time
            const dateToUse = isToday ? undefined : selectedDate;
            await addEntry(user.uid, content, tags, category, dateToUse);
            setContent('');
            setIsExpanded(false);
            setSelectedDate(new Date()); // Reset to today
            // Optional: Scroll to top or show success feedback
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
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [content]);

    const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

    return (
        <>
            <div className={`fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-bg-tertiary p-4 transition-all duration-300 z-40 ${isExpanded ? 'h-1/2' : 'h-auto'}`}>
                <div className="max-w-md mx-auto flex flex-col h-full gap-2">
                    {!isToday && (
                        <div className="text-xs text-accent text-center">
                            📅 {format(selectedDate, 'yyyy년 M월 d일')} 기록
                        </div>
                    )}
                    <div className={`flex items-end gap-2 ${isExpanded ? 'flex-1' : ''}`}>
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="What's happening? #tag"
                            className={`flex-1 bg-bg-tertiary text-text-primary rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-accent overflow-y-auto ${isExpanded ? 'h-full' : 'min-h-[44px] max-h-[120px]'}`}
                            rows={1}
                        />
                        <button
                            onClick={() => setShowDatePicker(true)}
                            className={`p-2 transition-colors ${isToday ? 'text-text-secondary hover:text-text-primary' : 'text-accent'}`}
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
                            className="p-2 bg-accent text-white rounded-full hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                            value={format(selectedDate, 'yyyy-MM-dd')}
                            onChange={(e) => {
                                setSelectedDate(new Date(e.target.value + 'T00:00:00'));
                                setShowDatePicker(false);
                            }}
                            className="w-full bg-bg-tertiary text-text-primary rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={() => {
                                    setSelectedDate(new Date());
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
