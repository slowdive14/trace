import { defineConfig } from 'vitest/config';

// 순수 유틸 단위테스트용 (node 환경, DOM/Firebase 불필요)
// .test.tsx는 Firebase를 건드리지 않는 표시 전용 컴포넌트를 문자열로 렌더해 확인한다
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    },
});
