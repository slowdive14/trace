// 날짜별 "오늘의 한 장" 대표 사진 선택 등 사진 관련 순수 셀렉터
import { format } from 'date-fns';
import { getLogicalDate } from './dateUtils';
import type { Entry, EntryPhoto } from '../types/types';

/**
 * 엔트리들에서 날짜(logical date, 5AM 컷오프)별 대표 사진을 고른다.
 * 대표 = 그날 "가장 이른" 기록의 첫 사진.
 * @returns `{ 'yyyy-MM-dd': EntryPhoto }` — 사진이 있는 날만 포함
 */
export function getRepresentativePhotoByDate(entries: Entry[]): Record<string, EntryPhoto> {
    // 같은 날 여러 사진 중 "첫 사진"을 안정적으로 고르기 위해 timestamp 오름차순 처리
    const sorted = [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const map: Record<string, EntryPhoto> = {};
    for (const entry of sorted) {
        const first = entry.photos?.[0];
        if (!first) continue;
        const key = format(getLogicalDate(entry.timestamp), 'yyyy-MM-dd');
        if (!map[key]) map[key] = first;
    }
    return map;
}

// 갤러리용: 사진 1장 + 출처 엔트리 정보(점프용)
export interface GalleryPhoto {
    photo: EntryPhoto;
    entryId: string;
    timestamp: Date;
}

// 날짜(logical date)별 사진 섹션
export interface GalleryDateSection {
    dateKey: string;          // 'yyyy-MM-dd'
    photos: GalleryPhoto[];
}

/**
 * 모든 엔트리의 사진을 날짜(logical date)별 섹션으로 모은다.
 * 섹션은 날짜 내림차순, 같은 날 안에서는 "최신 엔트리"의 사진이 먼저 온다.
 * 각 사진에 출처 엔트리(entryId·timestamp)를 담아 "해당 기록으로 점프"를 지원한다.
 */
export function collectPhotosByDate(entries: Entry[]): GalleryDateSection[] {
    const byDate = new Map<string, GalleryPhoto[]>();
    // 최신이 먼저 보이도록 timestamp 내림차순
    const sorted = [...entries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    for (const entry of sorted) {
        if (!entry.photos || entry.photos.length === 0) continue;
        const key = format(getLogicalDate(entry.timestamp), 'yyyy-MM-dd');
        let arr = byDate.get(key);
        if (!arr) { arr = []; byDate.set(key, arr); }
        for (const photo of entry.photos) {
            arr.push({ photo, entryId: entry.id, timestamp: entry.timestamp });
        }
    }
    return [...byDate.keys()]
        .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)) // 날짜 내림차순
        .map(dateKey => ({ dateKey, photos: byDate.get(dateKey)! }));
}
