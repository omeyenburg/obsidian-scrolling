import { Editor } from "obsidian";

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

    private readonly INTENSITY_DECAY_RATE = 0.01;
    private readonly INTENSITY_THRESHOLD = 3;
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
     * Calculates goal position, distance and scroll steps for scroll animation.
     * Initiates scroll animation if centering scroll is required.
     */
    private invokeScroll(editor: Editor, isEdit: boolean): void {
        if (!this.plugin.settings.followCursorEnabled) return;

        const dynamicAnimation = this.plugin.settings.followCursorDynamicAnimation;

        // If scrolling fast, skip animation steps
        // (Only if not scrolling inverted and scrolling without edit (otherwise run later))
        if (!isEdit && dynamicAnimation) {
            this.calculateScrollIntensity();
        } else {
            this.scrollIntensity = 0;
        }

        // Get cursor position from active line
        const cursorEl = editor.cm.scrollDOM.querySelector(".cm-active.cm-line");
        if (!cursorEl) return;

        const cursor = cursorEl.getBoundingClientRect();
        const lineHeight = editor.cm.defaultLineHeight;
        const viewOffset = editor.cm.scrollDOM.getBoundingClientRect().top;

        const cursorVerticalPosition = cursor.top + lineHeight - viewOffset;
        const scrollInfo = editor.getScrollInfo() as ScrollInfo;

        const signedGoalDistance = this.calculateGoalDistance(cursorVerticalPosition, scrollInfo);
        if (signedGoalDistance === 0) return;

        const goal = scrollInfo.top + signedGoalDistance;
        const steps = this.calculateSteps(signedGoalDistance, scrollInfo.height, isEdit);

        window.cancelAnimationFrame(this.animationFrame);
        this.animate(editor, goal, signedGoalDistance / steps, steps);
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
     * Measures intensity of events triggering centering scroll.
     */
    private calculateScrollIntensity(): void {
        const time = performance.now();
        const elapsed = time - this.scrollLastEvent;

        this.scrollLastEvent = time;
        this.scrollIntensity =
            Math.max(0, this.scrollIntensity - elapsed * this.INTENSITY_DECAY_RATE) + 1;
    }

    private calculateGoalDistance(cursorVerticalPosition: number, scrollInfo: ScrollInfo) {
        const radiusPercent = this.plugin.settings.followCursorRadius;

        let radius = ((scrollInfo.height / 2) * radiusPercent) / 100;

        const center = scrollInfo.height / 2;
        const centerOffset = cursorVerticalPosition - center;

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
    private calculateSteps(
        signedGoalDistance: number,
        scrollerHeight: number,
        isEdit: boolean,
    ): number {
        if (isEdit && this.plugin.settings.followCursorInstantEditScroll) return 1;

        const smoothness = this.plugin.settings.followCursorSmoothness;
        const dynamicAnimation = this.plugin.settings.followCursorDynamicAnimation;

        let steps = Math.max(
            1,
            Math.ceil(2 * (smoothness / 100) * Math.sqrt(Math.abs(signedGoalDistance))),
        );

        // Calculate scroll intensity to skip animation steps.
        if (dynamicAnimation && isEdit) {
            this.calculateScrollIntensity();
        }

        // If scrolling fast, reduce animation steps.
        if (
            this.scrollIntensity > this.INTENSITY_THRESHOLD ||
            Math.abs(signedGoalDistance) > scrollerHeight
        ) {
            steps = Math.ceil(Math.sqrt(steps));
        }

        return steps;
    }
}
