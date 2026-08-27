"use client";

import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./ui";
import { money, num } from "@/lib/api-client";
import { format } from "date-fns";

// ─── Types ───
export type KanbanColumn<T> = {
  id: string;
  title: string;
  items: T[];
};

export type KanbanCardRender<T> = (item: T) => {
  title: string;
  subtitle?: string;
  amount?: string;
  badge?: string;
  meta?: string;
  onClick?: () => void;
};

// ─── Sortable Card ───
function SortableCard<T extends { id: string }>({
  item, render, onClick,
}: {
  item: T;
  render: KanbanCardRender<T>;
  onClick?: (item: T) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const data = render(item);
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => { if (!isDragging && onClick) { e.stopPropagation(); onClick(item); } }}
      className="rounded-xl border border-border/50 bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/20 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium truncate flex-1">{data.title}</p>
        {data.badge && <StatusBadge status={data.badge} />}
      </div>
      {data.subtitle && <p className="text-xs text-muted-foreground truncate">{data.subtitle}</p>}
      <div className="flex items-center justify-between mt-2">
        {data.amount && <span className="text-sm font-bold tabular-nums">{data.amount}</span>}
        {data.meta && <span className="text-[10px] text-muted-foreground">{data.meta}</span>}
      </div>
    </div>
  );
}

// ─── Kanban Board ───
export function KanbanBoard<T extends { id: string; status?: string }>({
  columns,
  render,
  onMove,
  onItemClick,
  loading,
}: {
  columns: KanbanColumn<T>[];
  render: KanbanCardRender<T>;
  onMove: (itemId: string, fromColumn: string, toColumn: string) => Promise<void> | void;
  onItemClick?: (item: T) => void;
  loading?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const itemId = String(active.id);
    // Find which column the item is in and which column it was dropped on
    let fromColumn = "";
    let toColumn = "";

    for (const col of columns) {
      if (col.items.some((it) => it.id === itemId)) fromColumn = col.id;
      // Check if dropped on a column header or on another card in a column
      if (col.id === String(over.id) || col.items.some((it) => it.id === String(over.id))) {
        toColumn = col.id;
      }
    }

    if (fromColumn && toColumn && fromColumn !== toColumn) {
      await onMove(itemId, fromColumn, toColumn);
    }
  }

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => (
          <div key={col.id} className="w-72 shrink-0">
            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 h-96">
              <div className="h-5 w-20 shimmer rounded mb-3" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 shimmer rounded-lg mb-2" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {columns.map((col) => (
          <div key={col.id} className="w-72 shrink-0 flex flex-col">
            {/* Column header */}
            <div className="rounded-t-xl border border-border/40 border-b-0 bg-muted/30 px-3 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", getColumnColor(col.id))} />
                <span className="text-sm font-semibold">{col.title}</span>
              </div>
              <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">{col.items.length}</span>
            </div>

            {/* Column body */}
            <div
              ref={(el) => { scrollRefs.current[col.id] = el; }}
              className="rounded-b-xl border border-border/40 border-t-0 bg-muted/10 p-2 flex-1 min-h-[200px] space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar"
              data-column-id={col.id}
            >
              <SortableContext items={col.items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
                {col.items.map((item) => (
                  <SortableCard key={item.id} item={item} render={render} onClick={onItemClick} />
                ))}
              </SortableContext>
              {col.items.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground/50">
                  Drop cards here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="rounded-xl border border-primary/30 bg-card p-3 shadow-pop opacity-90 rotate-2">
            {(() => {
              const item = columns.flatMap((c) => c.items).find((it) => it.id === activeId);
              if (!item) return null;
              const data = render(item);
              return (
                <div>
                  <p className="text-sm font-medium truncate">{data.title}</p>
                  {data.subtitle && <p className="text-xs text-muted-foreground truncate">{data.subtitle}</p>}
                  {data.amount && <p className="text-sm font-bold mt-1">{data.amount}</p>}
                </div>
              );
            })()}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ─── View Toggle (List / Kanban) ───
export function ViewToggle({ view, onChange }: { view: "list" | "kanban"; onChange: (v: "list" | "kanban") => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card p-0.5">
      <button
        onClick={() => onChange("list")}
        className={cn("px-2.5 py-1 text-xs font-medium rounded-md transition-colors", view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
      >
        List
      </button>
      <button
        onClick={() => onChange("kanban")}
        className={cn("px-2.5 py-1 text-xs font-medium rounded-md transition-colors", view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
      >
        Kanban
      </button>
    </div>
  );
}

// ─── Delete Confirm Dialog ───
export function DeleteConfirm({
  open, onConfirm, onCancel, title = "Delete", message = "Are you sure? This action cannot be undone.",
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-card rounded-xl border border-border/60 shadow-pop p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-base">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1.5">{message}</p>
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 rounded-lg bg-destructive text-destructive-foreground px-3 py-2 text-sm font-medium hover:bg-destructive/90 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Dialog (reusable wrapper) ───
export function EditDialog({
  open, onClose, title, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border/60 shadow-pop p-5 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-base mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ─── Helpers ───
function getColumnColor(id: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-amber-500", CONFIRMED: "bg-blue-500", PROCESSING: "bg-cyan-500",
    SHIPPED: "bg-violet-500", DELIVERED: "bg-emerald-500", CANCELLED: "bg-red-500",
    RETURNED: "bg-orange-500", REFUNDED: "bg-fuchsia-500",
    UNPAID: "bg-red-500", PARTIAL: "bg-amber-500", PAID: "bg-emerald-500",
    PACKED: "bg-cyan-500", IN_TRANSIT: "bg-violet-500", FAILED: "bg-red-500",
    NEW: "bg-blue-500", CONTACTED: "bg-cyan-500", QUALIFIED: "bg-violet-500",
    NEGOTIATION: "bg-amber-500", ORDER_CREATED: "bg-blue-500", WON: "bg-emerald-500", LOST: "bg-red-500",
    FOLLOW_UP: "bg-amber-500", CONVERTED: "bg-emerald-500",
    RECEIVED: "bg-emerald-500", ACTIVE: "bg-emerald-500", INACTIVE: "bg-muted-foreground",
    DRAFT: "bg-muted-foreground", PENDING_APPROVAL: "bg-amber-500", APPROVED: "bg-emerald-500", REJECTED: "bg-red-500",
  };
  return colors[id] ?? "bg-primary";
}

// ─── Sort Header (clickable column headers) ───
export function SortHeader({
  label, field, currentSort, currentDir, onSort,
}: {
  label: string;
  field: string;
  currentSort?: string;
  currentDir?: "asc" | "desc";
  onSort: (field: string) => void;
}) {
  const active = currentSort === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={cn("text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider hover:text-foreground transition-colors", active ? "text-primary" : "text-muted-foreground")}
    >
      {label} {active && (currentDir === "asc" ? "↑" : "↓")}
    </button>
  );
}
