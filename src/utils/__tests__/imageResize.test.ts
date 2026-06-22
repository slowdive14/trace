import { describe, it, expect } from 'vitest';
import { computeTargetSize } from '../imageResize';

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
