import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Shuffle, ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react';
import type { Entry } from '../types/types';
import { toBookCards, sortBookCards, getBookColor, type ShelfSort, type BookCard } from '../utils/bookUtils';

interface BookshelfViewProps {
    entries: Entry[];
    onSelectEntry?: (entry: Entry) => void;
}

// w-full이 없으면 button이 내용(제목) 크기에 맞춰져 카드 너비가 제목 길이에
// 끌려간다. 표지가 aspect-[3/4]라 높이까지 제각각이 되고, 제목이 길면 열을
// 넘어가 화면 밖으로 삐져나온다.
const Card: React.FC<{ card: BookCard; highlight?: boolean; onClick?: () => void }> = ({ card, highlight, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full min-w-0 text-left group flex flex-col ${highlight ? 'ring-2 ring-accent rounded-lg' : ''}`}
    >
        {/* 표지 — 사진이 있으면 사진, 없으면 제목을 얹은 색면 */}
        <div
            className="relative w-full aspect-[3/4] rounded-lg overflow-hidden shadow-sm"
            style={card.coverUrl ? undefined : { backgroundColor: getBookColor(card.title) }}
        >
            {card.coverUrl ? (
                <img src={card.coverUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
            ) : (
                <div className="absolute inset-0 p-2 flex items-start">
                    <span className="text-white/95 text-[11px] font-medium leading-snug line-clamp-5 break-keep">
                        {card.title}
                    </span>
                </div>
            )}
            {/* 오래 묵은 책일수록 눈에 띄게 */}
            {card.daysSince >= 90 && (
                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/65 text-white text-[9px] tabular-nums">
                    {Math.floor(card.daysSince / 30)}개월째
                </span>
            )}
        </div>

        <div className="mt-1.5 min-w-0">
            <div className="text-[11px] text-text-primary leading-snug line-clamp-2 break-keep">
                {card.title}
            </div>
            <div className="text-[10px] text-text-tertiary tabular-nums mt-0.5">
                {format(card.entry.timestamp, 'yy.M.d', { locale: ko })}
            </div>
        </div>
    </button>
);

const BookshelfView: React.FC<BookshelfViewProps> = ({ entries, onSelectEntry }) => {
    const [sort, setSort] = useState<ShelfSort>('recent');
    const [pickedId, setPickedId] = useState<string | null>(null);

    const cards = useMemo(() => sortBookCards(toBookCards(entries), sort), [entries, sort]);

    // 고를 게 너무 많아 못 고르는 상태를 풀어주는 장치
    const pickRandom = () => {
        if (cards.length === 0) return;
        const next = cards[Math.floor(Math.random() * cards.length)];
        setPickedId(next.entry.id);
        document.querySelector(`[data-shelf-id="${next.entry.id}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    if (entries.length === 0) {
        return (
            <div className="text-center text-text-tertiary text-sm py-16">
                기록된 책이 없습니다.
            </div>
        );
    }

    const picked = cards.find(c => c.entry.id === pickedId);

    return (
        <div className="pt-3">
            {/* 정렬 · 무작위 고르기 */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-text-tertiary tabular-nums">{cards.length}권</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setSort(s => s === 'recent' ? 'oldest' : 'recent')}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-secondary transition-colors"
                        title="정렬 바꾸기"
                    >
                        {sort === 'recent'
                            ? <><ArrowDownWideNarrow size={12} /> 최근순</>
                            : <><ArrowUpWideNarrow size={12} /> 오래된순</>}
                    </button>
                    <button
                        onClick={pickRandom}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md text-text-tertiary hover:text-accent hover:bg-bg-secondary transition-colors"
                        title="무작위로 한 권 고르기"
                    >
                        <Shuffle size={12} /> 골라줘
                    </button>
                </div>
            </div>

            {/* 무작위로 뽑힌 책 */}
            {picked && (
                <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-accent/10">
                    <div
                        className="w-10 h-14 rounded shrink-0 overflow-hidden"
                        style={picked.coverUrl ? undefined : { backgroundColor: getBookColor(picked.title) }}
                    >
                        {picked.coverUrl && <img src={picked.coverUrl} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-text-tertiary">오늘은 이 책 어때요</div>
                        <div className="text-sm text-text-primary truncate">{picked.title}</div>
                        {picked.note && <div className="text-[11px] text-text-tertiary truncate">{picked.note}</div>}
                    </div>
                    <button onClick={() => setPickedId(null)} className="text-text-tertiary hover:text-text-primary text-xs shrink-0">
                        ✕
                    </button>
                </div>
            )}

            <div className="grid grid-cols-3 gap-x-3 gap-y-4">
                {cards.map(card => (
                    <div key={card.entry.id} data-shelf-id={card.entry.id} className="min-w-0">
                        <Card
                            card={card}
                            highlight={card.entry.id === pickedId}
                            onClick={() => onSelectEntry?.(card.entry)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BookshelfView;
