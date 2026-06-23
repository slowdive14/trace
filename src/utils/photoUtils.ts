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
