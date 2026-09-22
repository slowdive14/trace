import React from 'react';

interface DateFieldProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    title?: string;
    min?: string;
    max?: string;
    id?: string;
}

/**
 * 누르면 달력이 바로 열리는 날짜 입력.
 *
 * type="date"는 기본적으로 오른쪽 끝의 작은 달력 아이콘을 정확히 눌러야 달력이 열린다.
 * 숫자 칸을 누르면 타이핑 모드로 들어가서, 사실상 숫자로 받아 적어야 하는 입력이 된다.
 * 어디를 누르든 달력이 열리게 한다.
 */
const DateField: React.FC<DateFieldProps> = ({ value, onChange, className, title, min, max, id }) => (
    <input
        id={id}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        onClick={e => {
            // 이미 열려 있거나 지원하지 않는 브라우저면 기본 동작에 맡긴다
            try { e.currentTarget.showPicker?.(); } catch { /* 무시 */ }
        }}
        className={className}
        title={title}
        min={min}
        max={max}
    />
);

export default DateField;
