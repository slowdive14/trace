import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getWorryEntries, addWorryEntry, deleteWorryEntry, updateWorryEntry } from '../services/firestore';
import type { Worry, WorryEntry } from '../types/types';
import { format, differenceInCalendarDays } from 'date-fns';
import { Trash2, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import WorryTimeline from './WorryTimeline';
import WorryInput from './WorryInput';

interface WorrySectionProps {
    worry: Worry;
    onDeleteWorry: (id: string) => void;
    onCloseWorry: (worry: Worry) => void;
}

const WorrySection: React.FC<WorrySectionProps> = ({ worry, onDeleteWorry, onCloseWorry }) => {
    const { user } = useAuth();
    const [entries, setEntries] = useState<WorryEntry[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [replyingToId, setReplyingToId] = useState<string | null>(null);
    const [replyType, setReplyType] = useState<'action' | 'result'>('action');

    useEffect(() => {
        if (user) {
            loadEntries();
        }
    }, [user, worry.id]);

    const loadEntries = async () => {
        if (!user) return;
        try {
            const fetchedEntries = await getWorryEntries(user.uid, worry.id);
            setEntries(fetchedEntries);
        } catch (error) {
            console.error("Failed to load entries:", error);
        }
    };

    const calculateWeek = (startDate: Date): number => {
        const today = new Date();
        const diffDays = differenceInCalendarDays(today, startDate);
        return Math.floor(diffDays / 7) + 1;
    };

    const handleAddEntry = async (entryData: { type: 'worry' | 'action' | 'result', content: string, week: number, parentId?: string }) => {
        if (!user) return;
        try {
            await addWorryEntry(user.uid, worry.id, entryData.type, entryData.content, entryData.week, entryData.parentId);
            await loadEntries();
        } catch (error) {
            console.error("Failed to add entry:", error);
            alert("기록 저장 중 오류가 발생했습니다.");
        }
    };

    const handleUpdateEntry = async (entryId: string, content: string) => {
        if (!user) return;
        try {
            await updateWorryEntry(user.uid, entryId, content);
            await loadEntries();
        } catch (error) {
            console.error('Error updating entry:', error);
            alert("수정 중 오류가 발생했습니다.");
        }
    };

    const handleDeleteEntry = async (entryId: string) => {
        if (!user) return;
        try {
            await deleteWorryEntry(user.uid, entryId);
            await loadEntries();
        } catch (error) {
            console.error('Error deleting entry:', error);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="mb-6 bg-bg-secondary border border-bg-tertiary rounded-xl overflow-hidden">
            <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-bg-tertiary/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-text-primary">{worry.title}</h3>
                    <p className="text-xs text-text-secondary mt-1">
                        {format(worry.startDate, 'yyyy.MM.dd')} 시작
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCloseWorry(worry);
                        }}
                        className="p-2 text-text-secondary hover:text-green-400 hover:bg-green-900/20 rounded-full transition-colors"
                        title="고민 마무리"
                    >
                        <CheckCircle size={18} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('정말 이 고민을 삭제하시겠습니까? 모든 기록이 사라집니다.')) {
                                onDeleteWorry(worry.id);
                            }
                        }}
                        className="p-2 text-text-secondary hover:text-red-400 hover:bg-red-900/20 rounded-full transition-colors"
                        title="고민 삭제"
                    >
                        <Trash2 size={18} />
                    </button>
                    <div className="p-2 text-text-secondary">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="p-4 border-t border-bg-tertiary bg-bg-primary/50">
                    <WorryTimeline
                        entries={entries}
                        onUpdate={handleUpdateEntry}
                        onDelete={handleDeleteEntry}
                        onReply={(id, type, content) => {
                            if (content) {
                                // AI generated content
                                const week = calculateWeek(worry.startDate);
                                handleAddEntry({
                                    type,
                                    content,
                                    week,
                                    parentId: id
                                });
                            } else {
                                setReplyingToId(id);
                                setReplyType(type);
                            }
                        }}
                    />

                    <WorryInput
                        activeWorryId={worry.id}
                        worryStartDate={worry.startDate}
                        replyingToId={replyingToId}
                        replyType={replyType}
                        onCancelReply={() => setReplyingToId(null)}
                        onSubmit={handleAddEntry}
                        isEmbedded={true}
                    />
                </div>
            )}
        </div>
    );
};

export default WorrySection;
