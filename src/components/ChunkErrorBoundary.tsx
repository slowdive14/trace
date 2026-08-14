import React from 'react';

interface Props {
    children: React.ReactNode;
}

interface State {
    failed: boolean;
}

/**
 * lazy 청크 로드 실패를 받아 안내를 띄운다.
 *
 * 에러 경계가 없으면 import() 거부가 아무에게도 잡히지 않아 Suspense가
 * 영원히 매달린다(= 화면이 먹통). 최소한 무슨 일이 났는지 보이고
 * 직접 새로고침할 수단은 있어야 한다.
 */
export class ChunkErrorBoundary extends React.Component<Props, State> {
    state: State = { failed: false };

    static getDerivedStateFromError(): State {
        return { failed: true };
    }

    componentDidCatch(error: unknown) {
        console.error('화면을 불러오지 못했습니다:', error);
    }

    render() {
        if (!this.state.failed) return this.props.children;

        return (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
                <p className="text-sm text-text-secondary">화면을 불러오지 못했습니다.</p>
                <p className="text-[11px] text-text-tertiary">
                    앱이 업데이트되었을 수 있습니다. 새로고침하면 최신 버전으로 열립니다.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-1 px-4 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
                >
                    새로고침
                </button>
            </div>
        );
    }
}

export default ChunkErrorBoundary;
