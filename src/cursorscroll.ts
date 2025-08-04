import { Editor, Debouncer, debounce } from "obsidian";
import { EditorSelection } from "@codemirror/state";
import { ViewUpdate } from "@codemirror/view";

import type { default as ScrollingPlugin } from "./main";

export class CursorScroll {
    private plugin: ScrollingPlugin;
    private skip = false;
    private skipReset: number;
    private relativeLineOffset: number | null = null;

    public readonly wheelHandler: Debouncer<[HTMLElement], void>;
    private static readonly UPDATE_INTERVAL = 20;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        this.wheelHandler = debounce(
            this.applyScroll.bind(this),
            CursorScroll.UPDATE_INTERVAL,
            false,
        );
    }

    public leafChangeHandler(): void {
        this.relativeLineOffset = null;
    }

    public cursorHandler(update: ViewUpdate): void {
        if (this.skip) {
            return;
        }

        const cm = update.view;
        const head = update.state.selection.main.head;
        const block = cm.lineBlockAt(head);

        // Store the offset from the scroll top
        this.relativeLineOffset = block.top - cm.scrollDOM.scrollTop;
    }

    // private applyScroll(element: HTMLElement): void {
    //     if (!this.plugin.settings.cursorScrollEnabled) return;
    //     if (this.relativeLineOffset == null) return;

    //     const editor = this.plugin.app.workspace.activeEditor?.editor;
    //     if (!editor || editor.cm.scrollDOM !== element) return;
    //     const cm = editor.cm;

    //     const scrollTop = cm.scrollDOM.scrollTop;
    //     const clientHeight = cm.scrollDOM.clientHeight;
    //     const targetTop = scrollTop + this.relativeLineOffset;

    //     // Make sure the target line is actually on screen
    //     if (targetTop < scrollTop || targetTop > scrollTop + clientHeight) {
    //         return;
    //     }

    //     // Calculate target position using screen coordinates
    //     // const scrollRect = cm.scrollDOM.getBoundingClientRect();
    //     // const coords = {
    //     //     x: scrollRect.left + 10, // Small offset from left edge
    //     //     y: scrollRect.top + this.relativeLineOffset,
    //     // };

    //     const block = editor.cm.lineBlockAtHeight(targetTop);
    //     // editor.posToOffset(block.from)
    //     const fromPos = block.from;
    //     const toPos = block.to;

    //     // Convert back to screen coordinates to see which is closer
    //     const fromCoords = editor.cm.coordsAtPos(fromPos);
    //     const toCoords = editor.cm.coordsAtPos(toPos);

    //     // Calculate distances to our target
    //     const fromDistance = Math.abs(fromCoords?.top - targetTop);
    //     const toDistance = Math.abs(toCoords?.top - targetTop);

    //     // Pick the closer one
    //     const pos = fromDistance <= toDistance ? fromPos : toPos;

    //     // NOTE: This will never return a position inside a table
    //     // const pos = cm.posAtCoords(coords);
    //     // if (!pos) return;

    //     const line = cm.state.doc.lineAt(pos);
    //     const lineNumber = line.number - 1; // Convert to zero-based

    //     this.setCursorPosition(editor, lineNumber);
    // }

    private applyScroll(element: HTMLElement): void {
        if (!this.plugin.settings.cursorScrollEnabled) return;
        if (this.relativeLineOffset == null) return;

        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor || editor.cm.scrollDOM !== element) return;
        const cm = editor.cm;

        const scrollTop = cm.scrollDOM.scrollTop;
        const clientHeight = cm.scrollDOM.clientHeight;
        const targetTop = scrollTop + this.relativeLineOffset;

        // Make sure the target line is actually on screen
        if (targetTop < scrollTop || targetTop > scrollTop + clientHeight) {
            return;
        }

        // Calculate target position using screen coordinates
        const scrollRect = cm.scrollDOM.getBoundingClientRect();
        const coords = {
            x: scrollRect.left + 10, // Small offset from left edge
            y: scrollRect.top + this.relativeLineOffset,
        };

        // NOTE: This will never return a position inside a table
        const pos = cm.posAtCoords(coords);
        if (!pos) return;

        const line = cm.state.doc.lineAt(pos);
        const lineNumber = line.number - 1; // Convert to zero-based

        this.setCursorPosition(editor, lineNumber);
    }

    private setCursorPosition(editor: Editor, line: number): void {
        // Prevent infinite loop
        this.skip = true;
        window.clearTimeout(this.skipReset);
        this.skipReset = window.setTimeout(() => (this.skip = false), 100);

        try {
            // Get the actual position in the document (start of line)
            const pos = editor.cm.state.doc.line(line + 1).from;

            // Create selection and dispatch
            const selection = EditorSelection.single(pos);
            editor.cm.dispatch({
                selection,
                effects: [], // Prevent side effects
            });
        } catch {}
    }
}
