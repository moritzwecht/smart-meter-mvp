"use client";

import { Check, ListTodo, Pin } from "lucide-react";
import { memo } from "react";
import type { ListWithItems } from "@/lib/offline/hooks";
import { cn } from "@/lib/utils";

interface ListWidgetProps {
    list: ListWithItems;
    onOpen: (listId: string) => void;
    onTogglePin: (listId: string, pinned: boolean) => void;
    onToggleItem: (itemId: string, completed: boolean) => void;
}

const PREVIEW = 4;

export const ListWidget = memo(function ListWidget({ list, onOpen, onTogglePin, onToggleItem }: ListWidgetProps) {
    const open = list.items.filter((i) => !i.completed);
    const done = list.items.length - open.length;
    const preview = [...open, ...list.items.filter((i) => i.completed)].slice(0, PREVIEW);

    return (
        <div className="bg-card text-card-foreground rounded-lg border border-border flex flex-col p-3 gap-3 shadow-sm hover:border-primary/50 transition-colors">
            <div className="flex justify-between items-start gap-3">
                <button type="button" onClick={() => onOpen(list.id)} className="flex items-start gap-2.5 min-w-0 flex-1 text-left">
                    <div className="mt-1.5 p-1.5 bg-accent rounded-lg shrink-0">
                        <ListTodo className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xl font-black tracking-tight text-foreground line-clamp-1">{list.name}</h3>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {list.items.length === 0 ? "Leer" : `${open.length} offen${done ? ` · ${done} erledigt` : ""}`}
                        </p>
                    </div>
                </button>
                <button
                    type="button"
                    onClick={() => onTogglePin(list.id, !list.isPinned)}
                    aria-pressed={list.isPinned}
                    aria-label={list.isPinned ? "Vom Dashboard lösen" : "Ans Dashboard heften"}
                    className={cn(
                        "p-1.5 rounded-lg shrink-0",
                        list.isPinned ? "text-primary bg-primary/10" : "text-muted-foreground/40 hover:text-primary hover:bg-primary/5",
                    )}
                >
                    <Pin className={cn("w-3.5 h-3.5", list.isPinned && "fill-current")} />
                </button>
            </div>

            {preview.length > 0 && (
                <ul className="space-y-1">
                    {preview.map((item) => (
                        <li key={item.id}>
                            <button
                                type="button"
                                onClick={() => onToggleItem(item.id, !item.completed)}
                                aria-pressed={item.completed}
                                className="text-xs flex items-center gap-3 w-full text-left p-1 -mx-1 rounded-md hover:bg-accent/40 transition-colors"
                            >
                                <span
                                    className={cn(
                                        "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                        item.completed ? "bg-primary text-primary-foreground border-primary" : "border-border",
                                    )}
                                >
                                    {item.completed && <Check className="w-2.5 h-2.5" />}
                                </span>
                                <span className={cn("line-clamp-1", item.completed ? "line-through opacity-40" : "text-foreground/80")}>{item.content}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {list.items.length > PREVIEW && (
                <button type="button" onClick={() => onOpen(list.id)} className="text-[10px] text-muted-foreground font-medium text-left hover:text-primary">
                    +{list.items.length - PREVIEW} weitere
                </button>
            )}
        </div>
    );
});
