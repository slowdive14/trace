import { describe, it, expect, vi } from 'vitest';
import { runWithStallGuard, retryAsync, type ProgressTask } from './imageResize';

/** 제어 가능한 가짜 업로드 작업 */
function fakeTask() {
    let next: (s: { bytesTransferred: number; totalBytes: number }) => void = () => {};
    let error: (e: unknown) => void = () => {};
    let complete: () => void = () => {};
    const state = { cancelled: false };
    const task: ProgressTask = {
        on(_e, n, er, c) { next = n; error = er; complete = c; },
        cancel() { state.cancelled = true; },
    };
    return {
        task, state,
        running: () => next({ bytesTransferred: 0, totalBytes: 200_000 }),   // 아직 0바이트
        progress: (sent: number, total = 200_000) => next({ bytesTransferred: sent, totalBytes: total }),
        fail: (e: unknown) => error(e),
        done: () => complete(),
    };
}

describe('runWithStallGuard', () => {
    it('완료되면 resolve하고 취소하지 않는다', async () => {
        const f = fakeTask();
        const seen: number[] = [];
        const p = runWithStallGuard(f.task, 1000, 500, x => seen.push(x));
        f.progress(100_000); f.progress(200_000); f.done();
        await expect(p).resolves.toBeUndefined();
        expect(seen).toEqual([0.5, 1]);
        expect(f.state.cancelled).toBe(false);
    });

    it('작은 파일: 진척 보고가 완료 시 한 번뿐이어도 살아남는다 (회귀 방지)', async () => {
        // 압축된 사진은 대개 256KB 미만 → 청크 1개 → 진척은 0%와 완료뿐.
        // 예전에는 단일 20초 무진척 타이머가 이 구간을 잘라
        // "업로드가 멈춰 중단했습니다"로 실패했다.
        vi.useFakeTimers();
        try {
            const f = fakeTask();
            let settled: string | null = null;
            const p = runWithStallGuard(f.task, 60_000, 30_000)
                .then(() => { settled = 'ok'; })
                .catch(e => { settled = (e as Error).message; });

            f.running();                       // 0바이트 통지만 오고
            await vi.advanceTimersByTimeAsync(29_000);   // 29초 침묵 (예전 20초 제한을 넘김)
            expect(settled).toBeNull();        // 아직 살아 있어야 한다

            f.progress(200_000); f.done();     // 완료 시점에 한 번에 보고
            await p;
            expect(settled).toBe('ok');
            expect(f.state.cancelled).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it('시작조차 못하면 시작 대기 시간이 지난 뒤 취소한다', async () => {
        vi.useFakeTimers();
        try {
            const f = fakeTask();
            const p = runWithStallGuard(f.task, 1000, 500).catch(e => (e as Error).message);
            await vi.advanceTimersByTimeAsync(1100);
            expect(await p).toContain('시작하지 못했습니다');
            expect(f.state.cancelled).toBe(true);   // 대역폭을 실제로 놓아준다
        } finally {
            vi.useRealTimers();
        }
    });

    it('전송이 시작된 뒤에는 짧은 정체 감지로 전환한다', async () => {
        vi.useFakeTimers();
        try {
            const f = fakeTask();
            const p = runWithStallGuard(f.task, 60_000, 500).catch(e => (e as Error).message);
            f.progress(50_000);                       // 바이트가 움직였다
            await vi.advanceTimersByTimeAsync(600);   // 이후 정체
            expect(await p).toContain('도중에 멈췄습니다');
            expect(f.state.cancelled).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('진행 중이면 총 시간이 길어도 죽이지 않는다', async () => {
        vi.useFakeTimers();
        try {
            const f = fakeTask();
            let done = false;
            const p = runWithStallGuard(f.task, 1000, 1000).then(() => { done = true; });
            for (let i = 1; i <= 6; i++) {
                await vi.advanceTimersByTimeAsync(800);
                f.progress(i * 30_000);
            }
            expect(done).toBe(false);
            expect(f.state.cancelled).toBe(false);   // 4.8초가 지나도 살아 있다
            f.done();
            await p;
            expect(done).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('완료 후 늦게 온 이벤트에 반응하지 않는다', async () => {
        const f = fakeTask();
        const p = runWithStallGuard(f.task, 1000, 500);
        f.done();
        await p;
        f.fail(new Error('늦은 오류'));
        expect(f.state.cancelled).toBe(false);
    });
});

describe('retryAsync', () => {
    it('일시적 실패는 재시도해 성공한다', async () => {
        let calls = 0;
        const r = await retryAsync(async () => {
            calls++;
            if (calls < 3) throw new Error('일시적');
            return 'ok';
        }, 3, '업로드', async () => {});
        expect([r, calls]).toEqual(['ok', 3]);
    });

    it('권한 오류는 재시도하지 않는다', async () => {
        let calls = 0;
        await retryAsync(async () => {
            calls++;
            throw Object.assign(new Error('권한 없음'), { code: 'storage/unauthorized' });
        }, 3, '업로드', async () => {}).catch(() => {});
        expect(calls).toBe(1);
    });
});
