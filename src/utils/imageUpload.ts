// Firebase Storage 업로드/삭제 (사진 메타데이터 반환)
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../services/firebase';
import { compressImage, withTimeout, runWithStallGuard, retryAsync } from './imageResize';
import type { EntryPhoto } from '../types/types';

/**
 * 전송이 이 시간 동안 한 바이트도 진척되지 않으면 멈춘 것으로 보고 중단한다.
 * 예전에는 파일 크기와 무관하게 60초 벽시계로 잘랐는데, 느리지만 정상 동작하는
 * 회선에서 큰 사진이 억울하게 실패했다. 진척 여부로 판단하는 편이 정확하다.
 */
const STALL_TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 3;
/** Storage 보안 규칙 상한 */
const MAX_BYTES = 5 * 1024 * 1024;

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
    try {
        const r = await compressImage(file);
        blob = r.blob;
        contentType = 'image/jpeg';
        w = r.w;
        h = r.h;
    } catch (e) {
        // 압축 실패 → 원본 그대로 업로드 (Storage 규칙상 5MB 미만·image/* 이어야 함)
        console.warn('compressImage 실패, 원본 업로드 폴백:', e);
    }

    // 압축이 실패한 원본은 수 MB일 수 있다. 규칙에 걸려 어차피 거부되므로
    // 오래 올리다 실패하는 대신 미리 알려준다.
    if (blob.size > MAX_BYTES) {
        throw new Error(
            `사진이 너무 큽니다 (${(blob.size / 1024 / 1024).toFixed(1)}MB). ` +
            `이 형식은 앱에서 줄일 수 없어요 — 다른 형식으로 저장한 뒤 올려주세요.`
        );
    }

    const path = `users/${uid}/photos/${crypto.randomUUID()}.jpg`;
    const objectRef = ref(storage, path);

    // 진척이 끊기면 실제로 취소한다. 예전에는 타임아웃 시 Promise만 reject하고
    // 업로드는 계속 돌게 둬서, 여러 장을 올릴 때 죽은 업로드가 대역폭을 계속 먹고
    // 뒤따르는 사진까지 연쇄로 시간 초과되는 원인이 됐다.
    await retryAsync(
        () => runWithStallGuard(
            uploadBytesResumable(objectRef, blob, { contentType }),
            STALL_TIMEOUT_MS,
            onProgress,
        ),
        MAX_ATTEMPTS,
        '업로드',
    );
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
