import {
    collection,
    addDoc,
    query,
    orderBy,
    getDocs,
    deleteDoc,
    doc,
    Timestamp,
    where,
    setDoc,
    getDoc
} from "firebase/firestore";
import { db } from "./firebase";
import { startOfDay } from 'date-fns';
import type { Entry, Expense, ExpenseCategory, Todo } from "../types/types";


const EXPENSES_COLLECTION = "expenses";

export const addEntry = async (
    userId: string,
    content: string,
    tags: string[],
    category: 'action' | 'thought' | 'chore',
    date?: Date,
    collectionName: string = 'entries'
) => {
    try {
        const timestamp = date ? Timestamp.fromDate(date) : Timestamp.now();
        const docRef = await addDoc(collection(db, `users/${userId}/${collectionName}`), {
            content,
            tags,
            category,
            timestamp,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
        return docRef.id;
    } catch (e) {
        console.error("Error adding document: ", e);
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
        })) as Entry[];
    } catch (e) {
        console.error("Error getting documents: ", e);
        throw e;
    }
};

export const deleteEntry = async (userId: string, entryId: string, collectionName: string = 'entries') => {
    try {
        await deleteDoc(doc(db, `users/${userId}/${collectionName}`, entryId));
    } catch (e) {
        console.error("Error deleting document: ", e);
        throw e;
    }
};

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
