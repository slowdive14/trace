import { describe, it, expect, vi } from 'vitest';
import { runWithStallGuard, retryAsync, firstSuccess, sniffImageFormat, sniffImageFile, type ProgressTask } from './imageResize';

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

describe('firstSuccess — 디코딩 경로 경쟁', () => {
    const decoded = (name: string) => ({ name, close: vi.fn() });
    const later = <T,>(ms: number, value: T) =>
        new Promise<T>(resolve => setTimeout(() => resolve(value), ms));
    const failLater = (ms: number, message: string) =>
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms));

    it('먼저 끝난 쪽을 쓴다', async () => {
        const fast = decoded('fast');
        const slow = decoded('slow');
        const got = await firstSuccess([later(50, slow), later(5, fast)], '실패');
        expect(got).toBe(fast);
    });

    it('한쪽이 멈춰 있어도 다른 쪽이 끝나면 곧바로 진행한다', async () => {
        const ok = decoded('ok');
        const stuck = new Promise<typeof ok>(() => { });   // 영영 안 끝나는 경로
        const started = Date.now();
        const got = await firstSuccess([stuck, later(5, ok)], '실패');

        expect(got).toBe(ok);
        expect(Date.now() - started).toBeLessThan(500);
    });

    it('늦게 도착한 쪽은 거둬서 메모리를 놓아준다', async () => {
        const fast = decoded('fast');
        const slow = decoded('slow');
        await firstSuccess([later(30, slow), later(5, fast)], '실패');

        await new Promise(r => setTimeout(r, 60));
        expect(slow.close).toHaveBeenCalledTimes(1);
        expect(fast.close).not.toHaveBeenCalled();   // 쓰이는 쪽은 호출자가 거둔다
    });

    it('한쪽이 실패해도 다른 쪽이 성공하면 넘어간다', async () => {
        const ok = decoded('ok');
        const got = await firstSuccess([failLater(5, '디코딩 불가'), later(20, ok)], '실패');
        expect(got).toBe(ok);
    });

    it('모두 실패하면 이유를 모아 알린다 (한 원인으로 단정하지 않는다)', async () => {
        await expect(
            firstSuccess<{ close: () => void }>(
                [failLater(5, 'bitmap 실패'), failLater(10, 'img 실패')],
                '이미지를 디코딩하지 못했습니다',
            )
        ).rejects.toThrow(/이미지를 디코딩하지 못했습니다.*bitmap 실패.*img 실패/);
    });
});

describe('sniffImageFormat — 확장자 말고 파일로 형식 판별', () => {
    const bytes = (...parts: Array<number | string>) => {
        const out: number[] = [];
        for (const p of parts) {
            if (typeof p === 'number') out.push(p);
            else for (const ch of p) out.push(ch.charCodeAt(0));
        }
        return new Uint8Array(out);
    };

    it('JPEG', () => {
        const f = sniffImageFormat(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 'JFIF'));
        expect(f).toMatchObject({ label: 'JPEG', drawable: true, ext: 'jpg' });
    });

    it('PNG', () => {
        const f = sniffImageFormat(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a));
        expect(f).toMatchObject({ label: 'PNG', drawable: true, ext: 'png' });
    });

    it('WebP', () => {
        const f = sniffImageFormat(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '));
        expect(f).toMatchObject({ label: 'WebP', drawable: true, ext: 'webp' });
    });

    it('HEIC는 그릴 수 없는 형식으로 잡는다 (이름이 .jpg여도)', () => {
        // 아이폰 HEIC의 실제 머리: 크기 4바이트 + 'ftypheic'
        const f = sniffImageFormat(bytes(0, 0, 0, 0x18, 'ftypheic', 0, 0, 0, 0));
        expect(f).toMatchObject({ label: 'HEIC', drawable: false, ext: 'heic' });
    });

    it('HEIC의 다른 브랜드(mif1)도 같이 잡는다', () => {
        const f = sniffImageFormat(bytes(0, 0, 0, 0x18, 'ftypmif1', 0, 0, 0, 0));
        expect(f.label).toBe('HEIC');
    });

    it('AVIF는 그릴 수 있는 쪽으로 구분한다', () => {
        const f = sniffImageFormat(bytes(0, 0, 0, 0x1c, 'ftypavif', 0, 0, 0, 0));
        expect(f).toMatchObject({ label: 'AVIF', drawable: true, ext: 'avif' });
    });

    it('알 수 없는 내용은 unknown', () => {
        expect(sniffImageFormat(bytes(1, 2, 3, 4, 5, 6, 7, 8)).label).toBe('unknown');
    });

    it('내용이 너무 짧아도 터지지 않는다', () => {
        expect(() => sniffImageFormat(bytes(0xff))).not.toThrow();
    });
});

describe('sniffImageFile — 못 읽는 것과 낯선 형식을 구분한다', () => {
    const jpegHead = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);

    it('정상 파일은 형식을 알려준다', async () => {
        const got = await sniffImageFile(new Blob([jpegHead], { type: 'image/jpeg' }));
        expect(got.label).toBe('JPEG');
        expect(got.unreadable).toBeUndefined();
    });

    it('빈 파일은 읽기 문제로 분류한다', async () => {
        expect(await sniffImageFile(new Blob([]))).toMatchObject({
            label: '빈 파일',
            unreadable: true,
        });
    });

    it('내용을 못 읽으면 형식 문제로 오해하지 않는다', async () => {
        // 폰이 파일 접근 권한을 거둬 간 상황: 크기는 남아 있는데 읽기가 실패한다
        const revoked = {
            size: 5_600_000,
            slice: () => ({
                arrayBuffer: () => Promise.reject(new DOMException('The requested file could not be read', 'NotReadableError')),
            }),
        } as unknown as Blob;

        const got = await sniffImageFile(revoked);
        expect(got.unreadable).toBe(true);
        expect(got.label).toContain('내용을 읽지 못함');
        expect(got.label).toContain('could not be read');
    });

    it('낯선 형식이면 앞부분 바이트를 근거로 남긴다', async () => {
        const weird = new Blob([new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xaa, 0xbb, 0xcc, 0xdd])]);
        const got = await sniffImageFile(weird);

        expect(got.unreadable).toBeUndefined();   // 읽기는 됐다
        expect(got.label).toContain('알 수 없는 형식');
        expect(got.label).toContain('00 01 02 03 aa bb cc dd');
    });
});
