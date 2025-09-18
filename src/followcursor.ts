import { Notice, Editor, MarkdownView } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

interface ScrollInfo {
    top: number;
    left: number;
    height: number;
}

export class FollowCursor {
    private readonly plugin: ScrollingPlugin;

    private recentMouseUp = false;

    private animationFrame = 0;
    private scrollIntensity = 0;
    private scrollLastEvent = 0;

    private cachedViewOffset: number | null = null;

    private readonly INTENSITY_THRESHOLD = 3;
    private readonly MOUSE_UP_TIMEOUT = 100;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        plugin.register(() => {
            window.cancelAnimationFrame(this.animationFrame);
        });

        plugin.addCommand({
            id: "show-cursor-wrap-index",
            name: "Show cursor wrap index",
            callback: () => {
                const editor = plugin.app.workspace.getActiveViewOfType(MarkdownView).editor;
                if (!editor) return;

                const cm = editor.cm;
                const cursor = editor.getCursor("head");

                // CM6 offset of line start
            },
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
     * Returns the relative vertical position of the line where the cursor is.
     */
    private getActiveLineRelativeTop(editor: Editor) {
        const activeLineEl = editor.cm.scrollDOM.querySelector(".cm-active.cm-line");
        if (!activeLineEl) return;

        const cursor = activeLineEl.getBoundingClientRect();
        const lineHeight = editor.cm.defaultLineHeight;

        if (this.cachedViewOffset === null) {
            this.cachedViewOffset = editor.cm.scrollDOM.getBoundingClientRect().top;
        }

        return cursor.top + lineHeight - this.cachedViewOffset;
    }

    /**
     * Returns the wrapping induced vertical offset of the cursor relative to the start of the line.
     */
    private getCursorWrapOffset(editor: Editor) {
        const cursorCoord = editor.getCursor("head");
        const lineStartOffset = editor.cm.state.doc.line(cursorCoord.line + 1).from;
        const cursorOffset = lineStartOffset + cursorCoord.ch;

        const lineStartCoords = editor.cm.coordsAtPos(lineStartOffset);
        const cursorCoords = editor.cm.coordsAtPos(cursorOffset);

        if (!lineStartCoords || !cursorCoords) return 0;
        return cursorCoords.top - lineStartCoords.top;
    }

    /**
     * Calculates goal position, distance and scroll steps for scroll animation.
     * Initiates scroll animation if centering scroll is required.
     */
    private invokeScroll(editor: Editor, isEdit: boolean): void {
        if (!this.plugin.settings.followCursorEnabled) return;

        const activeLineRelativeTop = this.getActiveLineRelativeTop(editor);
        const cursorWrapOffset = this.getCursorWrapOffset(editor);

        const cursorRelativeTop = activeLineRelativeTop + cursorWrapOffset;

        const scrollInfo = editor.getScrollInfo() as ScrollInfo;
        const signedGoalDistance = this.calculateGoalDistance(cursorRelativeTop, scrollInfo);
        if (signedGoalDistance === 0) return;

        const goal = scrollInfo.top + signedGoalDistance;

        window.cancelAnimationFrame(this.animationFrame);

        const now = performance.now();
        const deltaTime = now - this.scrollLastEvent;
        this.scrollLastEvent = now;
        if (deltaTime > 100) {
            const steps = this.calculateSteps(
                Math.abs(signedGoalDistance),
                scrollInfo.height,
                isEdit,
            );
            this.animate(editor, goal, signedGoalDistance / steps, steps);
        } else {
            editor.cm.requestMeasure({
                key: "followcursor",
                read: () => {},
                write: () => {
                    this.animate(editor, goal, signedGoalDistance, 1);
                },
            });
        }
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
     * Returns 1 step for instant scroll on edit.
     */
    private calculateSteps(goalDistance: number, scrollerHeight: number, isEdit: boolean): number {
        if (isEdit && this.plugin.settings.followCursorInstantEditScroll) return 1;

        const smoothness = this.plugin.settings.followCursorSmoothness;
        let steps = Math.max(1, Math.ceil(0.02 * smoothness * Math.sqrt(goalDistance)));

        if (goalDistance > scrollerHeight * 0.5) {
            if (goalDistance > scrollerHeight) {
                return 1;
            }

            return Math.ceil(Math.sqrt(steps));
        }

        return steps;
    }
}
