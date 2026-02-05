// Centralized error handling utilities

export interface AppError {
    code: string;
    message: string;
    userMessage: string;
}

// Error codes and user-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
    'auth/user-not-found': '사용자를 찾을 수 없습니다.',
    'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
    'auth/popup-closed-by-user': '로그인 창이 닫혔습니다. 다시 시도해주세요.',
    'permission-denied': '권한이 없습니다. 다시 로그인해주세요.',
    'unavailable': '서비스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
    'network-error': '네트워크 연결을 확인해주세요.',
    'default': '오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
};

/**
 * Convert any error to a user-friendly message
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        // Check for Firebase error codes
        const firebaseError = error as { code?: string };
        if (firebaseError.code && ERROR_MESSAGES[firebaseError.code]) {
            return ERROR_MESSAGES[firebaseError.code];
        }

        // Check for network errors
        if (error.message.includes('network') || error.message.includes('Network')) {
            return ERROR_MESSAGES['network-error'];
        }

        // Check for permission errors
        if (error.message.includes('permission') || error.message.includes('Permission')) {
            return ERROR_MESSAGES['permission-denied'];
        }
    }

    return ERROR_MESSAGES['default'];
}

/**
 * Log error with context for debugging
 */
export function logError(context: string, error: unknown): void {
    console.error(`[${context}]`, error);

    // In production, you could send this to an error tracking service
    if (import.meta.env.PROD) {
        // Example: sendToErrorTracking(context, error);
    }
}

/**
 * Handle async operation with error handling
 */
export async function handleAsyncOperation<T>(
    operation: () => Promise<T>,
    context: string,
    onError?: (message: string) => void
): Promise<T | null> {
    try {
        return await operation();
    } catch (error) {
        logError(context, error);
        const message = getErrorMessage(error);
        onError?.(message);
        return null;
    }
}

/**
 * Create a wrapper for component error handlers
 */
export function createErrorHandler(context: string) {
    return (error: unknown, showToast?: (message: string) => void) => {
        logError(context, error);
        const message = getErrorMessage(error);
        showToast?.(message);
        return message;
    };
}
