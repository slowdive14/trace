import React, { useMemo, useState } from 'react';
import { X, Images } from 'lucide-react';
import { format, subDays, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Entry, EntryPhoto } from '../types/types';
import { collectPhotosByDate } from '../utils/photoUtils';
import { getLogicalDate } from '../utils/dateUtils';
import Lightbox from './Lightbox';

interface PhotoGalleryProps {
    entries: Entry[];
    onClose: () => void;
    onJumpToEntry: (entryId: string) => void;
}

// 'yyyy-MM-dd' → 사람이 읽는 라벨 (오늘/어제/날짜)
const dateLabel = (dateKey: string): string => {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const today = getLogicalDate();
    if (isSameDay(date, today)) return '오늘';
    if (isSameDay(date, subDays(today, 1))) return '어제';
    return format(date, 'yyyy년 M월 d일 (eee)', { locale: ko });
};

// 날짜별 사진 그리드 갤러리 (앱 안의 미니 포토). 사진 탭 → 라이트박스 → "이 기록 보기"로 점프
const PhotoGallery: React.FC<PhotoGalleryProps> = ({ entries, onClose, onJumpToEntry }) => {
    const sections = useMemo(() => collectPhotosByDate(entries), [entries]);
    const totalCount = useMemo(() => sections.reduce((n, s) => n + s.photos.length, 0), [sections]);

    // 라이트박스: 탭한 섹션의 사진/출처 + 시작 인덱스
    const [lightbox, setLightbox] = useState<{ photos: EntryPhoto[]; entryIds: string[]; index: number } | null>(null);

    return (
        <div className="fixed inset-0 bg-bg-primary z-[200] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-bg-tertiary shrink-0 max-w-2xl mx-auto w-full">
                <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <Images size={20} /> 사진 갤러리
                    {totalCount > 0 && <span className="text-sm text-text-secondary font-normal">{totalCount}장</span>}
                </h2>
                <button onClick={onClose} className="text-text-secondary hover:text-text-primary" aria-label="닫기">
                    <X size={24} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-8 max-w-2xl mx-auto w-full">
                {sections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-text-secondary py-24">
                        <Images size={48} className="mb-4 opacity-30" />
                        <p className="font-medium">아직 사진이 없어요</p>
                        <p className="text-sm mt-1 opacity-70">일상 기록에 사진을 첨부하면 여기에 모여요.</p>
                    </div>
                ) : (
                    <div className="space-y-6 pt-4">
                        {sections.map(section => (
                            <div key={section.dateKey}>
                                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-bg-primary/95 backdrop-blur py-1.5 z-10">
                                    <h3 className="text-sm font-bold text-text-secondary">{dateLabel(section.dateKey)}</h3>
                                    <span className="text-xs text-text-tertiary">{section.photos.length}장</span>
                                </div>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                    {section.photos.map((gp, i) => (
                                        <button
                                            key={`${gp.entryId}-${i}`}
                                            onClick={() => setLightbox({
                                                photos: section.photos.map(p => p.photo),
                                                entryIds: section.photos.map(p => p.entryId),
                                                index: i,
                                            })}
                                            className="aspect-square rounded-lg overflow-hidden bg-bg-tertiary hover:opacity-90 transition-opacity"
                                        >
                                            <img src={gp.photo.url} alt="" className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {lightbox && (
                <Lightbox
                    photos={lightbox.photos}
                    entryIds={lightbox.entryIds}
                    startIndex={lightbox.index}
                    onClose={() => setLightbox(null)}
                    onJumpToEntry={(id) => { setLightbox(null); onJumpToEntry(id); }}
                />
            )}
        </div>
    );
};

export default PhotoGallery;
