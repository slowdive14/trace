import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
    setDoc,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { startOfDay } from 'date-fns';
import type { Expense, ExpenseCategory, Todo, Worry, WorryEntry } from '../types/types';

const EXPENSES_COLLECTION = 'expenses';

// Expense functions
export const addExpense = async (
    userId: string,
    description: string,
    amount: number,
    category: ExpenseCategory,
    date?: Date
) => {
    try {
        const timestamp = date ? Timestamp.fromDate(date) : Timestamp.now();
        const docRef = await addDoc(collection(db, `users/${userId}/${EXPENSES_COLLECTION}`), {
            description,
            amount,
            category,
            timestamp,
            createdAt: Timestamp.now(),
        });
        return docRef.id;
    } catch (e) {
        console.error("Error adding expense: ", e);
        throw e;
    }
};

export const addBatchExpenses = async (
    userId: string,
    expenses: Array<{
        description: string;
        amount: number;
        category: ExpenseCategory;
    }>,
    date?: Date
) => {
    try {
        const timestamp = date ? Timestamp.fromDate(date) : Timestamp.now();
        const promises = expenses.map(expense =>
            addDoc(collection(db, `users/${userId}/${EXPENSES_COLLECTION}`), {
                description: expense.description,
                amount: expense.amount,
                category: expense.category,
                timestamp,
                createdAt: Timestamp.now(),
            })
        );
        await Promise.all(promises);
    } catch (e) {
        console.error("Error adding batch expenses: ", e);
        throw e;
    }
};

export const getExpenses = async (userId: string, startDate?: Date, endDate?: Date) => {
    try {
        let q = query(
            collection(db, `users/${userId}/${EXPENSES_COLLECTION}`),
            orderBy("timestamp", "desc")
        );

        if (startDate) {
            q = query(q, where("timestamp", ">=", Timestamp.fromDate(startDate)));
        }
        if (endDate) {
            q = query(q, where("timestamp", "<=", Timestamp.fromDate(endDate)));
        }

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp.toDate(),
        })) as Expense[];
    } catch (e) {
        console.error("Error getting expenses: ", e);
        throw e;
    }
};

export const deleteExpense = async (userId: string, expenseId: string) => {
    try {
        await deleteDoc(doc(db, `users/${userId}/${EXPENSES_COLLECTION}`, expenseId));
    } catch (e) {
        console.error("Error deleting expense: ", e);
        throw e;
    }
};

// Generic Entry functions
export const deleteEntry = async (userId: string, entryId: string, collectionName: string) => {
    try {
        await deleteDoc(doc(db, `users/${userId}/${collectionName}`, entryId));
    } catch (e) {
        console.error("Error deleting entry: ", e);
        throw e;
    }
};

export const toggleEntryPin = async (userId: string, entryId: string, currentStatus: boolean, collectionName: string) => {
    try {
        const docRef = doc(db, `users/${userId}/${collectionName}`, entryId);
        await updateDoc(docRef, {
            isPinned: !currentStatus,
            updatedAt: Timestamp.now()
        });
    } catch (e) {
        console.error("Error toggling pin: ", e);
        throw e;
    }
};

export const addEntry = async (
    userId: string,
    content: string,
    tags: string[],
    category: string,
    date?: Date,
    collectionName: string = 'entries',
    isPinned: boolean = false
) => {
    try {
        const timestamp = date ? Timestamp.fromDate(date) : Timestamp.now();
        const docRef = await addDoc(collection(db, `users/${userId}/${collectionName}`), {
            content,
            tags,
            category,
            timestamp,
            isPinned,
            createdAt: Timestamp.now(),
        });
        return docRef.id;
    } catch (e) {
        console.error("Error adding entry: ", e);
        throw e;
    }
};

export const getEntries = async (userId: string, collectionName: string = 'entries') => {
    try {
        const q = query(
            collection(db, `users/${userId}/${collectionName}`),
            orderBy("timestamp", "desc")
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp.toDate(),
        })) as any[]; // Using any[] to avoid circular dependency issues if Entry type isn't perfectly aligned
    } catch (e) {
        console.error("Error getting entries: ", e);
        throw e;
    }
};

export const updateEntry = async (userId: string, entryId: string, content: string, collectionName: string = 'entries', extraData: any = {}) => {
    try {
        const entryRef = doc(db, `users/${userId}/${collectionName}`, entryId);
        await updateDoc(entryRef, {
            content,
            ...extraData,
            updatedAt: Timestamp.now()
        });
    } catch (e) {
        console.error("Error updating entry: ", e);
        throw e;
    }
};

// Todo functions
export const saveTodo = async (userId: string, date: Date, content: string, collectionName: string = 'todos') => {
    try {
        // Normalize to start of day to ensure consistent date storage
        const normalizedDate = startOfDay(date);

        // Use local date to avoid timezone issues
        const year = normalizedDate.getFullYear();
        const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
        const day = String(normalizedDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD
        const docRef = doc(db, `users/${userId}/${collectionName}`, dateStr);

        await setDoc(docRef, {
            content,
            date: Timestamp.fromDate(normalizedDate),
            updatedAt: Timestamp.now()
        }, { merge: true });
    } catch (e) {
        console.error("Error saving todo: ", e);
        throw e;
    }
};

export const getTodo = async (userId: string, date: Date, collectionName: string = 'todos') => {
    try {
        // Use local date to avoid timezone issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD
        const docRef = doc(db, `users/${userId}/${collectionName}`, dateStr);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return {
                id: docSnap.id,
                ...docSnap.data(),
                date: docSnap.data().date.toDate(),
                updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
            } as Todo;
        }
        return null;
    } catch (e) {
        console.error("Error getting todo: ", e);
        throw e;
    }
};

export const getTodos = async (userId: string, startDate: Date, endDate: Date, collectionName: string = 'todos') => {
    try {
        const q = query(
            collection(db, `users/${userId}/${collectionName}`),
            where("date", ">=", Timestamp.fromDate(startDate)),
            where("date", "<=", Timestamp.fromDate(endDate)),
            orderBy("date", "desc")
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date.toDate(),
        })) as Todo[];
    } catch (e) {
        console.error("Error getting todos: ", e);
        throw e;
    }
};

export const saveTemplate = async (userId: string, content: string, collectionName: string = 'todos') => {
    try {
        const docRef = doc(db, `users/${userId}/${collectionName}`, 'template_default');
        await setDoc(docRef, {
            content,
            updatedAt: Timestamp.now()
        }, { merge: true });
    } catch (e) {
        console.error("Error saving template: ", e);
        throw e;
    }
};

export const getTemplate = async (userId: string, collectionName: string = 'todos') => {
    try {
        const docRef = doc(db, `users/${userId}/${collectionName}`, 'template_default');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data().content as string;
        }
        return null;
    } catch (e) {
        console.error("Error getting template: ", e);
        throw e;
    }
};

// ============ Worry Functions ============

// Create new worry
export const createWorry = async (
    userId: string,
    title: string
): Promise<string> => {
    // Get current max order for new worry placement
    const existingWorries = await getActiveWorries(userId);
    const maxOrder = existingWorries.reduce((max, w) => Math.max(max, w.order ?? 0), 0);

    const worryRef = collection(db, 'users', userId, 'worries');
    const docRef = await addDoc(worryRef, {
        title,
        status: 'active',
        startDate: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        order: maxOrder + 1,
    });
    return docRef.id;
};

// Get active worry (only one allowed) - DEPRECATED but kept for compatibility
export const getActiveWorry = async (userId: string): Promise<Worry | null> => {
    const worryRef = collection(db, 'users', userId, 'worries');
    const q = query(worryRef, where('status', '==', 'active'), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return {
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate.toDate(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate()
    } as Worry;
};

// Get all active worries
export const getActiveWorries = async (userId: string): Promise<Worry[]> => {
    const worryRef = collection(db, 'users', userId, 'worries');
    // Removed orderBy to avoid needing a composite index
    const q = query(worryRef, where('status', '==', 'active'));
    const snapshot = await getDocs(q);

    const worries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate.toDate(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
        order: doc.data().order
    } as Worry));

    // Client-side sort: order first (ascending), then createdAt (newest first) as fallback
    return worries.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
        }
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
    });
};

// Update worry orders (batch update for drag-and-drop reordering)
export const updateWorryOrders = async (
    userId: string,
    orderUpdates: Array<{ id: string; order: number }>
): Promise<void> => {
    const batch = writeBatch(db);
    for (const { id, order } of orderUpdates) {
        const worryRef = doc(db, 'users', userId, 'worries', id);
        batch.update(worryRef, { order, updatedAt: Timestamp.now() });
    }
    await batch.commit();
};

// Close worry with reflection
export const closeWorry = async (
    userId: string,
    worryId: string,
    reflection: Worry['reflection']
): Promise<void> => {
    const worryRef = doc(db, 'users', userId, 'worries', worryId);
    await updateDoc(worryRef, {
        status: 'closed',
        closedAt: Timestamp.now(),
        reflection,
        updatedAt: Timestamp.now(),
    });
};

// Delete worry and all its entries
export const deleteWorry = async (userId: string, worryId: string): Promise<void> => {
    // 1. Delete all entries in subcollection
    const entriesRef = collection(db, 'users', userId, 'worryEntries');
    const q = query(entriesRef, where('worryId', '==', worryId));
    const snapshot = await getDocs(q);

    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // 2. Delete the worry document
    const worryRef = doc(db, 'users', userId, 'worries', worryId);
    await deleteDoc(worryRef);
};

// Get all closed worries (for history/insights)
export const getClosedWorries = async (userId: string): Promise<Worry[]> => {
    const worryRef = collection(db, 'users', userId, 'worries');
    const q = query(
        worryRef,
        where('status', '==', 'closed')
        // orderBy 제거 - 복합 인덱스 불필요하게 클라이언트 측 정렬
    );
    const snapshot = await getDocs(q);
    const worries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate.toDate(),
        closedAt: doc.data().closedAt?.toDate(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate()
    } as Worry));

    // 클라이언트 측 정렬 (closedAt 내림차순)
    return worries.sort((a, b) =>
        (b.closedAt?.getTime() || 0) - (a.closedAt?.getTime() || 0)
    );
};

// ============ WorryEntry Functions ============

// Add worry entry
export const addWorryEntry = async (
    userId: string,
    worryId: string,
    type: WorryEntry['type'],
    content: string,
    week: number,
    parentId?: string
): Promise<string> => {
    const entryRef = collection(db, 'users', userId, 'worryEntries');
    const docRef = await addDoc(entryRef, {
        worryId,
        type,
        content,
        week,
        parentId: parentId || null,
        timestamp: Timestamp.now(),
        createdAt: Timestamp.now(),
    });
    return docRef.id;
};

// Get entries for a specific worry
export const getWorryEntries = async (
    userId: string,
    worryId: string
): Promise<WorryEntry[]> => {
    const entryRef = collection(db, 'users', userId, 'worryEntries');
    const q = query(
        entryRef,
        where('worryId', '==', worryId)
    );
    const snapshot = await getDocs(q);
    const entries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
        createdAt: doc.data().createdAt.toDate()
    } as WorryEntry));

    return entries.sort((a, b) => {
        if (b.week !== a.week) return b.week - a.week;
        return b.timestamp.getTime() - a.timestamp.getTime();
    });
};

// Update worry entry
export const updateWorryEntry = async (
    userId: string,
    entryId: string,
    content: string
): Promise<void> => {
    const entryRef = doc(db, 'users', userId, 'worryEntries', entryId);
    await updateDoc(entryRef, {
        content,
        updatedAt: Timestamp.now()
    });
};

// Delete worry entry
export const deleteWorryEntry = async (
    userId: string,
    entryId: string
): Promise<void> => {
    const entryRef = doc(db, 'users', userId, 'worryEntries', entryId);
    await deleteDoc(entryRef);
};
