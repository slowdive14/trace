// Firebase Storage 업로드/삭제 (사진 메타데이터 반환)
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../services/firebase';
import { compressImage } from './imageResize';
import type { EntryPhoto } from '../types/types';

// 파일을 압축해 users/{uid}/photos 에 업로드하고 메타데이터 반환
export async function uploadEntryPhoto(uid: string, file: File): Promise<EntryPhoto> {
    const { blob, w, h } = await compressImage(file);
    const path = `users/${uid}/photos/${crypto.randomUUID()}.jpg`;
    const objectRef = ref(storage, path);
    await uploadBytes(objectRef, blob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(objectRef);
    return { url, path, w, h };
}

// 스토리지 사진 삭제 (best-effort — 실패해도 흐름을 막지 않음)
export async function deletePhoto(path: string): Promise<void> {
    try {
        await deleteObject(ref(storage, path));
    } catch (e) {
        console.warn('deletePhoto 실패(무시):', path, e);
    }
}
