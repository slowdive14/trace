export interface Entry {
    id: string;
    content: string;
    tags: string[];
    category: 'action' | 'thought';
    timestamp: Date;
    userId: string;
}

export interface User {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
}
