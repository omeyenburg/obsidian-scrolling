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

    private readonly intesityDecayRate = 0.01;
    private readonly intensityThreshold = 3;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        plugin.registerEvent(plugin.app.workspace.on("editor-change", this.editHandler.bind(this)));

        plugin.registerDomEvent(document, "mouseup", this.mouseUpHandler.bind(this));
        plugin.registerDomEvent(document, "keydown", this.keyHandler.bind(this));

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
        setTimeout(() => {
            this.recentMouseUp = false;
        }, 100);
    }

    private getScrollDirection(editor: Editor): -1 | 0 | 1 {
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
        // This checks if this update was caused by a mouse down event,
        // but can't detect mouse up.
        let mouseDown = false;
        for (const tr of update.transactions) {
            const event = tr.annotation(Transaction.userEvent);
            if (event === "select.pointer") {
                mouseDown = true;
            }
        }

        // Reset recentEdit, which was set by editHandler
        if (this.recentEdit) {
            this.recentEdit = false;
            return;
        }

        // Only proceed if its a cursor event
        if (!update.selectionSet) return;

        // Always cancel if event was caused by mouse down/movement.
        if (mouseDown) return;

        // Get the editor
        const editor = this.plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
        if (!editor) return;

        const scrollDirection = this.getScrollDirection(editor);

        // Also cancel if mouse up, unless this setting allows it.
        if (!this.plugin.settings.smartScrollEnableSelection && editor.somethingSelected()) return;
        if (this.recentMouseUp && !this.plugin.settings.smartScrollEnableMouse) return;

        this.invokeScroll(editor, scrollDirection);
    }

    private calculateScrollIntensity(): void {
        if (!this.plugin.settings.smartScrollDynamicAnimation) return;

        const time = performance.now();
        const elapsed = time - this.scrollLast;

        this.scrollLast = time;
        this.scrollIntensity =
            Math.max(0, this.scrollIntensity - elapsed * this.intesityDecayRate) + 1;
    }

    private invokeScroll(editor: Editor, scrollDirection: number): void {
        const mode = this.plugin.settings.smartScrollMode;
        if (mode === "disabled") return;

        let radiusPercent;
        let smoothness;
        if (this.recentEdit) {
            radiusPercent = this.plugin.settings.smartScrollEditRadius;
            smoothness = this.plugin.settings.smartScrollEditSmoothness;
        } else {
            radiusPercent = this.plugin.settings.smartScrollMoveRadius;
            smoothness = this.plugin.settings.smartScrollMoveSmoothness;
        }

        const dynamicAnimation = this.plugin.settings.smartScrollDynamicAnimation;

        // If scrolling fast, skip animation steps
        // (Only if not scrolling inverted and scrolling without edit (otherwise run later))
        if (mode === "follow-cursor" && !this.recentEdit) {
            this.calculateScrollIntensity();
        }

        // Get cursor position (CodeMirror 6)
        const cursor_as_offset = editor.posToOffset(editor.getCursor());
        const cursor =
            (editor as any).cm.coordsAtPos?.(cursor_as_offset) ??
            (editor as any).coordsAtPos(cursor_as_offset);

        const lineHeight = (editor as any).cm.defaultLineHeight;

        const viewOffset = editor.cm.scrollDOM.getBoundingClientRect().top;
        const cursorVerticalPosition = cursor.top + lineHeight - viewOffset;

        const scrollInfo = editor.getScrollInfo() as { top: number; left: number; height: number };
        const currentVerticalPosition = scrollInfo.top;
        let radius = ((scrollInfo.height / 2) * radiusPercent) / 100;

        // Invert the scroll effect
        let invert = mode === "page-jump" ? -1 : 1;

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

        // Can't scroll by fractions, so return early.
        if (Math.abs(distance) < 1) return;

        cancelAnimationFrame(this.animationFrame);

        // Calculate scroll intensity to skip animation steps.
        if (dynamicAnimation && mode === "follow-cursor" && this.recentEdit) {
            this.calculateScrollIntensity();
        }

        let steps = Math.round(1 + smoothness / 5);

        // If scrolling fast, skip animation steps.
        if (mode === "follow-cursor" && this.scrollIntensity > this.intensityThreshold) steps = 1;

        const animate = (editor: Editor, dest: number, step_size: number, step: number) => {
            if (!step) return;

            editor.scrollTo(null, dest - step_size * (step - 1));
            this.animationFrame = requestAnimationFrame(() =>
                animate(editor, dest, step_size, step - 1),
            );
        };

        animate(editor, goal, distance / steps, steps);
    }
}
