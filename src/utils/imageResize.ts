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

// 파일 → 디코딩된 이미지 (ImageBitmap 우선, 실패/지연 시 <img> 폴백). 각 단계에 타임아웃.
async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
    if (typeof createImageBitmap === 'function') {
        try {
            // 주의: resize 옵션은 일부 모바일 브라우저에서 특정 HDR JPEG에 대해 hang하므로 쓰지 않는다.
            return await withTimeout(createImageBitmap(file), 12000, '이미지 디코딩');
        } catch {
            // HEIC/HDR 등 일부 포맷·환경에서 실패하거나 지연 → <img>로 폴백
        }
    }
    return await new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        const cleanup = () => URL.revokeObjectURL(url);
        const timer = setTimeout(() => { cleanup(); reject(new Error('이미지 디코딩 시간 초과')); }, 12000);
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
