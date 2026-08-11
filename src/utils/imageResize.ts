// 이미지 리사이즈/압축 — Firebase 의존 없음(순수 계산은 단위테스트 가능)

// 긴 변을 maxEdge로 맞춘 목표 크기. 확대는 하지 않고, 잘못된 입력은 0으로 방어.
export function computeTargetSize(
    width: number,
    height: number,
    maxEdge: number,
): { w: number; h: number } {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return { w: 0, h: 0 };
    }
    const longEdge = Math.max(width, height);
    if (longEdge <= maxEdge) {
        return { w: Math.round(width), h: Math.round(height) };
    }
    const scale = maxEdge / longEdge;
    return { w: Math.round(width * scale), h: Math.round(height * scale) };
}

// 비동기 작업이 무한정 멈추지 않도록 타임아웃을 건다(모바일에서 일부 디코딩/업로드가 hang하는 경우 방지).
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} 시간 초과`)), ms);
        promise.then(
            (v) => { clearTimeout(timer); resolve(v); },
            (e) => { clearTimeout(timer); reject(e); },
        );
    });
}

/** 진행률을 보고하고 취소할 수 있는 작업 (Firebase의 UploadTask 모양) */
export interface ProgressTask {
    on(
        event: 'state_changed',
        next: (snap: { bytesTransferred: number; totalBytes: number }) => void,
        error: (e: unknown) => void,
        complete: () => void,
    ): void;
    cancel(): void;
}

/**
 * 전송이 멈추면 작업을 '취소'하고 실패시킨다.
 * 고정 벽시계 타임아웃과 달리, 느리지만 진행 중인 전송은 살려 둔다.
 * 그리고 반드시 cancel()을 불러야 죽은 전송이 대역폭을 계속 먹지 않는다.
 *
 * 제한 시간을 두 단계로 나눈 이유:
 * Firebase의 재개 가능 업로드는 청크 단위로 진척을 보고하는데 첫 청크가 256KB다.
 * 압축된 사진은 대개 그보다 작아서 청크가 하나뿐이고, 그러면 진척 보고가
 * '0%'와 '완료' 둘뿐이다. 단일 무진척 타이머를 쓰면 그 시간이 곧 총 제한이 되어,
 * 느린 모바일 회선에서 멀쩡한 업로드가 잘려나간다.
 * 그래서 첫 진척이 오기까지는 넉넉히 기다리고(토큰 발급·세션 생성·단일 요청 포함),
 * 바이트가 움직이기 시작한 뒤에야 짧은 정체 감지로 전환한다.
 *
 * @param firstProgressMs 첫 바이트가 움직이기까지 허용할 시간
 * @param stallMs         전송이 시작된 뒤 정체로 볼 시간
 */
export function runWithStallGuard(
    task: ProgressTask,
    firstProgressMs: number,
    stallMs: number,
    onProgress?: (fraction: number) => void,
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout>;
        let settled = false;
        let moved = false;   // 실제로 바이트가 움직였는가

        const finish = (fn: () => void) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            fn();
        };

        const arm = (ms: number, message: string) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                finish(() => {
                    try { task.cancel(); } catch { /* 이미 끝난 작업이면 무시 */ }
                    reject(new Error(message));
                });
            }, ms);
        };

        const armStart = () => arm(firstProgressMs, '업로드를 시작하지 못했습니다 (네트워크 확인)');
        const armStall = () => arm(stallMs, '업로드가 도중에 멈췄습니다 (네트워크 확인)');

        armStart();
        task.on(
            'state_changed',
            snap => {
                if (snap.bytesTransferred > 0) {
                    moved = true;
                    armStall();     // 전송이 시작됐다 → 짧은 정체 감지로 전환
                } else if (!moved) {
                    armStart();     // 아직 0바이트 (running 통지 등) → 시작 대기 시간을 되감는다
                }
                if (snap.totalBytes > 0) onProgress?.(snap.bytesTransferred / snap.totalBytes);
            },
            err => finish(() => reject(err)),
            () => finish(resolve),
        );
    });
}

/** 일시적 실패를 지수 백오프로 재시도. 권한 오류·취소는 즉시 포기한다. */
export async function retryAsync<T>(
    fn: () => Promise<T>,
    attempts: number,
    label: string,
    delay: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms)),
): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            return await fn();
        } catch (e) {
            lastError = e;
            const code = (e as { code?: string })?.code ?? '';
            if (code.includes('unauthorized') || code.includes('canceled')) break;
            if (attempt < attempts - 1) await delay(800 * 2 ** attempt);
        }
    }
    throw lastError instanceof Error ? lastError : new Error(`${label} 실패`);
}

/**
 * 디코딩 제한 시간.
 * 예전 12초는 너무 짧았다. 몇 달 전 사진처럼 원본 해상도가 큰 파일(1200만 화소 이상)을
 * 여러 장 연달아 처리하면 모바일 CPU에서 12초를 넘기기 쉽고, 그러면 압축이 '실패'로
 * 처리돼 원본이 그대로 올라가다 5MB 규칙에 걸려 업로드가 실패했다.
 * 네트워크가 아니라 CPU 작업이라 조금 더 기다려 주는 편이 낫다.
 */
const DECODE_TIMEOUT_MS = 25000;

// 파일 → 디코딩된 이미지 (ImageBitmap 우선, 실패/지연 시 <img> 폴백). 각 단계에 타임아웃.
async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
    if (typeof createImageBitmap === 'function') {
        try {
            // 주의: resize 옵션은 일부 모바일 브라우저에서 특정 HDR JPEG에 대해 hang하므로 쓰지 않는다.
            return await withTimeout(createImageBitmap(file), DECODE_TIMEOUT_MS, '이미지 디코딩');
        } catch {
            // HEIC/HDR 등 일부 포맷·환경에서 실패하거나 지연 → <img>로 폴백
        }
    }
    return await new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        const cleanup = () => URL.revokeObjectURL(url);
        const timer = setTimeout(() => { cleanup(); reject(new Error('이미지 디코딩 시간 초과')); }, DECODE_TIMEOUT_MS);
        img.onload = () => { clearTimeout(timer); cleanup(); resolve(img); };
        img.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error('이미지를 디코딩할 수 없습니다 (지원되지 않는 형식일 수 있어요)')); };
        img.src = url;
    });
}

// 업로드 전 리사이즈 + JPEG 압축
export async function compressImage(
    file: File,
    maxEdge = 1600,
    quality = 0.82,
): Promise<{ blob: Blob; w: number; h: number }> {
    const source = await decodeImage(file);
    const sw = (source as HTMLImageElement).naturalWidth || source.width;
    const sh = (source as HTMLImageElement).naturalHeight || source.height;
    const { w, h } = computeTargetSize(sw, sh, maxEdge);

    const canvas = document.createElement('canvas');
    canvas.width = w || sw;
    canvas.height = h || sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2D 컨텍스트를 사용할 수 없습니다');
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    if ('close' in source && typeof source.close === 'function') source.close(); // ImageBitmap 메모리 정리

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('이미지 인코딩 실패'))),
            'image/jpeg',
            quality,
        );
    });
    return { blob, w: canvas.width, h: canvas.height };
}
