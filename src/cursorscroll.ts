import { Editor, Debouncer, debounce } from "obsidian";
import { EditorSelection } from "@codemirror/state";

import type { default as ScrollingPlugin } from "./main";

export class CursorScroll {
    private plugin: ScrollingPlugin;
    private relativeLineOffset: number | null = null;

    public skipCursor = false;
    private readonly resetSkip: Debouncer<[void], void>;
    private static readonly CURSOR_SKIP_DELAY = 500;

    public readonly wheelHandler: Debouncer<[HTMLElement], void>;

    // Balanced between performance and visual response
    private static readonly UPDATE_INTERVAL = 70;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        this.resetSkip = debounce(
            () => {
                this.skipCursor = false;
            },
            CursorScroll.CURSOR_SKIP_DELAY,
            true,
        );

        this.wheelHandler = debounce(
            this.applyScroll.bind(this),
            CursorScroll.UPDATE_INTERVAL,
            false,
        );

        window.requestAnimationFrame(this.cursorHandler.bind(this));
    }

    public leafChangeHandler(): void {
        this.relativeLineOffset = null;
    }

    // Store the offset from the scroll top
    public cursorHandler(): void {
        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor) return;
        const block = editor.cm.lineBlockAt(editor.posToOffset(editor.getCursor()));
        const scrollDOM = editor.cm.scrollDOM;
        const relativeLineOffset =
            (block.top + block.bottom) / 2 -
            scrollDOM.scrollTop +
            scrollDOM.getBoundingClientRect().top;
        this.relativeLineOffset = Math.max(0, Math.min(scrollDOM.clientHeight, relativeLineOffset));
    }

    private applyScroll(el: HTMLElement): void {
        if (!this.plugin.settings.cursorScrollEnabled) return;
        if (this.relativeLineOffset == null) return;

        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor || editor.cm.scrollDOM !== el) return;
        const cm = editor.cm;

        const scrollTop = cm.scrollDOM.scrollTop;
        const clientHeight = cm.scrollDOM.clientHeight;
        const targetTop = scrollTop + this.relativeLineOffset;

        // Make sure the target line is actually on screen
        if (targetTop < scrollTop || targetTop > scrollTop + clientHeight) {
            return;
        }

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
        // Prevent updating relative line offset
        this.skipCursor = true;
        this.resetSkip();

        try {
            // Get the actual position in the document (start of line)
            const pos = editor.cm.state.doc.line(line + 1).from;

            // Create selection and dispatch
            const selection = EditorSelection.single(pos);
            editor.cm.dispatch({
                selection,
                effects: [], // To prevent side effects
            });
        } catch {}
    }
}
