import { Editor } from "obsidian";

/**
 * Clamps a numeric value between a minimum and maximum bound.
 * 
 * This utility ensures a value stays within specified bounds, which is useful for:
 * - Scroll position calculations
 * - Zoom level constraints
 * - Animation value normalization
 * 
 * @param val - The value to clamp
 * @param min - The minimum allowed value (inclusive)
 * @param max - The maximum allowed value (inclusive)
 * @returns The clamped value, guaranteed to be between min and max
 * 
 * @example
 * clamp(10, 0, 5);  // returns 5
 * clamp(-10, 0, 5); // returns 0
 * clamp(3, 0, 5);   // returns 3
 */
export function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

/**
 * Retrieves the Vim cursor element from the CodeMirror editor.
 * 
 * This function is specifically designed for Vim mode integration in Obsidian.
 * It navigates the DOM structure to find the primary cursor element when Vim mode
 * is active. The Vim cursor is styled differently than the standard cursor and
 * requires special handling in certain scrolling scenarios.
 * 
 * @param editor - The Obsidian Editor instance containing the CodeMirror instance
 * @returns The HTMLElement representing the Vim cursor, or null if:
 *          - Vim mode is not active
 *          - The cursor layer is not found
 *          - The primary cursor element is not found
 * 
 * @remarks
 * This is useful for components that need to handle Vim cursor positioning during
 * scroll operations, particularly in the follow cursor and code block features.
 */
export function getVimCursor(editor: Editor): HTMLElement | null {
    const cursorLayerList = editor.cm.scrollDOM.getElementsByClassName("cm-vimCursorLayer");
    if (cursorLayerList.length < 1) {
        return null;
    }

    const cursorList = cursorLayerList[0].getElementsByClassName("cm-cursor-primary");
    if (cursorList.length < 1) {
        return null;
    }
    return cursorList[0] as HTMLElement;
}

/**
 * Linearly interpolates between two values.
 * 
 * This utility performs linear interpolation (lerp), which is commonly used in:
 * - Smooth scrolling animations
 * - Easing functions
 * - Gradual value transitions
 * 
 * @param start - The starting value
 * @param end - The ending value
 * @param t - The interpolation factor, typically between 0 and 1
 *            - 0 returns start
 *            - 1 returns end
 *            - 0.5 returns the midpoint
 *            - Values outside [0, 1] result in extrapolation
 * @returns The interpolated value
 * 
 * @example
 * lerp(0, 100, 0.5);   // returns 50
 * lerp(10, 20, 0.25);  // returns 12.5
 * lerp(0, 100, 0);     // returns 0
 * lerp(0, 100, 1);     // returns 100
 */
export function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}
