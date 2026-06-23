import { describe, it, expect } from 'vitest';
import { getRepresentativePhotoByDate } from '../photoUtils';
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
