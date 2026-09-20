// 이미지 리사이즈/압축 — Firebase 의존 없음(순수 계산은 단위테스트 가능)

/** 파일 앞부분으로 알아낸 실제 형식 */
export interface SniffedFormat {
    /** 사람이 읽을 이름 ('JPEG', 'HEIC' 등). 모르면 'unknown' */
    label: string;
    /** 브라우저 캔버스가 그릴 수 있다고 알려진 형식인가 */
    drawable: boolean;
    /** 업로드할 때 쓸 MIME 타입 (모르면 undefined) */
    mime?: string;
    /** 파일 이름에 붙일 확장자 */
    ext: string;
}

const ascii = (head: Uint8Array, from: number, to: number) =>
    String.fromCharCode(...head.subarray(from, to));

/**
 * 파일 앞부분 바이트로 실제 형식을 알아낸다.
 *
 * 확장자와 file.type은 믿을 수 없다. 아이폰이 HEIC로 찍은 사진이 전송 과정에서
 * 이름만 .jpg로 바뀌는 일이 흔하고, 그러면 크롬 계열 브라우저는 디코딩하지 못한다.
 * 실패했을 때 "형식이 원인인지"를 추측이 아니라 파일로 확인하려고 둔다.
 */
export function sniffImageFormat(head: Uint8Array): SniffedFormat {
    if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
        return { label: 'JPEG', drawable: true, mime: 'image/jpeg', ext: 'jpg' };
    }
    if (head[0] === 0x89 && ascii(head, 1, 4) === 'PNG') {
        return { label: 'PNG', drawable: true, mime: 'image/png', ext: 'png' };
    }
    if (ascii(head, 0, 3) === 'GIF') {
        return { label: 'GIF', drawable: true, mime: 'image/gif', ext: 'gif' };
    }
    if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') {
        return { label: 'WebP', drawable: true, mime: 'image/webp', ext: 'webp' };
    }
    // ISO 베이스 미디어 컨테이너 (HEIC·AVIF 계열): 4~8바이트가 'ftyp'
    if (ascii(head, 4, 8) === 'ftyp') {
        const brand = ascii(head, 8, 12);
        if (brand.startsWith('avif') || brand.startsWith('avis')) {
            // AVIF는 요즘 브라우저 대부분이 그린다
            return { label: 'AVIF', drawable: true, mime: 'image/avif', ext: 'avif' };
        }
        // heic·heix·hevc·mif1·msf1 등 — 크롬 계열은 그리지 못한다
        return { label: 'HEIC', drawable: false, mime: 'image/heic', ext: 'heic' };
    }
    return { label: 'unknown', drawable: false, ext: 'bin' };
}

/** 파일 앞 16바이트를 읽어 형식을 알아낸다 */
export async function sniffImageFile(file: Blob): Promise<SniffedFormat> {
    try {
        const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
        return sniffImageFormat(head);
    } catch {
        return { label: 'unknown', drawable: false, ext: 'bin' };
    }
}

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

/**
 * 압축 결과가 이보다 작으면 실패로 본다.
 * 모바일에서 메모리가 모자라면 캔버스가 통째로 비어 흰 이미지가 나오는데,
 * 오류 없이 성공한 것처럼 돌아오므로 크기로 걸러야 알아챌 수 있다.
 */
const MIN_PLAUSIBLE_BYTES = 1024;

/** 디코딩된 이미지와 그 정리 방법 */
interface Decoded {
    source: CanvasImageSource;
    width: number;
    height: number;
    close: () => void;
}

function decodeViaBitmap(file: File): Promise<Decoded> {
    // 주의: resize 옵션은 일부 모바일 브라우저에서 특정 HDR JPEG에 대해 멈추므로 쓰지 않는다.
    return createImageBitmap(file).then(bitmap => ({
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
    }));
}

function decodeViaImgElement(file: File): Promise<Decoded> {
    return new Promise<Decoded>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => resolve({
            source: img,
            width: img.naturalWidth,
            height: img.naturalHeight,
            // 그리기가 끝난 뒤 정리한다. 로드가 끝났어도 URL을 먼저 거두면
            // 일부 브라우저에서 drawImage가 빈 결과를 낸다.
            close: () => URL.revokeObjectURL(url),
        });
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('이미지를 열지 못했습니다'));
        };
        img.src = url;
    });
}

/**
 * 여러 경로를 함께 시작해 먼저 되는 쪽을 쓰고, 늦게 도착한 쪽은 거둔다.
 *
 * 순서대로 시도하면 앞의 것이 멈췄을 때 제한 시간을 통째로 버리고 다음을 시작한다.
 * 그동안 멈춘 작업이 메모리를 붙잡고 있어 뒤 작업까지 연달아 실패한다.
 * 모두 실패하면 이유를 모아 알린다 (한 가지 원인으로 단정하지 않는다).
 */
export async function firstSuccess<T extends { close: () => void }>(
    candidates: Promise<T>[],
    label: string,
): Promise<T> {
    let announce!: (winner: T | undefined) => void;
    const decided = new Promise<T | undefined>(resolve => { announce = resolve; });

    // 후보마다 한 번씩만 판단한다. 승자가 정해질 때까지 기다렸다가,
    // 자기가 승자가 아니면 그 자리에서 거둔다 (승자는 호출자가 거둔다).
    for (const p of candidates) {
        p.then(
            async value => {
                if (value !== await decided) value.close();
            },
            () => { /* 실패한 쪽은 스스로 정리한다 */ },
        );
    }

    try {
        const winner = await Promise.any(candidates);
        announce(winner);
        return winner;
    } catch (e) {
        announce(undefined);
        const reasons = e instanceof AggregateError
            ? e.errors.map(err => (err instanceof Error ? err.message : String(err))).join(', ')
            : String(e);
        throw new Error(`${label} (${reasons})`);
    }
}

/**
 * 파일 → 디코딩된 이미지.
 *
 * 두 경로(ImageBitmap, <img>)를 함께 시작한다. 예전에는 ImageBitmap을 먼저
 * 기다렸다가 실패하면 <img>로 넘어갔는데, 멈춘 경우 제한 시간(25초)을 버리고
 * 다시 25초를 기다려야 했다. 한 장에 50초가 걸리고, 그동안 멈춘 디코딩이
 * 메모리를 쥐고 있어 다음 사진까지 연달아 실패했다.
 */
async function decodeImage(file: File): Promise<Decoded> {
    const candidates: Promise<Decoded>[] = [];
    if (typeof createImageBitmap === 'function') candidates.push(decodeViaBitmap(file));
    candidates.push(decodeViaImgElement(file));

    return await withTimeout(
        firstSuccess(candidates, '이미지를 디코딩하지 못했습니다'),
        DECODE_TIMEOUT_MS,
        '이미지 디코딩',
    );
}

/** 디코딩된 이미지를 주어진 크기·품질의 JPEG으로 만든다 */
async function drawToJpeg(
    decoded: Decoded,
    maxEdge: number,
    quality: number,
): Promise<{ blob: Blob; w: number; h: number }> {
    const { w, h } = computeTargetSize(decoded.width, decoded.height, maxEdge);

    const canvas = document.createElement('canvas');
    canvas.width = w || decoded.width;
    canvas.height = h || decoded.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2D 컨텍스트를 쓸 수 없습니다');
    ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            b => (b ? resolve(b) : reject(new Error('이미지 인코딩 실패'))),
            'image/jpeg',
            quality,
        );
    });

    if (blob.size < MIN_PLAUSIBLE_BYTES) {
        throw new Error(`압축 결과가 비어 있습니다 (${blob.size}바이트, 메모리 부족일 수 있음)`);
    }
    return { blob, w: canvas.width, h: canvas.height };
}

/**
 * 업로드 전 리사이즈 + JPEG 압축.
 *
 * 디코딩은 한 번만 하고, 캔버스·인코딩만 설정을 낮춰 가며 다시 시도한다.
 * 예전에는 설정마다 파일을 처음부터 다시 디코딩해서, 디코딩이 문제일 때는
 * 두 번째 시도도 똑같이 실패하면서 시간만 두 배로 썼다.
 */
export async function compressImage(
    file: File,
    attempts: Array<{ maxEdge: number; quality: number }> = [{ maxEdge: 1600, quality: 0.82 }],
): Promise<{ blob: Blob; w: number; h: number }> {
    const decoded = await decodeImage(file);
    try {
        let lastError: unknown;
        for (const { maxEdge, quality } of attempts) {
            try {
                return await drawToJpeg(decoded, maxEdge, quality);
            } catch (e) {
                lastError = e;
                console.warn(`압축 실패 (${maxEdge}px) — 더 작게 재시도:`, e);
            }
        }
        throw lastError instanceof Error ? lastError : new Error('이미지를 압축하지 못했습니다');
    } finally {
        decoded.close();
    }
}
