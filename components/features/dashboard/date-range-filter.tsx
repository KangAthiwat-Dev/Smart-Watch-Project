"use client";

import { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { th } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO, isValid } from "date-fns";

export default function DateRangeFilter() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);

    // Initialize from URL
    useEffect(() => {
        const from = searchParams.get("from");
        const to = searchParams.get("to");

        if (from && isValid(parseISO(from))) {
            setStartDate(parseISO(from));
        } else {
            setStartDate(null);
        }

        if (to && isValid(parseISO(to))) {
            setEndDate(parseISO(to));
        } else {
            setEndDate(null);
        }
    }, [searchParams]);

    const handleApply = (start: Date | null, end: Date | null) => {
        const params = new URLSearchParams(searchParams.toString());

        if (start) {
            params.set("from", format(start, "yyyy-MM-dd"));
        } else {
            params.delete("from");
        }

        if (end) {
            params.set("to", format(end, "yyyy-MM-dd"));
        } else {
            params.delete("to");
        }

        router.push(`?${params.toString()}`);
    };

    const handleClear = () => {
        setStartDate(null);
        setEndDate(null);
        handleApply(null, null);
    };

    const onChange = (dates: [Date | null, Date | null]) => {
        const [start, end] = dates;
        setStartDate(start);
        setEndDate(end);

        if (start && end) {
            handleApply(start, end);
        } else if (!start && !end) {
            handleApply(null, null);
        }
    };

    return (
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-full border border-slate-200 dark:border-gray-700 px-3 py-1.5 shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
            <CalendarIcon className="w-4 h-4 text-slate-500" />
            <div className="custom-datepicker-wrapper">
                <DatePicker
                    selected={startDate}
                    onChange={onChange}
                    startDate={startDate}
                    endDate={endDate}
                    selectsRange
                    isClearable={false}
                    locale={th}
                    dateFormat="d MMM yyyy"
                    placeholderText="เลือกช่วงเวลา"
                    className="text-sm text-slate-700 dark:text-gray-200 font-medium bg-transparent border-none outline-none placeholder:text-slate-400 dark:placeholder:text-gray-500 w-[200px] cursor-pointer"
                    maxDate={new Date()}
                />
            </div>
            {(startDate || endDate) && (
                <button
                    onClick={handleClear}
                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}
