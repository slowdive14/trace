import { describe, it, expect } from 'vitest';
import { getRepresentativePhotoByDate, collectPhotosByDate } from '../photoUtils';
import type { Entry, EntryPhoto } from '../../types/types';

const photo = (url: string): EntryPhoto => ({ url, path: `p/${url}` });

// 최소 엔트리 팩토리 (timestamp·photos만 의미 있음)
const entry = (id: string, ts: Date, photos?: EntryPhoto[]): Entry => ({
    id,
    content: '',
    tags: [],
    category: 'action',
    timestamp: ts,
    createdAt: ts,
    updatedAt: ts,
    ...(photos ? { photos } : {}),
});

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);

describe('getRepresentativePhotoByDate', () => {
    it('그날 가장 이른 기록의 첫 사진을 대표로 고른다', () => {
        const result = getRepresentativePhotoByDate([
            entry('b', at(2026, 6, 1, 15), [photo('late.jpg')]),
            entry('a', at(2026, 6, 1, 9), [photo('early.jpg'), photo('early2.jpg')]),
        ]);
        expect(result['2026-06-01'].url).toBe('early.jpg');
    });

    it('여러 날짜는 각각 대표 사진을 가진다', () => {
        const result = getRepresentativePhotoByDate([
            entry('a', at(2026, 6, 1, 10), [photo('jun1.jpg')]),
            entry('b', at(2026, 6, 2, 10), [photo('jun2.jpg')]),
        ]);
        expect(result['2026-06-01'].url).toBe('jun1.jpg');
        expect(result['2026-06-02'].url).toBe('jun2.jpg');
    });

    it('사진 없는 엔트리는 무시한다', () => {
        const result = getRepresentativePhotoByDate([
            entry('a', at(2026, 6, 1, 10)),
            entry('b', at(2026, 6, 1, 11), []),
        ]);
        expect(result['2026-06-01']).toBeUndefined();
        expect(Object.keys(result)).toHaveLength(0);
    });

    it('빈 입력은 빈 객체', () => {
        expect(getRepresentativePhotoByDate([])).toEqual({});
    });

    it('5AM 컷오프: 새벽 3시 사진은 전날로 묶인다', () => {
        const result = getRepresentativePhotoByDate([
            entry('a', at(2026, 6, 2, 3), [photo('dawn.jpg')]), // 6/2 03:00 → logical 6/1
        ]);
        expect(result['2026-06-01'].url).toBe('dawn.jpg');
        expect(result['2026-06-02']).toBeUndefined();
    });
});

describe('collectPhotosByDate', () => {
    it('날짜별 섹션으로 모으고 날짜 내림차순으로 정렬한다', () => {
        const r = collectPhotosByDate([
            entry('a', at(2026, 6, 1, 10), [photo('jun1.jpg')]),
            entry('b', at(2026, 6, 3, 10), [photo('jun3.jpg')]),
        ]);
        expect(r.map(s => s.dateKey)).toEqual(['2026-06-03', '2026-06-01']);
    });

    it('한 엔트리의 여러 사진을 배열 순서대로 모두 포함하고 출처를 단다', () => {
        const r = collectPhotosByDate([
            entry('a', at(2026, 6, 1, 10), [photo('1.jpg'), photo('2.jpg')]),
        ]);
        expect(r[0].photos.map(p => p.photo.url)).toEqual(['1.jpg', '2.jpg']);
        expect(r[0].photos.every(p => p.entryId === 'a')).toBe(true);
    });

    it('같은 날 여러 엔트리는 최신 엔트리 사진이 먼저 온다', () => {
        const r = collectPhotosByDate([
            entry('early', at(2026, 6, 1, 9), [photo('early.jpg')]),
            entry('late', at(2026, 6, 1, 20), [photo('late.jpg')]),
        ]);
        expect(r).toHaveLength(1);
        expect(r[0].photos.map(p => p.photo.url)).toEqual(['late.jpg', 'early.jpg']);
    });

    it('사진 없는 엔트리는 무시하고 빈 입력은 빈 배열', () => {
        expect(collectPhotosByDate([])).toEqual([]);
        expect(collectPhotosByDate([entry('a', at(2026, 6, 1, 10))])).toEqual([]);
    });

    it('5AM 컷오프로 날짜를 묶는다', () => {
        const r = collectPhotosByDate([
            entry('a', at(2026, 6, 2, 3), [photo('dawn.jpg')]),
        ]);
        expect(r[0].dateKey).toBe('2026-06-01');
    });
});
