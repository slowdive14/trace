import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface QuadrantConfig {
    id: string;
    title: string;
    label: string;
    color: string;
}

interface MatrixQuadrantProps<T> {
    config: QuadrantConfig;
    items: T[];
    getItemId: (item: T) => string;
    renderItem: (item: T) => React.ReactNode;
    emptyText?: string;
}

function MatrixQuadrant<T>({
    config,
    items,
    getItemId,
    renderItem,
    emptyText = '없음'
}: MatrixQuadrantProps<T>) {
    const { setNodeRef, isOver } = useDroppable({ id: config.id });

    return (
        <div
            ref={setNodeRef}
            className={`flex-1 flex flex-col p-2 rounded-lg border-2 transition-colors overflow-hidden ${
                isOver ? 'border-accent bg-accent/5' : 'border-bg-tertiary bg-bg-secondary/30'
            }`}
            style={{ minHeight: '120px' }}
        >
            <div className="flex items-center justify-between mb-2 px-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
                    {config.title}
                </span>
                <span className="text-[9px] text-text-tertiary">{config.label}</span>
            </div>
            <div
                className="flex-1 overflow-y-auto space-y-1"
                style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
            >
                <SortableContext
                    items={items.map(getItemId)}
                    strategy={verticalListSortingStrategy}
                >
                    {items.map(item => (
                        <React.Fragment key={getItemId(item)}>
                            {renderItem(item)}
                        </React.Fragment>
                    ))}
                </SortableContext>
                {items.length === 0 && !isOver && (
                    <div className="flex-1 flex items-center justify-center border border-dashed border-bg-tertiary rounded opacity-30">
                        <span className="text-[10px] text-text-tertiary">{emptyText}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default MatrixQuadrant;
