import React, { useState, useRef, useEffect } from 'react';
import type { WorryEntry } from '../types/types';
import { format } from 'date-fns';
import { MoreVertical, Edit2, Trash2, X, Check, Wand2 } from 'lucide-react';
import WorryActionGenerator from './WorryActionGenerator';

interface WorryCardProps {
    entry: WorryEntry;
    onUpdate: (id: string, content: string) => void;
    onDelete: (id: string) => void;
    onReply: (id: string, type: 'action' | 'result', content?: string) => void;
}

const WorryCard: React.FC<WorryCardProps> = ({ entry, onUpdate, onDelete, onReply }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showAiGenerator, setShowAiGenerator] = useState(false);
    const [editContent, setEditContent] = useState(entry.content);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleUpdate = () => {
        if (editContent.trim() && editContent !== entry.content) {
            onUpdate(entry.id, editContent);
        }
        setIsEditing(false);
    };

    const handleDelete = () => {
        if (window.confirm('정말 삭제하시겠습니까?')) {
            onDelete(entry.id);
        }
        setIsMenuOpen(false);
    };

    const getStyles = (type: WorryEntry['type']) => {
        switch (type) {
            case 'worry':
                return 'bg-purple-900/20 border-l-4 border-purple-500';
            case 'action':
                return 'bg-amber-900/20 border-l-4 border-amber-500';
            case 'result':
                return 'bg-green-900/20 border-l-4 border-green-500';
            default:
                return 'bg-bg-secondary border-l-4 border-text-secondary';
        }
    };

    const getIcon = (type: WorryEntry['type']) => {
        switch (type) {
            case 'worry': return '💭';
            case 'action': return '⚡';
            case 'result': return '✅';
            default: return '📝';
        }
    };

    return (
        <div className={`p-4 rounded-lg shadow-sm mb-3 ${getStyles(entry.type)} group relative`}>
            <div className="flex items-start gap-2">
                <span className="text-lg mt-0.5">{getIcon(entry.type)}</span>
                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <div className="flex flex-col gap-2">
                            <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full p-2 bg-bg-primary border border-bg-tertiary rounded-lg text-text-primary text-sm focus:ring-2 focus:ring-green-500 focus:outline-none resize-none"
                                rows={3}
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setEditContent(entry.content);
                                    }}
                                    className="p-1 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded"
                                >
                                    <X size={16} />
                                </button>
                                <button
                                    onClick={handleUpdate}
                                    className="p-1 text-green-500 hover:text-green-400 hover:bg-green-500/10 rounded"
                                >
                                    <Check size={16} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="text-text-primary whitespace-pre-wrap text-sm leading-relaxed break-words pr-6">
                                {entry.content}
                            </p>

                            {showAiGenerator && (
                                <div className="mt-3">
                                    <WorryActionGenerator
                                        worryContent={entry.content}
                                        onSelectAction={(actionContent) => {
                                            onReply(entry.id, 'action', actionContent);
                                            setShowAiGenerator(false);
                                        }}
                                        onClose={() => setShowAiGenerator(false)}
                                    />
                                </div>
                            )}

                            <div className="flex items-center justify-between mt-2">
                                <p className="text-xs text-text-secondary">
                                    {format(entry.timestamp, 'M/d HH:mm')}
                                </p>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {entry.type === 'worry' && (
                                        <>
                                            <button
                                                onClick={() => setShowAiGenerator(!showAiGenerator)}
                                                className="flex items-center gap-1 text-xs text-text-secondary hover:text-purple-400 px-2 py-1 rounded hover:bg-purple-900/20"
                                                title="AI 액션 추천"
                                            >
                                                <Wand2 size={12} className="text-purple-400" /> AI 추천
                                            </button>
                                            <button
                                                onClick={() => onReply(entry.id, 'action')}
                                                className="flex items-center gap-1 text-xs text-text-secondary hover:text-amber-400 px-2 py-1 rounded hover:bg-amber-900/20"
                                                title="이 고민에 대한 액션 추가"
                                            >
                                                <span className="text-amber-400">⚡</span> 액션 추가
                                            </button>
                                        </>
                                    )}
                                    {entry.type === 'action' && (
                                        <button
                                            onClick={() => onReply(entry.id, 'result')}
                                            className="flex items-center gap-1 text-xs text-text-secondary hover:text-green-400 px-2 py-1 rounded hover:bg-green-900/20"
                                            title="이 액션에 대한 결과 추가"
                                        >
                                            <span className="text-green-400">✅</span> 결과 추가
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {!isEditing && (
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="text-text-secondary hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        >
                            <MoreVertical size={16} />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 top-6 w-24 bg-bg-secondary border border-bg-tertiary rounded-lg shadow-lg z-10 py-1">
                                <button
                                    onClick={() => {
                                        setIsEditing(true);
                                        setIsMenuOpen(false);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs text-text-primary hover:bg-bg-tertiary flex items-center gap-2"
                                >
                                    <Edit2 size={12} />
                                    수정
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                                >
                                    <Trash2 size={12} />
                                    삭제
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorryCard;
