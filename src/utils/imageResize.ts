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

// JPEG 바이트에서 SOF 마커를 읽어 픽셀 치수를 싸게 구한다(전체 디코딩 없이).
// 메모리 절약형 축소 디코딩(createImageBitmap resize)을 위한 목표 크기 계산에 사용.
export function readJpegDimensions(buf: ArrayBuffer): { w: number; h: number } | null {
    const d = new DataView(buf);
    if (d.byteLength < 4 || d.getUint16(0) !== 0xffd8) return null; // SOI
    let off = 2;
    while (off + 4 <= d.byteLength) {
        if (d.getUint8(off) !== 0xff) { off++; continue; }
        let marker = d.getUint8(off + 1);
        // 0xFF 패딩 스킵
        while (marker === 0xff && off + 2 < d.byteLength) { off++; marker = d.getUint8(off + 1); }
        off += 2;
        // 길이 없는 standalone 마커: TEM(0x01), RSTn(D0–D7), SOI(D8), EOI(D9)
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) continue;
        if (off + 2 > d.byteLength) break;
        const len = d.getUint16(off);
        // SOF 마커: C0–CF 중 C4(DHT)·C8(JPG)·CC(DAC) 제외
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            if (off + 7 <= d.byteLength) {
                const h = d.getUint16(off + 3);
                const w = d.getUint16(off + 5);
                if (w > 0 && h > 0) return { w, h };
            }
            return null;
        }
        off += len; // 이 세그먼트 스킵
    }
    return null;
}

// 파일 → 디코딩된 이미지 (메모리 절약형 축소 디코딩 우선, 실패 시 전체 디코딩, 그래도 안 되면 <img> 폴백)
async function decodeImage(file: File, maxEdge: number): Promise<ImageBitmap | HTMLImageElement> {
    if (typeof createImageBitmap === 'function') {
        // 대용량/HDR JPEG은 전체 해상도 디코딩이 실패할 수 있어, 헤더 치수로 축소 디코딩 시도
        try {
            const dims = readJpegDimensions(await file.arrayBuffer());
            if (dims) {
                const t = computeTargetSize(dims.w, dims.h, maxEdge);
                return await createImageBitmap(file, { resizeWidth: t.w, resizeHeight: t.h, resizeQuality: 'high' });
            }
        } catch {
            // 폴백으로 진행
        }
        try {
            return await createImageBitmap(file);
        } catch {
            // HEIC 등 일부 포맷은 createImageBitmap이 실패할 수 있어 <img>로 폴백
        }
    }
    return await new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 디코딩할 수 없습니다 (지원되지 않는 형식일 수 있어요)')); };
        img.src = url;
    });
}

// 업로드 전 리사이즈 + JPEG 압축
export async function compressImage(
    file: File,
    maxEdge = 1600,
    quality = 0.82,
): Promise<{ blob: Blob; w: number; h: number }> {
    const source = await decodeImage(file, maxEdge);
    const sw = (source as HTMLImageElement).naturalWidth || source.width;
    const sh = (source as HTMLImageElement).naturalHeight || source.height;
    // source가 축소 디코딩된 ImageBitmap이면 이미 작아 computeTargetSize가 그대로 반환
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
