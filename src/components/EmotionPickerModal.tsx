import React, { useState, useMemo } from 'react';
import { Search, X, Clock } from 'lucide-react';
import {
    allEmotionTags,
    emotionsBySubcategory,
    searchEmotions,
    moodMeterQuadrants,
    neutralEmotions,
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
    const [activeView, setActiveView] = useState<'mood' | 'korean'>('mood');
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

    // 한국어 특유 탭: 서브카테고리별
    const koreanBySubcategory = useMemo(() => {
        const filtered: Record<string, EmotionTag[]> = {};
        Object.entries(emotionsBySubcategory).forEach(([subcategory, emotions]) => {
            const koreanOnly = emotions.filter((e) => e.category === '한국어 특유');
            if (koreanOnly.length > 0) filtered[subcategory] = koreanOnly;
        });
        return filtered;
    }, []);

    const handleSelect = (tag: string) => {
        recordEmotionUse(tag);
        onSelect(tag);
        setSearchQuery('');
        onClose();
    };

    if (!isOpen) return null;

    const activeQuadrant = moodMeterQuadrants.find((q) => q.key === selectedQuadrant)!;

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
                            placeholder="감정 이름이나 느낌으로 검색..."
                            className="w-full pl-10 pr-4 py-2 bg-bg-tertiary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                    </div>
                </div>

                {searchResults ? (
                    /* 검색 결과 */
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="text-sm text-text-secondary mb-2">
                            {searchResults.length}개의 감정 찾음
                        </div>
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

                        {/* 뷰 전환 탭 */}
                        <div className="flex gap-2 p-4">
                            <button
                                onClick={() => setActiveView('mood')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                                    activeView === 'mood'
                                        ? 'bg-accent text-white'
                                        : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                🧭 무드미터
                            </button>
                            <button
                                onClick={() => setActiveView('korean')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                                    activeView === 'korean'
                                        ? 'bg-purple-500 text-white'
                                        : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                🇰🇷 한국어 특유
                            </button>
                        </div>

                        {activeView === 'mood' ? (
                            <div className="flex-1 overflow-y-auto px-4 pb-4">
                                {/* 2x2 무드미터 사분면 선택기 */}
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

                                {/* 선택된 사분면의 감정 칩 */}
                                <div className="flex flex-wrap gap-2">
                                    {activeQuadrant.emotions.map((emotion) => (
                                        <EmotionChip
                                            key={emotion.tag}
                                            emotion={emotion}
                                            onClick={() => handleSelect(emotion.tag)}
                                            className={`${activeQuadrant.chipBg} ${activeQuadrant.chipText}`}
                                        />
                                    ))}
                                </div>

                                {/* 중간/전환 감정 */}
                                {neutralEmotions.length > 0 && (
                                    <div className="mt-5">
                                        <div className="text-xs text-text-secondary mb-2">😶 중간 · 전환</div>
                                        <div className="flex flex-wrap gap-2">
                                            {neutralEmotions.map((emotion) => (
                                                <EmotionChip
                                                    key={emotion.tag}
                                                    emotion={emotion}
                                                    onClick={() => handleSelect(emotion.tag)}
                                                    className="bg-bg-tertiary hover:bg-bg-primary text-text-secondary"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* 한국어 특유 표현 */
                            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">
                                {Object.entries(koreanBySubcategory).map(([subcategory, emotions]) => (
                                    <div key={subcategory}>
                                        <h3 className="font-semibold text-text-primary text-sm mb-2">{subcategory}</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {emotions.map((emotion) => (
                                                <button
                                                    key={emotion.tag}
                                                    onClick={() => handleSelect(emotion.tag)}
                                                    title={emotion.meaning}
                                                    className="text-left p-2.5 bg-bg-tertiary hover:bg-bg-primary rounded-lg transition-colors flex items-start gap-2"
                                                >
                                                    <span className="text-xl leading-none mt-0.5">{emotion.emoji}</span>
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-purple-300 text-sm">
                                                            {getEmotionName(emotion.tag)}
                                                        </div>
                                                        <div className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                                                            {emotion.meaning}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* 푸터 */}
                <div className="p-3 border-t border-bg-tertiary text-center text-xs text-text-secondary">
                    총 {allEmotionTags.length}개의 감정 표현
                </div>
            </div>
        </div>
    );
};

export default EmotionPickerModal;
