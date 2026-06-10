import React, { useState, useMemo } from 'react';
import { Search, X, Clock, Plus } from 'lucide-react';
import {
    allEmotionTags,
    searchEmotions,
    moodMeterQuadrants,
    complexEmotions,
    getEmotionName,
    type EmotionTag,
    type MoodQuadrant,
} from '../utils/emotionTags';
import { getQuickEmotions, recordEmotionUse } from '../utils/emotionUsage';

interface EmotionPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (tag: string) => void;
    title?: string;
}

// 감정 칩 (이모지 + 이름)
const EmotionChip: React.FC<{
    emotion: EmotionTag;
    onClick: () => void;
    className?: string;
}> = ({ emotion, onClick, className = 'bg-bg-tertiary hover:bg-bg-primary text-text-primary' }) => (
    <button
        onClick={onClick}
        title={emotion.meaning}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ${className}`}
    >
        <span className="text-base leading-none">{emotion.emoji}</span>
        <span>{getEmotionName(emotion.tag)}</span>
    </button>
);

const EmotionPickerModal: React.FC<EmotionPickerModalProps> = ({ isOpen, onClose, onSelect, title }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedQuadrant, setSelectedQuadrant] = useState<MoodQuadrant['key']>('highPositive');

    // 모달이 열릴 때마다 빠른 선택 목록 갱신 (최근/자주 사용)
    const quickEmotions = useMemo<EmotionTag[]>(() => (isOpen ? getQuickEmotions(10) : []), [isOpen]);

    const handleClose = () => {
        setSearchQuery('');
        onClose();
    };

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return null;
        return searchEmotions(searchQuery);
    }, [searchQuery]);

    const handleSelect = (tag: string) => {
        recordEmotionUse(tag);
        onSelect(tag);
        setSearchQuery('');
        onClose();
    };

    // 목록에 없는 감정을 직접 추가 (검색어 → #감정/단어)
    const customWord = useMemo(() => {
        const q = searchQuery.trim().replace(/^#?\s*감정\s*\/?\s*/, '').replace(/\s+/g, '');
        if (!q) return null;
        if (allEmotionTags.some((e) => getEmotionName(e.tag) === q)) return null; // 이미 있으면 안 띄움
        return q;
    }, [searchQuery]);

    if (!isOpen) return null;

    const activeQuadrant = moodMeterQuadrants.find((q) => q.key === selectedQuadrant)!;
    // 사분면 감정을 소그룹별로 묶기 (emotions는 데이터 계층에서 그룹 순으로 정렬됨)
    const groupedActive: { name: string; items: EmotionTag[] }[] = [];
    for (const e of activeQuadrant.emotions) {
        const g = e.group || '기타';
        const last = groupedActive[groupedActive.length - 1];
        if (last && last.name === g) last.items.push(e);
        else groupedActive.push({ name: g, items: [e] });
    }

    return (
        <div
            className="fixed inset-0 bg-black/50 z-[210] flex items-center justify-center p-4"
            onClick={handleClose}
        >
            <div
                className="bg-bg-secondary rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between p-5 border-b border-bg-tertiary">
                    <h2 className="text-lg font-bold">{title || '😊 감정 선택'}</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 검색창 */}
                <div className="p-4 border-b border-bg-tertiary">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="감정 이름·느낌·비슷한 말로 검색..."
                            className="w-full pl-10 pr-4 py-2 bg-bg-tertiary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                    </div>
                </div>

                {searchResults ? (
                    /* 검색 결과 */
                    <div className="flex-1 overflow-y-auto p-4">
                        {/* 직접 추가 (목록에 없는 감정) */}
                        {customWord && (
                            <button
                                onClick={() => handleSelect(`#감정/${customWord}`)}
                                className="w-full text-left p-3 mb-3 rounded-lg border border-dashed border-bg-tertiary hover:border-accent hover:bg-bg-tertiary transition-colors flex items-center gap-3"
                            >
                                <Plus size={20} className="text-accent shrink-0" />
                                <div className="min-w-0">
                                    <div className="font-medium text-accent">#감정/{customWord} 직접 추가</div>
                                    <div className="text-xs text-text-secondary mt-0.5">목록에 없는 감정도 그대로 기록할 수 있어요</div>
                                </div>
                            </button>
                        )}

                        {searchResults.length > 0 ? (
                            <>
                                <div className="text-sm text-text-secondary mb-2">{searchResults.length}개의 감정 찾음</div>
                                <div className="space-y-2">
                                    {searchResults.map((emotion) => (
                                        <button
                                            key={emotion.tag}
                                            onClick={() => handleSelect(emotion.tag)}
                                            className="w-full text-left p-3 bg-bg-tertiary hover:bg-bg-primary rounded-lg transition-colors flex items-start gap-3"
                                        >
                                            <span className="text-2xl leading-none mt-0.5">{emotion.emoji}</span>
                                            <div className="min-w-0">
                                                <div className="font-medium text-accent">{getEmotionName(emotion.tag)}</div>
                                                <div className="text-sm text-text-secondary mt-0.5">{emotion.meaning}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            !customWord && <div className="text-sm text-text-secondary text-center py-6">검색 결과가 없어요.</div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* 빠른 선택 (최근/자주 쓰는 감정) */}
                        {quickEmotions.length > 0 && (
                            <div className="px-4 pt-4">
                                <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-2">
                                    <Clock size={12} />
                                    <span>빠른 선택</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {quickEmotions.map((emotion) => (
                                        <EmotionChip
                                            key={emotion.tag}
                                            emotion={emotion}
                                            onClick={() => handleSelect(emotion.tag)}
                                            className="bg-accent/15 hover:bg-accent/30 text-text-primary"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 무드미터 (단일 뷰) */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {/* 2x2 사분면 선택기 */}
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {moodMeterQuadrants.map((q) => (
                                    <button
                                        key={q.key}
                                        onClick={() => setSelectedQuadrant(q.key)}
                                        className={`p-3 rounded-xl border text-left transition-all ${q.border} ${
                                            selectedQuadrant === q.key ? q.cellActiveBg : q.cellBg
                                        }`}
                                    >
                                        <div className="text-2xl leading-none mb-1">{q.sampleEmoji}</div>
                                        <div className="text-xs font-semibold text-text-primary">
                                            {q.energyIcon} {q.label}
                                        </div>
                                        <div className="text-[10px] text-text-secondary mt-0.5">
                                            {q.emotions.length}개
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* 선택된 사분면의 감정 칩 (소그룹별) */}
                            <div className="space-y-3">
                                {groupedActive.map((grp) => (
                                    <div key={grp.name}>
                                        <div className="text-[11px] text-text-secondary/70 mb-1.5">{grp.name}</div>
                                        <div className="flex flex-wrap gap-2">
                                            {grp.items.map((emotion) => (
                                                <EmotionChip
                                                    key={emotion.tag}
                                                    emotion={emotion}
                                                    onClick={() => handleSelect(emotion.tag)}
                                                    className={`${activeQuadrant.chipBg} ${activeQuadrant.chipText}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* 복합 · 중간 감정 */}
                            {complexEmotions.length > 0 && (
                                <div className="mt-5">
                                    <div className="text-xs text-text-secondary mb-2">🌀 복합 · 중간 (어느 쪽에도 딱 안 맞는 감정)</div>
                                    <div className="flex flex-wrap gap-2">
                                        {complexEmotions.map((emotion) => (
                                            <EmotionChip
                                                key={emotion.tag}
                                                emotion={emotion}
                                                onClick={() => handleSelect(emotion.tag)}
                                                className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-200"
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* 푸터 */}
                <div className="p-3 border-t border-bg-tertiary text-center text-xs text-text-secondary">
                    총 {allEmotionTags.length}개의 감정 표현 · 없으면 검색창에서 직접 추가
                </div>
            </div>
        </div>
    );
};

export default EmotionPickerModal;
