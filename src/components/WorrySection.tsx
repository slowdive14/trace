import React from 'react';
import { format } from 'date-fns';
import { Trash2, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
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
    return (
        <div className="mb-6 bg-bg-secondary border border-bg-tertiary rounded-xl overflow-hidden">
            <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-bg-tertiary/50 transition-colors"
                onClick={() => onToggleExpand(worry.id)}
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
    );
};

export default WorrySection;
