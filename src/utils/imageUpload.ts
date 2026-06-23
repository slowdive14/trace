// Firebase Storage 업로드/삭제 (사진 메타데이터 반환)
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../services/firebase';
import { compressImage } from './imageResize';
import type { EntryPhoto } from '../types/types';

// 파일을 압축해 users/{uid}/photos 에 업로드하고 메타데이터 반환.
// 일부 HDR/특수 JPEG은 브라우저 캔버스 디코딩이 실패하므로, 그 경우 원본을 그대로 업로드해 사진 유실을 막는다.
export async function uploadEntryPhoto(uid: string, file: File): Promise<EntryPhoto> {
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
    const path = `users/${uid}/photos/${crypto.randomUUID()}.jpg`;
    const objectRef = ref(storage, path);
    await uploadBytes(objectRef, blob, { contentType });
    const url = await getDownloadURL(objectRef);
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
