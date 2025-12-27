import React from 'react';
import { format } from 'date-fns';
import { Trash2, ChevronDown, ChevronUp, CheckCircle, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Worry, WorryEntry } from '../types/types';
import WorryTimeline from './WorryTimeline';

interface WorrySectionProps {
    worry: Worry;
    entries: WorryEntry[];
    isExpanded: boolean;
    onToggleExpand: (id: string) => void;
    onDeleteWorry: (id: string) => void;
    onCloseWorry: (worry: Worry) => void;
    onUpdateEntry: (entryId: string, content: string) => void;
    onDeleteEntry: (entryId: string) => void;
    onReplyRequest: (entryId: string, type: 'action' | 'result') => void;
    onAddEntryWithContent: (type: 'action' | 'result', content: string, parentId: string) => void;
}

const WorrySection: React.FC<WorrySectionProps> = ({
    worry,
    entries,
    isExpanded,
    onToggleExpand,
    onDeleteWorry,
    onCloseWorry,
    onUpdateEntry,
    onDeleteEntry,
    onReplyRequest,
    onAddEntryWithContent
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: worry.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto' as const,
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-6">
            <div className={`bg-gradient-to-br from-purple-900/20 to-bg-secondary border border-purple-800/30 rounded-xl overflow-hidden ${isDragging ? 'shadow-lg shadow-purple-900/20' : ''}`}>
                <div className="p-4 flex items-center justify-between hover:bg-purple-900/10 transition-colors">
                    {/* Drag handle */}
                    <div
                        {...attributes}
                        {...listeners}
                        className="p-2 mr-2 cursor-grab active:cursor-grabbing text-purple-400/60 hover:text-purple-300 touch-none"
                        title="드래그하여 순서 변경"
                    >
                        <GripVertical size={16} />
                    </div>

                    {/* Content area - clickable for expand/collapse */}
                    <div
                        className="flex-1 cursor-pointer"
                        onClick={() => onToggleExpand(worry.id)}
                    >
                        <h3 className="text-lg font-bold text-purple-200">{worry.title}</h3>
                        <p className="text-xs text-purple-400/70 mt-1">
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
                        <div
                            className="p-2 text-text-secondary cursor-pointer"
                            onClick={() => onToggleExpand(worry.id)}
                        >
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className="p-4 border-t border-purple-800/20 bg-bg-primary/50">
                        <WorryTimeline
                            entries={entries}
                            worryStartDate={worry.startDate}
                            onUpdate={onUpdateEntry}
                            onDelete={onDeleteEntry}
                            onReply={(id, type, content) => {
                                if (content) {
                                    // AI generated content - add directly
                                    onAddEntryWithContent(type, content, id);
                                } else {
                                    // User wants to type their own reply
                                    onReplyRequest(id, type);
                                }
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorrySection;
