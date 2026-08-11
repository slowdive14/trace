/**
 * 미아 사진 정리
 *
 * Storage에는 있는데 어떤 기록에서도 참조하지 않는 사진을 찾아 지운다.
 * 업로드는 성공했지만 엔트리 저장 단계에서 실패하면 이런 파일이 남는다.
 *
 * 되돌릴 수 없는 작업이라 기본은 '보기만' 하고, --delete 를 줘야 실제로 지운다.
 *
 * 사용법:
 *   npm run cleanup:photos                    # 미아 목록만 출력 (기본)
 *   npm run cleanup:photos -- --delete        # 실제 삭제
 *   npm run cleanup:photos -- --min-age 180   # 3시간 이상 된 것만 대상 (기본 60분)
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import { collectPathsFromDoc, findOrphans, formatBytes, type StorageEntry } from './orphanPhotos';

const HERE = dirname(fileURLToPath(import.meta.url));

interface Config {
    serviceAccountPath: string;
    userEmail: string;
    /** 기본값은 SDK 설정에서 가져오므로 보통 생략 */
    storageBucket?: string;
}

function loadConfig(): Config {
    // 옵시디언 동기화 스크립트와 같은 설정 파일을 쓴다 (서비스 계정·이메일이 동일)
    const path = join(HERE, 'obsidian-sync.config.json');
    if (!existsSync(path)) {
        console.error(`설정 파일이 없습니다: ${path}`);
        console.error('scripts/obsidian-sync.config.example.json 을 복사해 채워주세요.');
        process.exit(1);
    }
    return JSON.parse(readFileSync(path, 'utf8')) as Config;
}

async function main() {
    const argv = process.argv.slice(2);
    const arg = (name: string) => {
        const i = argv.indexOf(`--${name}`);
        return i !== -1 ? argv[i + 1] : undefined;
    };
    const doDelete = argv.includes('--delete');
    const force = argv.includes('--force');
    const minAgeMs = Number(arg('min-age') ?? 60) * 60 * 1000;

    const cfg = loadConfig();
    const keyPath = resolve(HERE, cfg.serviceAccountPath);
    if (!existsSync(keyPath)) {
        console.error(`서비스 계정 키를 찾을 수 없습니다: ${keyPath}`);
        process.exit(1);
    }
    const key = JSON.parse(readFileSync(keyPath, 'utf8'));
    const bucketName = cfg.storageBucket ?? `${key.project_id}.firebasestorage.app`;
    initializeApp({ credential: cert(key), storageBucket: bucketName });

    const uid = (await getAuth().getUserByEmail(cfg.userEmail)).uid;
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);

    // ---- 1) 기록이 참조하는 사진 경로를 모은다 ----
    // 컬렉션을 하드코딩하지 않고 사용자 하위 전부를 훑는다.
    // 하나라도 빠뜨리면 멀쩡한 사진을 미아로 오인해 지우게 되므로 보수적으로 간다.
    const collections = await userRef.listCollections();
    const referenced = new Set<string>();
    let scannedDocs = 0;

    for (const col of collections) {
        const snap = await col.get();
        scannedDocs += snap.size;
        for (const doc of snap.docs) {
            for (const p of collectPathsFromDoc(doc.data())) referenced.add(p);
        }
    }
    console.log(`기록 ${scannedDocs}건(컬렉션 ${collections.length}개) 확인 → 참조된 사진 ${referenced.size}장`);

    // ---- 2) Storage의 실제 파일 목록 ----
    const bucket = getStorage().bucket();
    const [objects] = await bucket.getFiles({ prefix: `users/${uid}/photos/` });
    const files: StorageEntry[] = objects.map(o => ({
        path: o.name,
        size: Number(o.metadata.size ?? 0),
        createdAt: new Date(o.metadata.timeCreated ?? Date.now()),
    }));
    console.log(`Storage 파일 ${files.length}장 (${formatBytes(files.reduce((s, f) => s + f.size, 0))})`);

    // ---- 3) 대조 ----
    const { orphans, tooRecent } = findOrphans(files, referenced, new Date(), minAgeMs);

    // 안전장치: 참조가 하나도 안 잡혔는데 파일은 많다면 조회가 잘못됐을 가능성이 크다.
    // 이 상태로 지우면 전부 날아간다.
    if (referenced.size === 0 && files.length > 0 && !force) {
        console.error('\n중단: 참조된 사진이 하나도 없습니다. 조회가 실패했을 가능성이 큽니다.');
        console.error('정말 전부 미아가 맞다면 --force 를 붙여 다시 실행하세요.');
        process.exit(1);
    }

    const orphanBytes = orphans.reduce((s, f) => s + f.size, 0);
    console.log(`\n미아 ${orphans.length}장 (${formatBytes(orphanBytes)})`);
    if (tooRecent.length) {
        console.log(`보류 ${tooRecent.length}장 — 올린 지 ${minAgeMs / 60000}분이 안 됐습니다 (업로드 중일 수 있어 건너뜁니다)`);
    }
    if (orphans.length === 0) {
        console.log('정리할 파일이 없습니다.');
        return;
    }

    for (const f of orphans.slice(0, 20)) {
        console.log(`  - ${f.path}  ${formatBytes(f.size)}  ${f.createdAt.toISOString().slice(0, 16).replace('T', ' ')}`);
    }
    if (orphans.length > 20) console.log(`  … 외 ${orphans.length - 20}장`);

    if (!doDelete) {
        console.log('\n(보기 전용) 실제로 지우려면 --delete 를 붙여 실행하세요.');
        return;
    }

    let deleted = 0;
    for (const f of orphans) {
        try {
            await bucket.file(f.path).delete();
            deleted++;
        } catch (e) {
            console.error(`삭제 실패: ${f.path}`, (e as Error).message);
        }
    }
    console.log(`\n${deleted}장 삭제 완료 (${formatBytes(orphanBytes)} 확보)`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
