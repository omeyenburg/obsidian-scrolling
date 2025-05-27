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
    private animationFrame: number;

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

    private editHandler(editor: Editor): void {
        this.recentEdit = true; // Will be reset by cursorHandler
        this.invokeScroll(editor);
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

        // Also cancel if mouse up, unless this setting allows it.
        if (!this.plugin.settings.smartScrollEnableSelection && editor.somethingSelected())
            return;
        if (this.recentMouseUp && !this.plugin.settings.smartScrollEnableMouse) return;

        this.invokeScroll(editor);
    }

    private calculateScrollIntensity(): void {
        if (!this.plugin.settings.smartScrollDynamicAnimation) return;

        const decayRate = 0.02;
        const time = performance.now();
        const elapsed = time - this.scrollLast;

        this.scrollLast = time;
        this.scrollIntensity = Math.max(0, this.scrollIntensity - elapsed * decayRate) + 1;
    }

    private invokeScroll(editor: Editor): void {
        if (this.plugin.settings.smartScrollMode === "disabled") return;

        let centerRadius;
        let smoothness;
        if (this.recentEdit) {
            centerRadius = this.plugin.settings.smartScrollEditRadius;
            smoothness = this.plugin.settings.smartScrollEditSmoothness;
        } else {
            centerRadius = this.plugin.settings.smartScrollMoveRadius;
            smoothness = this.plugin.settings.smartScrollMoveSmoothness;
        }

        // Invert the scroll effect
        let invertCenteringScroll = 1;
        if (this.plugin.settings.smartScrollMode === "page-jump") {
            invertCenteringScroll = -1;
        }

        // If scrolling fast, skip animation steps
        // (Only if not scrolling inverted and scrolling without edit (otherwise run later))
        if (this.plugin.settings.smartScrollMode === "follow-cursor" && !this.recentEdit) {
            this.calculateScrollIntensity();
        }

        // Get cursor position (CodeMirror 6)
        const cursor_as_offset = editor.posToOffset(editor.getCursor());
        const cursor =
            (editor as any).cm.coordsAtPos?.(cursor_as_offset) ??
            (editor as any).coordsAtPos(cursor_as_offset);

        const viewOffset = editor.cm.scrollDOM.getBoundingClientRect().top;
        const cursorVerticalPosition = cursor.top + editor.cm.defaultLineHeight - viewOffset;

        const scrollInfo = editor.getScrollInfo() as { top: number; left: number; height: number };
        const currentVerticalPosition = scrollInfo.top;
        let centerZoneRadius = (scrollInfo.height / 2) * (centerRadius / 100);

        // Decrease center zone radius slightly to ensure that:
        // - cursor stays on the screen.
        // - we scroll before cursor gets to close to the edge and obsidian takes over scrolling.
        if (invertCenteringScroll === -1) {
            centerZoneRadius *= 0.95;
        }

        const center = scrollInfo.height / 2;
        const centerOffset = cursorVerticalPosition - center;

        let goal;
        let distance;
        if (centerOffset < -centerZoneRadius) {
            goal =
                currentVerticalPosition + centerOffset + centerZoneRadius * invertCenteringScroll;
            distance = centerOffset + centerZoneRadius * invertCenteringScroll;
        } else if (centerOffset > centerZoneRadius) {
            goal =
                currentVerticalPosition + centerOffset - centerZoneRadius * invertCenteringScroll;
            distance = centerOffset - centerZoneRadius * invertCenteringScroll;
        } else {
            return;
        }

        // Can't scroll by fractions, so return early.
        if (Math.abs(distance) < 1) return;

        // Calculate scroll intensity to skip animation steps.
        if (
            this.plugin.settings.smartScrollDynamicAnimation &&
            this.plugin.settings.smartScrollMode === "follow-cursor" &&
            this.recentEdit
        ) {
            this.calculateScrollIntensity();
        }

        cancelAnimationFrame(this.animationFrame);

        // let steps = Math.max(1, Math.round(2 + 4 * smoothness - this.scrollIntensity ** 0.5));
        let steps = Math.round(1 + smoothness / 5);

        // If scrolling fast, skip animation steps.
        if (this.plugin.settings.smartScrollMode === "follow-cursor" && this.scrollIntensity > 5) steps = 1;

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
