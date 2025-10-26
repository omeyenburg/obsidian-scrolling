import { Editor, MarkdownView, Platform } from "obsidian";
import { syntaxTree } from "@codemirror/language";

import type { default as ScrollingPlugin } from "@core/main";
import { getVimCursor } from "@core/util";

interface ScrollInfo {
    top: number;
    left: number;
    height: number;
}

export class FollowCursor {
    private readonly plugin: ScrollingPlugin;

    private recentMouseUp = false;

    private animationFrame = 0;
    private scrollLastEvent = 0;

    private cachedEditorOffset: number | null = null;

    private readonly MOUSE_UP_TIMEOUT = 100;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        plugin.register(() => {
            window.cancelAnimationFrame(this.animationFrame);
        });
    }

    /**
     * On key down event.
     * Resets mouse up indicator early.
     */
    public keyDownHandler(): void {
        this.recentMouseUp = false;
    }

    /**
     * On mouse up event.
     * Blocks scroll trigger unless mouse invocation is enabled through settings.
     */
    public mouseUpHandler(): void {
        this.recentMouseUp = true;

        // recentMouseUp will be reset either when a key is pressed or 100 ms pass.
        // This timeout is needed, because the keydown event is not reliable:
        // In normal mode of vim, keydown events are pretty much inaccessible.
        window.setTimeout(() => (this.recentMouseUp = false), this.MOUSE_UP_TIMEOUT);
    }

    /**
     * On view update (document edit, text cursor movement)
     * Invokes scroll animation.
     */
    public viewUpdateHandler(editor: Editor, isEdit: boolean): void {
        // Cancel if mouse up, unless this setting allows it.
        if (this.recentMouseUp && !this.plugin.settings.followCursorEnableMouse) return;

        // Cancel if selecting, unless this setting allows it.
        if (!this.plugin.settings.followCursorEnableSelection && editor.somethingSelected()) return;

        this.invokeScroll(editor, isEdit);
    }

    /**
     * Checks whether the cursor is inside a table.
     * Uses the syntax tree provided by codemirror.
     * Requires codemirror/language.
     */
    private cursorInTable(editor: Editor): boolean {
        const { from } = editor.cm.state.selection.main;
        const tree = syntaxTree(editor.cm.state as any);
        let node = tree.resolve(from, -1);

        while (node) {
            if (node.name.startsWith("HyperMD-table")) {
                return true;
            }

            node = node.parent;
        }

        return false;
    }

    /**
     * Calculates goal position, distance and scroll steps for scroll animation.
     * Initiates scroll animation if centering scroll is required.
     */
    private invokeScroll(editor: Editor, isEdit: boolean): void {
        if (!this.plugin.settings.followCursorEnabled) return;

        // Disable in reading view, as this might break cached values.
        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView)
        if (!view) return;

        const now = performance.now();
        const deltaTime = now - this.scrollLastEvent;
        this.scrollLastEvent = now;

        if (deltaTime < 10) return;

        const activeLineEl = editor.cm.scrollDOM.querySelector(".cm-active.cm-line");
        if (!activeLineEl) return;

        let cursorRelativeTop: number;
        const isTable = this.cursorInTable(editor);

        const scrollDOMRect = editor.cm.scrollDOM.getBoundingClientRect();

        if (isTable) {
            // Works well with tables
            const activeLineRect = activeLineEl.getBoundingClientRect();
            cursorRelativeTop = activeLineRect.top;
        } else {
            // Works well with wrapped lines and images
            const cursorCoord = editor.getCursor("head");
            const lineStartOffset = editor.cm.state.doc.line(cursorCoord.line + 1).from;
            const cursorOffset = lineStartOffset + cursorCoord.ch;

            const cursorCoords = editor.cm.coordsAtPos(cursorOffset);
            cursorRelativeTop = cursorCoords?.top || 0;
        }

        // Vertical offset of editor viewport should never change.
        if (!this.cachedEditorOffset) {
            this.cachedEditorOffset = scrollDOMRect.top - editor.cm.defaultLineHeight;
        }
        cursorRelativeTop -= this.cachedEditorOffset;

        const scrollInfo = editor.getScrollInfo() as ScrollInfo;
        const signedGoalDistance = this.calculateGoalDistance(cursorRelativeTop, scrollInfo);
        if (signedGoalDistance === 0) return;

        const goal = scrollInfo.top + signedGoalDistance;

        // Only cancel animation frame if one is currently running
        if (this.animationFrame) {
            window.cancelAnimationFrame(this.animationFrame);
        }

        // In tables, many events are emmitted, so skip animations for better performance.
        if (deltaTime > 100 && !isTable) {
            const steps = this.calculateSteps(
                Math.abs(signedGoalDistance),
                scrollInfo.height,
                isEdit,
            );

            if (steps > 1 || !Platform.isMobile || getVimCursor(editor) === null) {
                this.animate(editor, goal, signedGoalDistance / steps, steps);
                return;
            }
        }

        // Performant fallback used for:
        // - Many events (within 100ms)
        // - Cursor inside a table, because Obsidian emits duplicate view updates
        // - Single step on mobile in Vim normal mode (Issue #11)
        editor.cm.requestMeasure({
            key: "followcursor",
            read: () => {},
            write: () => {
                this.animate(editor, goal, signedGoalDistance, 1);
            },
        });
    }

    /**
     * Scrolls to the goal over a specified number of frames.
     */
    private animate(editor: Editor, goal: number, stepSize: number, step: number): void {
        if (step <= 0) return;

        editor.scrollTo(null, goal - stepSize * (step - 1));
        this.animationFrame = window.requestAnimationFrame(() =>
            this.animate(editor, goal, stepSize, step - 1),
        );
    }

    /**
     * Returns the signed distance to the goal position relative on the screen
     * based on the current cursor position and a valid radius from the center.
     */
    private calculateGoalDistance(cursorRelativeTop: number, scrollInfo: ScrollInfo) {
        const radiusPercent = this.plugin.settings.followCursorRadius;

        let radius = ((scrollInfo.height / 2) * radiusPercent) / 100;

        const center = scrollInfo.height / 2;
        const centerOffset = cursorRelativeTop - center;

        let signedGoalDistance: number;
        if (centerOffset < -radius) {
            signedGoalDistance = centerOffset + radius;
        } else if (centerOffset > radius) {
            signedGoalDistance = centerOffset - radius;
        } else {
            return 0;
        }

        // Can't scroll by fractions.
        if (Math.abs(signedGoalDistance) < 1) return 0;

        return signedGoalDistance;
    }

    /**
     * Returns number of frames for scroll animation.
     * Returns reduced number of frames when scrolling further than client height.
     * Returns 1 step for instant scroll on edit.
     */
    private calculateSteps(goalDistance: number, scrollerHeight: number, isEdit: boolean): number {
        if (isEdit && this.plugin.settings.followCursorInstantEditScroll) return 1;

        const smoothness = this.plugin.settings.followCursorSmoothness;
        let steps = Math.max(1, Math.ceil(0.16 * smoothness));

        if (goalDistance > scrollerHeight) {
            return Math.ceil(Math.sqrt(steps));
        }

        return steps;
    }
}
