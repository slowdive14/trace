import { subDays, startOfDay } from 'date-fns';

/**
 * Returns the "logical" date based on a 5AM cutoff.
 * If the current time is before 5:00 AM, it returns the previous day.
 * @param date Optional date to check. Defaults to new Date().
 * @returns The logical date.
 */
export const getLogicalDate = (date: Date = new Date()): Date => {
    const hours = date.getHours();
    if (hours < 5) {
        return subDays(date, 1);
    }
    return date;
};

/**
 * Returns the start of the logical day.
 * Useful for filtering or grouping.
 */
export const getLogicalStartOfDay = (date: Date = new Date()): Date => {
    return startOfDay(getLogicalDate(date));
};
