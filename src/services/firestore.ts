import {
    collection,
    addDoc,
    query,
    orderBy,
    getDocs,
    deleteDoc,
    doc,
    Timestamp
} from "firebase/firestore";
import { db } from "./firebase";
import type { Entry } from "../types/types";

const ENTRIES_COLLECTION = "entries";

export const addEntry = async (
    userId: string,
    content: string,
    tags: string[],
    category: 'action' | 'thought',
    date?: Date
) => {
    try {
        const timestamp = date ? Timestamp.fromDate(date) : Timestamp.now();
        const docRef = await addDoc(collection(db, `users/${userId}/${ENTRIES_COLLECTION}`), {
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

export const getEntries = async (userId: string) => {
    try {
        const q = query(
            collection(db, `users/${userId}/${ENTRIES_COLLECTION}`),
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

export const deleteEntry = async (userId: string, entryId: string) => {
    try {
        await deleteDoc(doc(db, `users/${userId}/${ENTRIES_COLLECTION}`, entryId));
    } catch (e) {
        console.error("Error deleting document: ", e);
        throw e;
    }
};
