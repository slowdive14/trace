import React from 'react';
import { Check } from 'lucide-react';

interface ToastProps {
    message: string;
    isVisible: boolean;
    icon?: React.ReactNode;
}

const Toast: React.FC<ToastProps> = ({ message, isVisible, icon }) => {
    if (!isVisible) return null;

    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-accent text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
            {icon || <Check size={16} />}
            <span className="text-sm font-medium">{message}</span>
        </div>
    );
};

export default Toast;
