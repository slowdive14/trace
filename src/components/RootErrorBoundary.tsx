import React from 'react';

interface Props {
    children: React.ReactNode;
}

interface State {
    error: Error | null;
}

/**
 * 앱 최상위 오류 경계.
 *
 * React는 렌더 중 오류가 잡히지 않으면 트리 전체를 언마운트한다. 경계가 없으면
 * 그 결과가 백지화면이라 사용자는 무슨 일이 났는지도, 무엇을 해야 할지도 알 수 없다.
 * 여기서 받아 원인과 복구 수단을 보여준다.
 */
export class RootErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: unknown, info: unknown) {
        console.error('앱 최상위 오류:', error, info);
    }

    private hardReload = async () => {
        // 캐시가 원인일 수 있으므로 비우고 다시 받는다
        try {
            if (window.caches) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }
        } catch {
            // 캐시를 못 비워도 새로고침은 시도한다
        }
        window.location.reload();
    };

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-sm text-text-secondary">화면을 여는 중 문제가 생겼습니다.</p>
                <p className="text-[11px] text-text-tertiary max-w-xs break-words">
                    {this.state.error.message}
                </p>
                <div className="flex gap-2 mt-1">
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
                    >
                        새로고침
                    </button>
                    <button
                        onClick={this.hardReload}
                        className="px-4 py-2 rounded-lg bg-bg-secondary text-text-secondary text-xs font-medium hover:text-text-primary transition-colors"
                    >
                        캐시 비우고 새로고침
                    </button>
                </div>
            </div>
        );
    }
}

export default RootErrorBoundary;
