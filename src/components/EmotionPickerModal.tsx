import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { allEmotionTags, emotionsBySubcategory, searchEmotions, type EmotionTag } from '../utils/emotionTags';

interface EmotionPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (tag: string) => void;
}

const EmotionPickerModal: React.FC<EmotionPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'core' | 'korean'>('core');

    // 검색 결과
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return null;
        return searchEmotions(searchQuery);
    }, [searchQuery]);

    // 탭별 필터링된 감정들
    const filteredEmotionsBySubcategory = useMemo(() => {
        const filtered: Record<string, EmotionTag[]> = {};
        Object.entries(emotionsBySubcategory).forEach(([subcategory, emotions]) => {
            const categoryFiltered = emotions.filter(emotion => {
                if (activeTab === 'core') {
                    return emotion.category === '핵심';
                } else {
                    return emotion.category === '한국어 특유';
                }
            });
            if (categoryFiltered.length > 0) {
                filtered[subcategory] = categoryFiltered;
            }
        });
        return filtered;
    }, [activeTab]);

    const handleSelect = (tag: string) => {
        onSelect(tag);
        setSearchQuery('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-bg-secondary rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between p-6 border-b border-bg-tertiary">
                    <h2 className="text-xl font-bold">😊 감정 태그 선택</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 검색창 */}
                <div className="p-4 border-b border-bg-tertiary">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="감정 이름이나 설명으로 검색..."
                            className="w-full pl-10 pr-4 py-2 bg-bg-tertiary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                            autoFocus
                        />
                    </div>
                </div>

                {/* 검색 결과 또는 카테고리 탭 */}
                {searchResults ? (
                    // 검색 결과 표시
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="text-sm text-text-secondary mb-2">
                            {searchResults.length}개의 감정 찾음
                        </div>
                        <div className="space-y-2">
                            {searchResults.map((emotion) => (
                                <button
                                    key={emotion.tag}
                                    onClick={() => handleSelect(emotion.tag)}
                                    className="w-full text-left p-3 bg-bg-tertiary hover:bg-bg-primary rounded-lg transition-colors group"
                                >
                                    <div className="font-medium text-accent group-hover:text-accent-hover">
                                        {emotion.tag}
                                    </div>
                                    <div className="text-sm text-text-secondary mt-1">
                                        {emotion.meaning}
                                    </div>
                                    {emotion.bodyPart && (
                                        <div className="text-xs text-purple-400 mt-1">
                                            신체: {emotion.bodyPart}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* 카테고리 탭 */}
                        <div className="flex gap-2 p-4 border-b border-bg-tertiary">
                            <button
                                onClick={() => setActiveTab('core')}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                                    activeTab === 'core'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                핵심 감정 매트릭스 (65개)
                            </button>
                            <button
                                onClick={() => setActiveTab('korean')}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                                    activeTab === 'korean'
                                        ? 'bg-purple-500 text-white'
                                        : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                한국어 특유 표현 (35개)
                            </button>
                        </div>

                        {/* 서브카테고리별 감정 목록 */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {Object.entries(filteredEmotionsBySubcategory).map(([subcategory, emotions]) => (
                                <div key={subcategory}>
                                    <h3 className="font-semibold text-text-primary mb-3 sticky top-0 bg-bg-secondary py-2">
                                        {subcategory}
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {emotions.map((emotion) => (
                                            <button
                                                key={emotion.tag}
                                                onClick={() => handleSelect(emotion.tag)}
                                                className="text-left p-3 bg-bg-tertiary hover:bg-bg-primary rounded-lg transition-colors group"
                                            >
                                                <div className="font-medium text-accent group-hover:text-accent-hover text-sm">
                                                    {emotion.tag}
                                                </div>
                                                <div className="text-xs text-text-secondary mt-1 line-clamp-2">
                                                    {emotion.meaning}
                                                </div>
                                                {emotion.bodyPart && (
                                                    <div className="text-xs text-purple-400 mt-1">
                                                        📍 {emotion.bodyPart}
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* 통계 정보 푸터 */}
                <div className="p-4 border-t border-bg-tertiary text-center text-xs text-text-secondary">
                    총 {allEmotionTags.length}개의 감정 표현 사용 가능
                </div>
            </div>
        </div>
    );
};

export default EmotionPickerModal;
