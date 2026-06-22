import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { EntryPhoto } from '../types/types';

interface LightboxProps {
    photos: EntryPhoto[];
    startIndex: number;
    onClose: () => void;
}

// 전체화면 사진 뷰어 (여러 장 이동·키보드·닫기)
const Lightbox: React.FC<LightboxProps> = ({ photos, startIndex, onClose }) => {
    const [index, setIndex] = useState(startIndex);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + photos.length) % photos.length);
            else if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % photos.length);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [photos.length, onClose]);

    const photo = photos[index];
    if (!photo) return null;

    return (
        <div className="fixed inset-0 bg-black/90 z-[220] flex items-center justify-center" onClick={onClose}>
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
                aria-label="닫기"
            >
                <X size={28} />
            </button>

            {photos.length > 1 && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIndex((i) => (i - 1 + photos.length) % photos.length); }}
                        className="absolute left-2 sm:left-4 text-white/70 hover:text-white p-2"
                        aria-label="이전 사진"
                    >
                        <ChevronLeft size={36} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIndex((i) => (i + 1) % photos.length); }}
                        className="absolute right-2 sm:right-4 text-white/70 hover:text-white p-2"
                        aria-label="다음 사진"
                    >
                        <ChevronRight size={36} />
                    </button>
                </>
            )}

            <img
                src={photo.url}
                alt=""
                className="max-w-[92vw] max-h-[88vh] object-contain select-none"
                onClick={(e) => e.stopPropagation()}
            />

            {photos.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
                    {index + 1} / {photos.length}
                </div>
            )}
        </div>
    );
};

export default Lightbox;
