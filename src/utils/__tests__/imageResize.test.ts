import { describe, it, expect } from 'vitest';
import { computeTargetSize, readJpegDimensions } from '../imageResize';

describe('computeTargetSize', () => {
    it('가로가 더 길면 긴 변을 maxEdge로 맞춘다', () => {
        expect(computeTargetSize(4000, 2000, 1600)).toEqual({ w: 1600, h: 800 });
    });
    it('세로가 더 길면 긴 변을 maxEdge로 맞춘다', () => {
        expect(computeTargetSize(2000, 4000, 1600)).toEqual({ w: 800, h: 1600 });
    });
    it('정사각은 maxEdge × maxEdge', () => {
        expect(computeTargetSize(3000, 3000, 1600)).toEqual({ w: 1600, h: 1600 });
    });
    it('maxEdge보다 작으면 확대하지 않는다', () => {
        expect(computeTargetSize(1000, 800, 1600)).toEqual({ w: 1000, h: 800 });
    });
    it('경계: 긴 변이 정확히 maxEdge면 그대로', () => {
        expect(computeTargetSize(1600, 900, 1600)).toEqual({ w: 1600, h: 900 });
    });
    it('0·음수·NaN은 0,0으로 방어', () => {
        expect(computeTargetSize(0, 100, 1600)).toEqual({ w: 0, h: 0 });
        expect(computeTargetSize(-5, 100, 1600)).toEqual({ w: 0, h: 0 });
        expect(computeTargetSize(NaN, 100, 1600)).toEqual({ w: 0, h: 0 });
    });
});

describe('readJpegDimensions', () => {
    it('SOF0에서 width/height를 읽는다', () => {
        // FFD8(SOI) FFC0(SOF0) 0011(len) 08(precision) 0100(h=256) 0200(w=512) …
        const bytes = new Uint8Array([
            0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x00, 0x02, 0x00,
            0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        ]);
        expect(readJpegDimensions(bytes.buffer)).toEqual({ w: 512, h: 256 });
    });

    it('앞선 세그먼트(APP0)를 건너뛰고 SOF2(progressive)를 찾는다', () => {
        const bytes = new Uint8Array([
            0xff, 0xd8,
            0xff, 0xe0, 0x00, 0x04, 0xaa, 0xbb,             // APP0 (len 4 → 데이터 2바이트)
            0xff, 0xc2, 0x00, 0x11, 0x08, 0x00, 0xc8, 0x01, 0x2c, // SOF2 h=200 w=300
        ]);
        expect(readJpegDimensions(bytes.buffer)).toEqual({ w: 300, h: 200 });
    });

    it('JPEG(SOI)가 아니면 null', () => {
        expect(readJpegDimensions(new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer)).toBeNull();
    });
});
