/**
 * 미아 사진 판별 로직 (순수 함수 — Firebase·파일시스템 의존 없음)
 *
 * '미아'는 Storage에는 있는데 어떤 기록에서도 참조하지 않는 파일이다.
 * 업로드는 됐지만 엔트리 저장 단계에서 실패한 경우 이렇게 남는다.
 */

/**
 * Firebase 다운로드 URL에서 객체 경로를 뽑는다.
 * 예전 기록 중 path 없이 url만 가진 것이 있을 수 있어, 그런 경우에도
 * 참조된 것으로 인식해야 한다. (아니면 멀쩡한 사진을 미아로 오인해 지운다)
 *
 * 형식: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token=...
 */
export function extractStoragePathFromUrl(url: string): string | null {
    if (typeof url !== 'string') return null;
    const m = url.match(/\/o\/([^?]+)/);
    if (!m) return null;
    try {
        return decodeURIComponent(m[1]);
    } catch {
        return null;
    }
}

/** 문서 하나에서 참조하는 Storage 경로들을 모은다 */
export function collectPathsFromDoc(data: unknown): string[] {
    const out: string[] = [];
    const photos = (data as { photos?: unknown })?.photos;
    if (!Array.isArray(photos)) return out;

    for (const p of photos) {
        if (!p || typeof p !== 'object') continue;
        const { path, url } = p as { path?: unknown; url?: unknown };
        if (typeof path === 'string' && path) {
            out.push(path);
        } else if (typeof url === 'string') {
            const fromUrl = extractStoragePathFromUrl(url);
            if (fromUrl) out.push(fromUrl);
        }
        // path가 있어도 url에서 뽑은 경로가 다를 수 있으니 함께 넣어 둔다 (보수적으로)
        if (typeof url === 'string') {
            const fromUrl = extractStoragePathFromUrl(url);
            if (fromUrl && !out.includes(fromUrl)) out.push(fromUrl);
        }
    }
    return out;
}

export interface StorageEntry {
    path: string;
    /** 업로드 시각 */
    createdAt: Date;
    size: number;
}

export interface OrphanResult {
    orphans: StorageEntry[];
    /** 너무 최근이라 판단을 보류한 파일 (업로드 진행 중일 수 있음) */
    tooRecent: StorageEntry[];
    referencedCount: number;
}

/**
 * @param minAgeMs 이보다 최근에 만들어진 파일은 건드리지 않는다.
 *                 지금 올리는 중인 사진을 지워 버리는 사고를 막기 위함.
 */
export function findOrphans(
    files: StorageEntry[],
    referenced: Set<string>,
    now: Date,
    minAgeMs: number,
): OrphanResult {
    const orphans: StorageEntry[] = [];
    const tooRecent: StorageEntry[] = [];

    for (const f of files) {
        if (referenced.has(f.path)) continue;
        if (now.getTime() - f.createdAt.getTime() < minAgeMs) {
            tooRecent.push(f);
            continue;
        }
        orphans.push(f);
    }

    return { orphans, tooRecent, referencedCount: referenced.size };
}

export const formatBytes = (n: number): string =>
    n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB`
        : n >= 1024 ? `${(n / 1024).toFixed(0)}KB`
            : `${n}B`;
