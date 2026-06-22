import { defineConfig } from 'vitest/config';

// 순수 유틸 단위테스트용 (node 환경, DOM/Firebase 불필요)
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
});
