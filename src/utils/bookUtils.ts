import type { Entry } from '../types/types';

/**
 * 기록 본문에서 책 제목으로 쓸 문구를 뽑는다.
 * 기록 형식이 제각각일 수 있으므로 우선순위를 두고 관대하게 처리한다.
 *   1) 『』「」《》<> 안의 텍스트가 있으면 그것
 *   2) 없으면 첫 줄
 * 해시태그와 강조 표기는 제거한다.
 */
export const extractBookTitle = (content: string): string => {
    const cleaned = content
        .replace(/\s*\{eid:[^}]+\}/g, '')
        .replace(/#[^\s#]+/g, '')
        .replace(/\*\*/g, '')
        .replace(/==/g, '');

    const bracket = cleaned.match(/[『「《<]([^』」》>]{1,80})[』」》>]/);
    if (bracket?.[1]?.trim()) return bracket[1].trim();

    const firstLine = cleaned.split('\n').map(l => l.trim()).find(l => l.length > 0);
    return firstLine ?? '(제목 없음)';
};

/** 본문에서 제목을 뺀 나머지 메모 (카드 부제로 쓴다) */
export const extractBookNote = (content: string, title: string): string => {
    const cleaned = content
        .replace(/\s*\{eid:[^}]+\}/g, '')
        .replace(/#[^\s#]+/g, '')
        .replace(/\*\*/g, '')
        .replace(/==/g, '')
        .replace(/[『「《<][^』」》>]{1,80}[』」》>]/, '')
        .trim();

    const withoutTitle = cleaned.startsWith(title) ? cleaned.slice(title.length) : cleaned;
    return withoutTitle.replace(/^[\s\-–—:·,]+/, '').replace(/\s+/g, ' ').trim();
};

/** 제목 첫 글자로 안정적인 색을 정한다 (표지 사진이 없을 때 쓰는 대체 배경) */
export const getBookColor = (title: string): string => {
    const palette = [
        '#7c3aed', '#b45309', '#0f766e', '#9d174d',
        '#1d4ed8', '#4d7c0f', '#a16207', '#6d28d9',
    ];
    let hash = 0;
    for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
};

export interface BookCard {
    entry: Entry;
    title: string;
    note: string;
    coverUrl?: string;
    /** 기록한 지 며칠 지났는지 */
    daysSince: number;
}

export const toBookCards = (entries: Entry[], now: Date = new Date()): BookCard[] =>
    entries.map(entry => {
        const title = extractBookTitle(entry.content);
        const ms = now.getTime() - entry.timestamp.getTime();
        return {
            entry,
            title,
            note: extractBookNote(entry.content, title),
            coverUrl: entry.photos?.[0]?.url,
            daysSince: Math.max(0, Math.floor(ms / 86400000)),
        };
    });

export type ShelfSort = 'recent' | 'oldest';

export const sortBookCards = (cards: BookCard[], sort: ShelfSort): BookCard[] =>
    [...cards].sort((a, b) => sort === 'recent'
        ? b.entry.timestamp.getTime() - a.entry.timestamp.getTime()
        : a.entry.timestamp.getTime() - b.entry.timestamp.getTime());
