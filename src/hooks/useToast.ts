import { useState, useCallback } from 'react';

interface UseToastReturn {
    isVisible: boolean;
    show: (duration?: number) => void;
    hide: () => void;
}

export function useToast(defaultDuration = 2000): UseToastReturn {
    const [isVisible, setIsVisible] = useState(false);

    const show = useCallback((duration = defaultDuration) => {
        setIsVisible(true);
        setTimeout(() => setIsVisible(false), duration);
    }, [defaultDuration]);

    const hide = useCallback(() => {
        setIsVisible(false);
    }, []);

    return { isVisible, show, hide };
}
