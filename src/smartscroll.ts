import { Editor, MarkdownView } from "obsidian";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { Transaction } from "@codemirror/state";
import type { default as ScrollingPlugin } from "./main";

export class SmartScroll {
    private plugin: ScrollingPlugin;

    private recentEdit = false;
    private recentMouseUp = false;
    private scrollIntensity = 0;
    private scrollLast = 0;
    private lastLine = 0;
    private animationFrame: number;

    private readonly intensityDecayRate = 0.01;
    private readonly intensityThreshold = 3;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        // Handles editing events (first invokation must be supressed)
        let initialEditorChange = plugin.app.workspace.on("editor-change", () => {
            plugin.app.workspace.offref(initialEditorChange);
            plugin.registerEvent(
                plugin.app.workspace.on("editor-change", this.editHandler.bind(this)),
            );
        });
        plugin.registerEvent(initialEditorChange);

        // Additional context for the cursor handler
        plugin.registerDomEvent(document, "mouseup", this.mouseUpHandler.bind(this));
        plugin.registerDomEvent(document, "keydown", this.keyHandler.bind(this));

        // Handles mouse events
        plugin.registerEditorExtension(EditorView.updateListener.of(this.cursorHandler.bind(this)));
    }

    private keyHandler(): void {
        this.recentMouseUp = false;
    }

    private mouseUpHandler(): void {
        this.recentMouseUp = true;

        // recentMouseUp will be reset either when a key is pressed or 100 ms pass.
        // This timeout is needed, because the keydown event is not reliable:
        // In normal mode of vim, keydown events are pretty much inaccessible.
        // Already wasted too much time with this.
        window.setTimeout(() => {
            this.recentMouseUp = false;
        }, 100);
    }

    private getScrollDirection(editor: Editor): -1 | 0 | 1 {
        // Cursor movement direction: -1 (up), 0 (same line), 1 (down)
        const lastLine = this.lastLine;
        this.lastLine = editor.getCursor().line;

        if (lastLine < this.lastLine) {
            return 1;
        } else if (lastLine > this.lastLine) {
            return -1;
        }
        return 0;
    }

    private editHandler(editor: Editor): void {
        this.recentEdit = true; // Will be reset by cursorHandler

        const scrollDirection = this.getScrollDirection(editor);
        this.invokeScroll(editor, scrollDirection);
    }

    private cursorHandler(update: ViewUpdate): void {
        // Always cancel if event was caused by mouse down/movement.
        // This only checks if this update was caused by a mouse down event,
        // but can't detect mouse up.
        for (const tr of update.transactions) {
            const event = tr.annotation(Transaction.userEvent);
            if (event === "select.pointer") {
                return;
            }
        }

        // Reset recentEdit, which was set by editHandler,
        // because cursorHandler is invoked after every edit.
        if (this.recentEdit) {
            this.recentEdit = false;
            return;
        }

        // Only proceed if its a cursor event.
        if (!update.selectionSet) return;

        this.plugin.restoreScroll.saveScrollPosition();

        // Get the editor
        const editor = this.plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
        if (!editor) return;

        const scrollDirection = this.getScrollDirection(editor);

        // Also cancel if mouse up, unless this setting allows it.
        if (
            (!this.plugin.settings.smartScrollEnableSelection && editor.somethingSelected()) ||
            (this.recentMouseUp && !this.plugin.settings.smartScrollEnableMouse)
        )
            return;

        this.invokeScroll(editor, scrollDirection);
    }

    private calculateScrollIntensity(): void {
        const time = performance.now();
        const elapsed = time - this.scrollLast;

        this.scrollLast = time;
        this.scrollIntensity =
            Math.max(0, this.scrollIntensity - elapsed * this.intensityDecayRate) + 1;
    }

    private invokeScroll(editor: Editor, scrollDirection: number): void {
        const mode = this.plugin.settings.smartScrollMode;
        if (mode === "disabled") return;

        const radiusPercent = this.plugin.settings.smartScrollRadius;
        const smoothness = this.plugin.settings.smartScrollSmoothness;
        const dynamicAnimation = this.plugin.settings.smartScrollDynamicAnimation;

        // If scrolling fast, skip animation steps
        // (Only if not scrolling inverted and scrolling without edit (otherwise run later))
        if (mode === "follow-cursor" && !this.recentEdit) {
            if (dynamicAnimation) {
                this.calculateScrollIntensity();
            } else {
                this.scrollIntensity = 0;
            }
        }

        // Get cursor position
        const cursorEl = editor.cm.scrollDOM.querySelector(".cm-active.cm-line");
        if (!cursorEl) return;
        const cursor = cursorEl.getBoundingClientRect();

        // Old method: reliable except for tables
        // const cursor = editor.cm.coordsAtPos?.(editor.posToOffset(editor.getCursor()));

        const lineHeight = editor.cm.defaultLineHeight;

        const viewOffset = editor.cm.scrollDOM.getBoundingClientRect().top;
        let cursorVerticalPosition = cursor.top + lineHeight - viewOffset;

        const scrollInfo = editor.getScrollInfo() as { top: number; left: number; height: number };
        const currentVerticalPosition = scrollInfo.top;
        let radius = ((scrollInfo.height / 2) * radiusPercent) / 100;

        // Invert the scroll effect
        let invert;
        if (mode === "page-jump") {
            invert = -1;
        } else {
            invert = 1;
            radius *= 0.9;
        }

        const center = scrollInfo.height / 2;
        const centerOffset = cursorVerticalPosition - center;

        let goal;
        let distance;
        if (
            centerOffset < -radius ||
            (mode === "page-jump" &&
                scrollDirection === -1 &&
                cursor.top < viewOffset + lineHeight * 2)
        ) {
            goal = currentVerticalPosition + centerOffset + radius * invert;
            distance = centerOffset + radius * invert;
        } else if (
            centerOffset > radius ||
            (mode === "page-jump" &&
                scrollDirection === 1 &&
                cursor.top > scrollInfo.height + viewOffset - lineHeight * 2)
        ) {
            goal = currentVerticalPosition + centerOffset - radius * invert;
            if (mode === "page-jump" && radiusPercent === 100) {
                goal -= editor.cm.defaultLineHeight;
            }
            distance = centerOffset - radius * invert;
        } else {
            return;
        }

        // Can't scroll by fractions.
        if (Math.abs(distance) < 1) return;

        window.cancelAnimationFrame(this.animationFrame);

        // Calculate scroll intensity to skip animation steps.
        if (dynamicAnimation && mode === "follow-cursor" && this.recentEdit) {
            this.calculateScrollIntensity();
        }

        let steps = Math.max(1, Math.ceil(2 * (smoothness / 100) * Math.sqrt(Math.abs(distance))));

        // If scrolling fast, reduce animation steps.
        if (mode === "follow-cursor" && this.scrollIntensity > this.intensityThreshold || Math.abs(distance) > scrollInfo.height) {
            steps = Math.ceil(Math.sqrt(steps));
        }

        const animate = (editor: Editor, dest: number, step_size: number, step: number) => {
            if (step <= 0) return;

            editor.scrollTo(null, dest - step_size * (step - 1));
            this.animationFrame = window.requestAnimationFrame(() =>
                animate(editor, dest, step_size, step - 1),
            );
        };

        animate(editor, goal, distance / steps, steps);
    }
}
