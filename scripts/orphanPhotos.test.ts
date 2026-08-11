import { describe, it, expect } from 'vitest';
import {
    extractStoragePathFromUrl, collectPathsFromDoc, findOrphans, type StorageEntry,
} from './orphanPhotos';

const URL_FOR = (path: string) =>
    `https://firebasestorage.googleapis.com/v0/b/trace-fa37e.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media&token=abc-123`;

describe('extractStoragePathFromUrl', () => {
    it('다운로드 URL에서 객체 경로를 뽑는다', () => {
        expect(extractStoragePathFromUrl(URL_FOR('users/u1/photos/a.jpg')))
            .toBe('users/u1/photos/a.jpg');
    });

    it('경로에 슬래시가 인코딩돼 있어도 복원한다', () => {
        const url = 'https://firebasestorage.googleapis.com/v0/b/b/o/users%2Fu1%2Fphotos%2Fx.jpg?alt=media';
        expect(extractStoragePathFromUrl(url)).toBe('users/u1/photos/x.jpg');
    });

    it('형식이 아니면 null', () => {
        expect(extractStoragePathFromUrl('https://example.com/a.jpg')).toBeNull();
        expect(extractStoragePathFromUrl('')).toBeNull();
    });
});

describe('collectPathsFromDoc', () => {
    it('photos의 path를 모은다', () => {
        expect(collectPathsFromDoc({ photos: [{ path: 'users/u1/photos/a.jpg', url: URL_FOR('users/u1/photos/a.jpg') }] }))
            .toEqual(['users/u1/photos/a.jpg']);
    });

    it('path 없이 url만 있어도 참조로 인정한다 (오삭제 방지)', () => {
        // 예전 기록에 path가 없을 수 있다. 이걸 놓치면 멀쩡한 사진을 미아로 지운다.
        expect(collectPathsFromDoc({ photos: [{ url: URL_FOR('users/u1/photos/old.jpg') }] }))
            .toEqual(['users/u1/photos/old.jpg']);
    });

    it('path와 url이 가리키는 곳이 다르면 둘 다 참조로 본다', () => {
        const paths = collectPathsFromDoc({
            photos: [{ path: 'users/u1/photos/a.jpg', url: URL_FOR('users/u1/photos/b.jpg') }],
        });
        expect(paths).toContain('users/u1/photos/a.jpg');
        expect(paths).toContain('users/u1/photos/b.jpg');
    });

    it('사진이 없는 문서는 빈 배열', () => {
        expect(collectPathsFromDoc({ content: '메모' })).toEqual([]);
        expect(collectPathsFromDoc({ photos: [] })).toEqual([]);
        expect(collectPathsFromDoc(null)).toEqual([]);
        expect(collectPathsFromDoc({ photos: 'not-an-array' })).toEqual([]);
    });
});

describe('findOrphans', () => {
    const NOW = new Date(2026, 7, 11, 12, 0, 0);
    const HOUR = 60 * 60 * 1000;
    const file = (path: string, ageMs: number, size = 300_000): StorageEntry =>
        ({ path, size, createdAt: new Date(NOW.getTime() - ageMs) });

    it('참조된 파일은 미아가 아니다', () => {
        const files = [file('users/u1/photos/a.jpg', 5 * HOUR)];
        const r = findOrphans(files, new Set(['users/u1/photos/a.jpg']), NOW, HOUR);
        expect(r.orphans).toEqual([]);
    });

    it('참조 없는 오래된 파일은 미아', () => {
        const files = [file('users/u1/photos/lost.jpg', 5 * HOUR)];
        const r = findOrphans(files, new Set(), NOW, HOUR);
        expect(r.orphans.map(f => f.path)).toEqual(['users/u1/photos/lost.jpg']);
    });

    it('방금 올라온 파일은 건드리지 않는다 (업로드 진행 중일 수 있음)', () => {
        const files = [file('users/u1/photos/inflight.jpg', 2 * 60 * 1000)];  // 2분 전
        const r = findOrphans(files, new Set(), NOW, HOUR);
        expect(r.orphans).toEqual([]);
        expect(r.tooRecent.map(f => f.path)).toEqual(['users/u1/photos/inflight.jpg']);
    });

    it('참조·미아·보류를 함께 분류한다', () => {
        const files = [
            file('users/u1/photos/keep.jpg', 10 * HOUR),
            file('users/u1/photos/lost1.jpg', 10 * HOUR),
            file('users/u1/photos/lost2.jpg', 3 * HOUR),
            file('users/u1/photos/new.jpg', 60 * 1000),
        ];
        const r = findOrphans(files, new Set(['users/u1/photos/keep.jpg']), NOW, HOUR);
        expect(r.orphans.map(f => f.path)).toEqual(['users/u1/photos/lost1.jpg', 'users/u1/photos/lost2.jpg']);
        expect(r.tooRecent.map(f => f.path)).toEqual(['users/u1/photos/new.jpg']);
        expect(r.referencedCount).toBe(1);
    });
});
