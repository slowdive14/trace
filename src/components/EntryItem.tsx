import React, { useState } from 'react';
import { format } from 'date-fns';
import type { Entry } from '../types/types';
import { Trash2, Copy, Check, Pin } from 'lucide-react';

interface EntryItemProps {
    entry: Entry;
    onDelete: (id: string) => void;
    highlightQuery?: string;
    onTagClick?: (tag: string) => void;
    onPin?: (id: string, currentStatus: boolean) => void;
}

const EntryItem: React.FC<EntryItemProps> = ({ entry, onDelete, highlightQuery, onTagClick, onPin }) => {
    const [showCopyToast, setShowCopyToast] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const formattedTime = format(entry.timestamp, 'HH:mm');

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(entry.content);
            setShowCopyToast(true);
            setTimeout(() => setShowCopyToast(false), 1500);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handlePinClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onPin) {
            onPin(entry.id, entry.isPinned || false);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDeleting(true);
    };

    const handleConfirmDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(entry.id);
        setIsDeleting(false);
    };

    const handleCancelDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDeleting(false);
    };


    const renderContent = () => {
        return entry.content.split(/(#[^\s#]+)/g).map((part, index) => {
            const isHashtag = part.startsWith('#');

            // Helper function to apply search highlighting
            const applyHighlight = (text: string) => {
                if (!highlightQuery || !highlightQuery.trim()) {
                    return text;
                }

                const regex = new RegExp(`(${highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                const parts = text.split(regex);

                return parts.map((subPart, subIndex) => {
                    if (subPart.toLowerCase() === highlightQuery.toLowerCase()) {
                        return (
                            <mark key={`${index}-${subIndex}`} className="bg-yellow-300 text-black px-0.5 rounded">
                                {subPart}
                            </mark>
                        );
                    }
                    return subPart;
                });
            };


            // Hashtag with potential highlight inside
            if (isHashtag) {
                const handleTagClick = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (onTagClick) {
                        onTagClick(part);
                    }
                };

                return (
                    <span
                        key={index}
                        onClick={onTagClick ? handleTagClick : undefined}
                        className={`text-tag-text bg-tag-bg px-1.5 py-0.5 rounded text-sm mx-0.5 ${onTagClick ? 'cursor-pointer hover:bg-opacity-80 transition-all' : ''}`}
                    >
                        {applyHighlight(part)}
                    </span>
                );
            }

            // Regular text with potential highlight
            if (highlightQuery && highlightQuery.trim()) {
                return <React.Fragment key={index}>{applyHighlight(part)}</React.Fragment>;
            }

            return part;
        });
    };

    return (
        <div className={`flex gap-4 py-3 group relative transition-colors rounded-lg px-2 -mx-2 ${entry.isPinned ? 'bg-accent/5' : 'hover:bg-bg-secondary/50'}`}>
            {showCopyToast && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-accent text-white px-3 py-1 rounded text-xs flex items-center gap-1 z-10">
                    <Check size={12} />
                    복사됨
                </div>
            )}
            <div className={`w-12 text-right font-mono text-sm pt-1 shrink-0 flex flex-col items-end gap-1 ${entry.category === 'thought' ? 'text-purple-500' :
                    entry.category === 'chore' ? 'text-orange-500' :
                        'text-blue-500'
                }`}>
                <span>{formattedTime}</span>
                {entry.isPinned && <Pin size={12} className="text-accent fill-accent" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className={`text-text-primary break-words whitespace-pre-wrap ${entry.category === 'thought' ? 'font-serif leading-relaxed text-sm' : ''
                    }`}>
                    {renderContent()}
                </div>
            </div>
            <div className={`flex gap-1 transition-all shrink-0 items-start ${isDeleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {isDeleting ? (
                    <>
                        <button
                            type="button"
                            onClick={handleCancelDelete}
                            className="text-text-secondary hover:text-text-primary transition-colors p-1 text-xs"
                            aria-label="Cancel delete"
                        >
                            취소
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmDelete}
                            className="text-red-500 hover:text-red-600 transition-colors p-1 flex items-center gap-1 text-xs font-bold"
                            aria-label="Confirm delete"
                        >
                            삭제
                        </button>
                    </>
                ) : (
                    <>
                        {onPin && (
                            <button
                                type="button"
                                onClick={handlePinClick}
                                className={`transition-colors p-1 ${entry.isPinned ? 'text-accent' : 'text-text-secondary hover:text-accent'}`}
                                aria-label={entry.isPinned ? "Unpin entry" : "Pin entry"}
                            >
                                <Pin size={16} className={entry.isPinned ? "fill-accent" : ""} />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="text-text-secondary hover:text-accent transition-colors p-1"
                            aria-label="Copy entry"
                        >
                            <Copy size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={handleDeleteClick}
                            className="text-text-secondary hover:text-red-400 transition-colors p-1"
                            aria-label="Delete entry"
                        >
                            <Trash2 size={16} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default EntryItem;
