import { lazy, type ComponentType } from 'react';

/**
 * 배포 후 청크가 사라져 화면이 멈추는 것을 막는 lazy 래퍼.
 *
 * 이 앱은 서비스워커를 autoUpdate + skipWaiting + clientsClaim +
 * cleanupOutdatedCaches 로 쓴다. 새 배포가 나가면 새 워커가 즉시 활성화되어
 * 열려 있던 페이지를 넘겨받고 '옛 캐시를 지운다'. 그런데 그 페이지는 아직
 * 옛 index.html·옛 번들로 돌고 있어서, 탭을 눌러 lazy 청크를 부르면
 * 옛 해시 파일을 찾는다. 캐시에서도 지워졌고 서버에도 새 빌드만 있으니 404다.
 * import()가 거부되는데 에러 경계가 없으면 Suspense가 영원히 매달려 먹통이 된다.
 *
 * 그래서 청크 로드가 실패하면 한 번 새로고침해 최신 index.html을 받는다.
 * (404가 아닌 진짜 오프라인 상황에서 무한 새로고침이 되지 않도록 세션당 1회로 제한)
 */
const RELOAD_FLAG = 'serein:chunk-reloaded';

export function lazyWithReload<T extends ComponentType<any>>(
    factory: () => Promise<{ default: T }>,
) {
    return lazy(async () => {
        try {
            const mod = await factory();
            // 성공했으면 다음 배포 때 다시 새로고침할 수 있도록 표시를 지운다
            sessionStorage.removeItem(RELOAD_FLAG);
            return mod;
        } catch (e) {
            const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG);
            if (!alreadyReloaded) {
                sessionStorage.setItem(RELOAD_FLAG, '1');
                window.location.reload();
                // 새로고침이 진행되는 동안 Suspense가 풀리지 않도록 영원히 대기
                return new Promise<never>(() => {});
            }
            // 이미 한 번 새로고침했는데도 실패 → 에러 경계가 받아 안내를 띄운다
            throw e;
        }
    });
}
