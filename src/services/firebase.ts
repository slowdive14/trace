import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentSingleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Validate required environment variables
const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
] as const;

const missingVars = requiredEnvVars.filter(key => !import.meta.env[key]);
if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please create a .env file with the required Firebase configuration.');
}

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore: IndexedDB 영속 캐시 사용.
// 기본(메모리 캐시)은 앱을 켤 때마다 모든 문서를 네트워크에서 다시 받아
// 첫 화면이 뜨기까지 오래 걸린다. 영속 캐시를 쓰면 재방문 시 로컬에서
// 즉시 렌더하고 변경분만 백그라운드로 동기화한다.
//
// 탭 매니저는 단일 탭 + forceOwnership을 쓴다.
// 멀티탭 매니저는 IndexedDB 리더 선출(lease)에 기대는데, 모바일 PWA는 OS가
// 앱을 그냥 죽이는 일이 잦아 이전 세션의 lease가 남는다. 그러면 새로 켠
// 인스턴스가 선출을 기다리며 네트워크를 잡지 못해, 새로고침하기 전까지
// 데이터가 뜨지 않는 증상이 생긴다. 사실상 단일 인스턴스로 쓰는 앱이므로
// 선출을 건너뛰고 바로 소유권을 갖게 한다.
//
// 시크릿 모드 등 IndexedDB를 못 쓰는 환경에서는 메모리 캐시로 폴백.
const initDb = () => {
    try {
        return initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentSingleTabManager({ forceOwnership: true }),
            }),
        });
    } catch (e) {
        console.warn('Firestore 영속 캐시를 사용할 수 없어 메모리 캐시로 대체합니다.', e);
        return getFirestore(app);
    }
};

export const db = initDb();
export const storage = getStorage(app);
