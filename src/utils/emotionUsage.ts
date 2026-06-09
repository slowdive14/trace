// 감정 태그 사용 기록 (localStorage) - "빠른 선택" 줄에 최근/자주 쓰는 감정을 노출하기 위함
import { findEmotionByTag, type EmotionTag } from './emotionTags';

const STORAGE_KEY = 'serein_emotion_usage_v1';
const MAX_TRACKED = 60; // 저장할 최대 감정 종류 수

interface EmotionUsageRecord {
    tag: string;
    count: number;
    lastUsed: number; // epoch ms
}

const readUsage = (): EmotionUsageRecord[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeUsage = (records: EmotionUsageRecord[]) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_TRACKED)));
    } catch {
        // localStorage 미지원/용량초과 등은 조용히 무시
    }
};

// 감정 선택 시 호출 - 카운트 증가 및 최근 사용 시각 갱신
export const recordEmotionUse = (tag: string): void => {
    if (!tag) return;
    const records = readUsage();
    const now = Date.now();
    const existing = records.find((r) => r.tag === tag);
    if (existing) {
        existing.count += 1;
        existing.lastUsed = now;
    } else {
        records.push({ tag, count: 1, lastUsed: now });
    }
    // 최근 사용 순으로 정렬 (저장 용량 초과 시 오래된 것부터 잘림)
    records.sort((a, b) => b.lastUsed - a.lastUsed);
    writeUsage(records);
};

// 빠른 선택용 감정 목록 - 최근성(60%)과 빈도(40%)를 혼합한 점수로 정렬
export const getQuickEmotions = (limit = 10): EmotionTag[] => {
    const records = readUsage();
    if (records.length === 0) return [];

    const maxCount = Math.max(...records.map((r) => r.count), 1);
    const now = Date.now();
    const DAY = 1000 * 60 * 60 * 24;

    const scored = records.map((r) => {
        const recencyDays = (now - r.lastUsed) / DAY;
        const recencyScore = Math.max(0, 1 - recencyDays / 30); // 최근 30일 가중
        const frequencyScore = r.count / maxCount;
        return { tag: r.tag, score: recencyScore * 0.6 + frequencyScore * 0.4 };
    });

    scored.sort((a, b) => b.score - a.score);

    // 데이터셋에 아직 존재하는 감정만 반환 (태그가 삭제/변경된 경우 제외)
    return scored
        .map((s) => findEmotionByTag(s.tag))
        .filter((e): e is EmotionTag => !!e)
        .slice(0, limit);
};
