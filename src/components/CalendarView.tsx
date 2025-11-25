import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface CalendarViewProps {
    onClose: () => void;
    onSelectDate: (date: Date) => void;
    markedDates?: Date[]; // Dates with entries
}

const CalendarView: React.FC<CalendarViewProps> = ({ onClose, onSelectDate, markedDates = [] }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Start on Sunday
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const daysInCalendar = eachDayOfInterval({
        start: calendarStart,
        end: calendarEnd,
    });

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    return (
        <div className="fixed inset-0 bg-bg-primary/95 backdrop-blur z-50 flex items-center justify-center p-4">
            <div className="bg-bg-secondary w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-bg-tertiary relative">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-text-secondary hover:text-text-primary p-1.5 z-10"
                >
                    <X size={20} />
                </button>

                <div className="flex items-center justify-between mb-6 pr-8">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-bg-tertiary rounded-full">
                        <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-lg font-bold">
                        {format(currentMonth, 'yyyy년 M월')}
                    </h2>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-bg-tertiary rounded-full">
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center mb-2">
                    {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                        <div key={day} className="text-text-secondary text-sm py-2">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                    {daysInCalendar.map(date => {
                        const isMarked = markedDates.some(d => isSameDay(d, date));
                        const isCurrentMonth = isSameMonth(date, currentMonth);
                        const isTodayDate = isToday(date);
                        return (
                            <button
                                key={date.toString()}
                                onClick={() => {
                                    onSelectDate(date);
                                    onClose();
                                }}
                                className={`
                  aspect-square rounded-full flex items-center justify-center text-sm relative
                  ${!isCurrentMonth ? 'text-text-secondary opacity-50' : 'text-text-primary'}
                  ${isTodayDate ? 'bg-accent text-white font-bold' : 'hover:bg-bg-tertiary'}
                  transition-colors
                `}
                            >
                                {format(date, 'd')}
                                {isMarked && !isTodayDate && (
                                    <div className="absolute bottom-1.5 w-1 h-1 bg-accent rounded-full" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default CalendarView;
