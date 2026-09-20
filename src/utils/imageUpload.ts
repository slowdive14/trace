// Firebase Storage 업로드/삭제 (사진 메타데이터 반환)
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../services/firebase';
import { compressImage, withTimeout, runWithStallGuard, retryAsync, sniffImageFile, type SniffedFormat } from './imageResize';
import type { EntryPhoto } from '../types/types';

/**
 * 첫 바이트가 움직이기까지 허용할 시간.
 * 토큰 발급·업로드 세션 생성이 여기 포함되고, 압축된 사진은 대개 256KB 미만이라
 * 청크가 하나뿐이어서 '완료될 때 한 번' 진척이 보고된다. 즉 이 값이 작은 사진의
 * 사실상 총 제한이 되므로 넉넉히 잡는다.
 */
const FIRST_PROGRESS_TIMEOUT_MS = 60000;
/** 전송이 시작된 뒤 정체로 볼 시간 */
const STALL_TIMEOUT_MS = 30000;
const MAX_ATTEMPTS = 3;
/**
 * 업로드는 한 번 실패에 최대 60초가 걸리므로 시도 횟수를 줄여 둔다.
 * (3회면 사진 한 장에 3분까지 매달릴 수 있다. 성공분은 기억해 두므로
 *  사용자가 다시 눌러도 못 올린 것만 이어서 올라간다.)
 */
const UPLOAD_ATTEMPTS = 2;
/**
 * 이보다 작으면 단순 업로드(단일 요청)를 쓴다.
 * 재개 가능 업로드는 첫 바이트가 움직이기까지 CORS 프리플라이트 → 세션 생성 →
 * 청크 전송으로 왕복이 여러 번이라, 불안정한 모바일 회선에서 시작조차 못하는
 * 일이 생긴다. 압축된 사진은 대개 이 크기 아래이므로 왕복이 한 번인 쪽이 낫다.
 * 진행률·중단이 실제로 의미 있는 큰 파일만 재개 가능 업로드로 보낸다.
 */
const SIMPLE_UPLOAD_MAX_BYTES = 1024 * 1024;
/**
 * Storage 보안 규칙 상한.
 * 압축이 실패하면 원본을 그대로 올려야 사진이 유실되지 않는데, 폰 사진 원본은
 * 5~8MB가 흔해 예전 5MB 상한에서는 그 폴백이 번번이 막혔다.
 * (콘솔의 Storage 규칙도 같은 값으로 맞춰 두어야 한다)
 */
const MAX_BYTES = 10 * 1024 * 1024;

// 파일을 압축해 users/{uid}/photos 에 업로드하고 메타데이터 반환.
// 일부 HDR/특수 JPEG은 브라우저 캔버스 디코딩이 실패하므로, 그 경우 원본을 그대로 업로드해 사진 유실을 막는다.
export async function uploadEntryPhoto(
    uid: string,
    file: File,
    onProgress?: (fraction: number) => void,
): Promise<EntryPhoto> {
    let blob: Blob = file;
    let contentType = file.type || 'image/jpeg';
    let w: number | undefined;
    let h: number | undefined;

    // 해상도·품질을 낮춰 가며 시도한다. 큰 사진을 여러 장 연달아 처리하면
    // 메모리 압박으로 캔버스 작업이 실패할 수 있는데, 작게 잡으면 성공하는 경우가 많다.
    // 디코딩은 안에서 한 번만 하므로 단계를 늘려도 시간이 그만큼 늘지는 않는다.
    let compressError: unknown;
    try {
        const r = await compressImage(file, [
            { maxEdge: 1600, quality: 0.82 },
            { maxEdge: 1024, quality: 0.72 },
            { maxEdge: 720, quality: 0.6 },
        ]);
        blob = r.blob;
        contentType = 'image/jpeg';
        w = r.w;
        h = r.h;
    } catch (e) {
        compressError = e;
        console.warn('compressImage 실패 — 원본 업로드로 폴백:', e);
    }

    // 압축이 실패했다면 원본이 무엇인지 파일로 확인한다.
    // 확장자와 file.type은 믿을 수 없다 — 아이폰이 HEIC로 찍은 사진이 전송 과정에서
    // 이름만 .jpg로 바뀌는 일이 흔하고, 그러면 크롬 계열은 아예 디코딩하지 못한다.
    let sniffed: SniffedFormat | undefined;
    if (compressError) {
        sniffed = await sniffImageFile(file);
        console.warn(`압축 실패 — 실제 형식: ${sniffed.label} (이름 ${file.name}, type ${file.type || '없음'})`);

        // 브라우저가 그리지 못하는 형식은 올려 봐야 화면에서 열리지 않는다.
        // 원인을 정확히 짚고 멈추는 편이 낫다.
        if (!sniffed.drawable) {
            throw new Error(
                sniffed.label === 'HEIC'
                    ? '이 사진은 이름만 .jpg일 뿐 실제로는 HEIC 형식이라 앱에서 열 수 없습니다. ' +
                      "아이폰이라면 설정 → 카메라 → 포맷에서 '호환성 우선'으로 바꿔 주세요. " +
                      "이미 찍어 둔 사진은 공유할 때 '자동' 대신 JPEG으로 변환해 올리면 됩니다."
                    : `사진을 열지 못했습니다 (실제 형식: ${sniffed.label}). 파일이 손상됐을 수 있습니다.`
            );
        }
        if (sniffed.mime) contentType = sniffed.mime;
    }

    // 여기까지 왔는데 원본이 상한을 넘으면 규칙에 걸려 어차피 거부된다.
    // 오래 올리다 실패하는 대신 미리 알려준다.
    if (blob.size > MAX_BYTES) {
        const why = compressError instanceof Error ? compressError.message : '알 수 없는 이유';
        throw new Error(
            `사진(${(blob.size / 1024 / 1024).toFixed(1)}MB)을 앱에서 줄이지 못했습니다: ${why}. ` +
            `다시 시도해 보시고, 계속 실패하면 사진을 편집 앱에서 한 번 줄여서 올려주세요.`
        );
    }

    // 원본을 그대로 올릴 때는 실제 형식에 맞는 확장자를 쓴다.
    // 예전에는 무조건 .jpg여서 PNG 원본이 .jpg라는 이름으로 올라갔다.
    const path = `users/${uid}/photos/${crypto.randomUUID()}.${sniffed?.ext ?? 'jpg'}`;
    const objectRef = ref(storage, path);

    if (blob.size <= SIMPLE_UPLOAD_MAX_BYTES) {
        // 단일 요청. 진행률은 시작·완료 두 지점으로만 알린다.
        onProgress?.(0);
        await retryAsync(
            () => withTimeout(uploadBytes(objectRef, blob, { contentType }), FIRST_PROGRESS_TIMEOUT_MS, '업로드'),
            UPLOAD_ATTEMPTS,
            '업로드',
        );
        onProgress?.(1);
    } else {
        // 큰 파일은 진행률·중단이 의미 있으므로 재개 가능 업로드.
        // 진척이 끊기면 실제로 취소한다. 예전에는 타임아웃 시 Promise만 reject하고
        // 업로드는 계속 돌게 둬서, 여러 장을 올릴 때 죽은 업로드가 대역폭을 계속 먹고
        // 뒤따르는 사진까지 연쇄로 시간 초과되는 원인이 됐다.
        await retryAsync(
            () => runWithStallGuard(
                uploadBytesResumable(objectRef, blob, { contentType }),
                FIRST_PROGRESS_TIMEOUT_MS,
                STALL_TIMEOUT_MS,
                onProgress,
            ),
            UPLOAD_ATTEMPTS,
            '업로드',
        );
    }
    const url = await retryAsync(
        () => withTimeout(getDownloadURL(objectRef), 20000, 'URL 가져오기'),
        MAX_ATTEMPTS,
        'URL 가져오기',
    );

    // w·h가 없으면 필드를 생략(Firestore는 undefined 값을 거부)
    return { url, path, ...(w ? { w } : {}), ...(h ? { h } : {}) };
}

// 스토리지 사진 삭제 (best-effort — 실패해도 흐름을 막지 않음)
export async function deletePhoto(path: string): Promise<void> {
    try {
        await deleteObject(ref(storage, path));
    } catch (e) {
        console.warn('deletePhoto 실패(무시):', path, e);
    }
}
