import { Editor, debounce } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

/**
 * Normalizes the delta values of the event.
 * Swaps the X and Y axis if the shift key is held and the delta dominates on the Y axis.
 */
function normalizeWheelDelta(event: WheelEvent) {
    let scale = 1;

    // Approximate line height as 16 pixels
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) scale = 16;
    else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) scale = window.innerHeight;

    if (event.shiftKey && Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
        return { deltaX: event.deltaY * scale, deltaY: 0 };
    }

    return { deltaX: event.deltaX * scale, deltaY: event.deltaY * scale };
}

export class CodeBlock {
    private readonly plugin: ScrollingPlugin;

    private codeBlockLines: Element[] = [];

    private scrollHandlerAnimationFrame: number | null = null;

    private lastScroller: Element | null = null;
    private lastScrollTop: number | null = null;
    private isScrollingVertically = false;

    private currentScrollLeft = 0;
    private currentScrollVelocity = 0;

    private currentScrollWidth: number | null = null;
    private scrollAnimationFrame: number | null = null;

    private readonly verticalWheelScrollDebouncer: (line: Element) => void;
    private readonly updateCursorPassive: () => void;

    private cachedCursor: HTMLElement | null = null;

    private readonly FRICTION_COFFICIENT = 0.8;

    private cachedBlockRect: DOMRect | null = null;
    private cachedSizerLeft: number | null = null;
    private cachedBlockWidthTimeStamp = 0;
    private cachedLineWidth = 0;
    private cachedLineCharCount = 0;
    private CACHED_BLOCK_WIDTH_TIMEOUT = 500;

    private lastHorizontalScrollTimeStamp = 0;
    private readonly CODE_BLOCK_WIDTH_TIMEOUT = 200;

    /**
     * Large constant used to artificially extend line length so that
     * each code line does not limit horizontal scrolling individually.
     * This allows the plugin to handle the scroll boundary uniformly across
     * all code lines in a block instead of relying on their individual widths.
     */
    private readonly EXTRA_LINE_LENGTH = 1_000_000;
    private readonly EXTRA_LINE_LENGTH_WITH_PADDING = 1_000_000 + 15;

    private readonly SCROLL_FACTOR = 0.4;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        this.verticalWheelScrollDebouncer = debounce(
            this.verticalWheelScroll.bind(this),
            50,
            false,
        );

        this.updateCursorPassive = debounce(
            this._dispatchedUpdateCursorPassive.bind(this),
            5,
            false,
        );

        document.body.style.setProperty(
            "--scrolling-extra-line-length",
            `${this.EXTRA_LINE_LENGTH_WITH_PADDING}px`,
        );

        this.updateStyle();

        plugin.register(() => {
            window.cancelAnimationFrame(this.scrollAnimationFrame);
            document.body.removeClass("scrolling-horizontal-code-blocks");
        });
    }

    /**
     * Update wrapping of code blocks when toggling this feature.
     * Called on plugin load and change of settings.
     */
    public updateStyle(): void {
        if (this.plugin.settings.horizontalScrollingCodeBlockEnabled) {
            document.body.addClass("scrolling-horizontal-code-blocks");
        } else {
            document.body.removeClass("scrolling-horizontal-code-blocks");
        }
    }

    /*
     * On scroll.
     * Checks if vertical scroll occurred.
     */
    public scrollHandler(event: Event): void {
        if (this.isScrollingVertically || this.scrollHandlerAnimationFrame !== null) return;

        this.scrollHandlerAnimationFrame = window.setTimeout(() => {
            this.scrollHandlerAnimationFrame = null;
            const editor = this.plugin.app.workspace.activeEditor?.editor;
            editor.cm.requestMeasure({
                key: "code-scroll-handler",
                read: (_view) => {
                    const target = event.target as Element;
                    const newScrollTop = target.scrollTop;

                    if (this.lastScroller !== target) {
                        this.lastScroller = target;
                        return;
                    }

                    if (this.lastScrollTop === null) {
                        this.lastScrollTop = newScrollTop;
                        return;
                    }

                    if (this.lastScrollTop !== newScrollTop) {
                        this.isScrollingVertically = true;
                        this.lastScrollTop = newScrollTop;
                    }
                },
            });
        }, 50);
    }

    /**
     * On scroll end. Per axis.
     * Marks end of vertical scroll.
     */
    public scrollEndHandler(): void {
        this.isScrollingVertically = false;
        window.clearTimeout(this.scrollHandlerAnimationFrame);
        this.scrollHandlerAnimationFrame = null;
    }

    /**
     * On leaf change.
     * Resets cached values.
     */
    public leafChangeHandler(): void {
        this.cachedCursor = null;
        this.currentScrollWidth = null;

        this.currentScrollLeft = 0;

        this.lastScrollTop = null;
        this.isScrollingVertically = false;

        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor || !this.plugin.settings.horizontalScrollingCodeBlockEnabled) return;

        const lineEl = editor.cm.contentDOM.querySelector(".cm-line.cm-active");
        if (!lineEl) return;

        this.updateWidthAndBlock(lineEl);
        this.updateCursorPassive();
    }

    /**
     * On wheel event. *Desktop only*.
     * Scrolls multiple connected code lines simultanously.
     * Returns true if the wheel event is handled successfully.
     */
    public wheelHandler(event: WheelEvent): boolean {
        // Fast exit for non-code blocks
        if (!this.plugin.settings.horizontalScrollingCodeBlockEnabled) return false;

        let line = event.target as Element;

        // Support scrolling on indent & collapse indicator
        if (line.localName === "path") {
            line = line.parentElement.parentElement;
        } else if (line.localName === "svg") {
            line = line.parentElement;
        }
        if (line.classList.contains("collapse-indicator")) {
            line = line.parentElement.parentElement.parentElement;
        } else if (line.classList.contains("cm-indent")) {
            line = line.parentElement.parentElement;
        } else if (line.classList.contains("cm-hmd-codeblock")) {
            line = line.parentElement;
        }

        if (!line.classList.contains("HyperMD-codeblock")) return false;
        if (
            line.classList.contains("HyperMD-codeblock-begin") ||
            line.classList.contains("HyperMD-codeblock-end")
        )
            return false;

        let { deltaX, deltaY } = normalizeWheelDelta(event);
        const isHorizontalScroll = Math.abs(deltaX) >= Math.abs(deltaY);

        if (isHorizontalScroll && !this.isScrollingVertically) {
            this.horizontalWheelScroll(deltaX, line, event.timeStamp);
            return true;
        }

        this.verticalWheelScrollDebouncer(line);
        return false;
    }

    /**
     * On touch move event. *Mobile only*.
     * Scrolls multiple connected code lines simultanously.
     * Assumes that code elements do not handle horizontal scroll natively (css).
     */
    public touchHandler(event: TouchEvent, deltaX: number, deltaY: number): void {
        // Fast exit for non-code blocks
        if (!this.plugin.settings.horizontalScrollingCodeBlockEnabled) return;

        let line = event.target as Element;
        if (line.classList.contains("cm-indent")) {
            line = line.parentElement.parentElement;
        } else if (line.classList.contains("cm-hmd-codeblock")) {
            line = line.parentElement;
        }

        if (!line.classList.contains("HyperMD-codeblock")) return;
        if (
            line.classList.contains("HyperMD-codeblock-begin") ||
            line.classList.contains("HyperMD-codeblock-end")
        )
            return;

        const isHorizontalScroll = Math.abs(deltaX) >= Math.abs(deltaY);

        if (isHorizontalScroll && !this.isScrollingVertically) {
            this.horizontalWheelScroll(deltaX, line, event.timeStamp);

            // Stop Obsidian from expanding the side panels
            event.stopPropagation();
        } else {
            this.verticalWheelScrollDebouncer(line);
        }
    }

    /**
     * On view update (document edit, text cursor movement).
     * Updates code blocks and code block length.
     * Scrolls to keep cursor in view.
     */
    public viewUpdateHandler(editor: Editor, isEdit: boolean): void {
        if (!this.plugin.settings.horizontalScrollingCodeBlockEnabled) return;

        const cursorEl = this.getCursorEl(editor);

        const lineEl = editor.cm.contentDOM.querySelector(".cm-line.cm-active");
        if (!lineEl?.classList?.contains("HyperMD-codeblock")) {
            this.codeBlockLines = [];
            return;
        }

        if (!this.codeBlockLines.contains(lineEl) || isEdit) {
            this.updateWidthAndBlock(lineEl);
            this.currentScrollLeft = Math.min(this.currentScrollLeft, this.currentScrollWidth);
        }

        const pos = editor.cm.state.selection.main.head;
        const line = editor.cm.state.doc.lineAt(pos);
        const col = pos - line.from;

        const charWidth = editor.cm.defaultCharacterWidth;

        // Cache bounding rect widths
        const now = performance.now();
        if (now - this.cachedBlockWidthTimeStamp > this.CACHED_BLOCK_WIDTH_TIMEOUT) {
            this.cachedBlockWidthTimeStamp = now;
            this.cachedBlockRect = lineEl.getBoundingClientRect();

            this.cachedLineWidth = 0;
            for (let i = 0; i < lineEl.children.length; i++) {
                this.cachedLineWidth += lineEl.children[i].getBoundingClientRect().width;
            }

            this.cachedLineCharCount = line.length;
            this.cachedSizerLeft = editor.cm.contentDOM.parentElement.getBoundingClientRect().left;
        } else {
            this.cachedLineWidth += charWidth * (line.length - this.cachedLineCharCount);
            this.cachedLineCharCount = line.length;
        }

        const cursorScroll = line.length ? this.cachedLineWidth * (col / line.length) : 0;

        this.currentScrollLeft = Math.min(
            cursorScroll,
            Math.max(
                cursorScroll - this.cachedBlockRect.width + charWidth * (cursorEl ? 5 : 4),
                this.currentScrollLeft,
            ),
        );

        // Cursor is now in view
        if (cursorEl && cursorEl.style.display !== "block") {
            cursorEl.style.display = "block";
        }

        this.updateHorizontalScroll();

        // Tell CodeMirror to update cursor
        // Timeout fixes bug that causes duplicating text on mobile.
        if (this.cachedCursor !== null) {
            this.plugin.followScroll.skipCursor = true;
            editor.cm.dispatch({ selection: editor.cm.state.selection });
        }
    }

    /**
     * Returns the cached cursor element of the Vim cursor.
     */
    private getCursorEl(editor: Editor): HTMLElement | null {
        if (this.cachedCursor && this.cachedCursor.isConnected) {
            return this.cachedCursor;
        }

        const cursorLayerList = editor.cm.scrollDOM.getElementsByClassName("cm-vimCursorLayer");
        if (cursorLayerList.length < 1) {
            this.cachedCursor = null;
            return null;
        }

        const cursorList = cursorLayerList[0].getElementsByClassName("cm-cursor-primary");
        if (cursorList.length < 1) {
            this.cachedCursor = null;
            return null;
        }

        this.cachedCursor = cursorList[0] as HTMLElement;
        return this.cachedCursor;
    }

    /**
     * Updates newly loaded code block lines when scrolling vertically.
     * (Code mirror adds and removes lines on the fly)
     */
    private verticalWheelScroll(line: Element): void {
        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor) return;

        editor.cm.requestMeasure({
            key: "vertical-wheel-scroll",
            read: () => {
                this.updateWidthAndBlock(line);
            },
            write: (_measure, _view) => {
                this.updateHorizontalScroll();
            },
        });
    }

    /**
     * Collects all code lines around the specified line.
     * Updates the scrollable width of the code block in pixels based on the longest code line.
     */
    private updateWidthAndBlock(line: Element): void {
        const width = this.searchCodeLines(line) - this.EXTRA_LINE_LENGTH - line.clientWidth;
        this.currentScrollWidth = Math.max(0, width);
    }

    /**
     * Initiates horizontal scroll animation.
     * Also updates the current code block once.
     */
    private horizontalWheelScroll(deltaX: number, line: Element, now: number): void {
        if (!this.codeBlockLines.contains(line) || this.currentScrollWidth === null) {
            this.updateWidthAndBlock(line);
            this.lastHorizontalScrollTimeStamp = now;
        } else if (now - this.lastHorizontalScrollTimeStamp > this.CODE_BLOCK_WIDTH_TIMEOUT) {
            this.updateWidthAndBlock(line);
            this.lastHorizontalScrollTimeStamp = now;
        } else {
            // Remove dead lines
            this.codeBlockLines.filter((e) => e.isConnected);
        }

        this.currentScrollVelocity = deltaX * this.SCROLL_FACTOR;

        // Restore previous position
        this.currentScrollLeft = this.codeBlockLines[0].scrollLeft;

        window.cancelAnimationFrame(this.scrollAnimationFrame);
        if (!this.currentScrollWidth) return;

        this.animateScroll();
    }

    /**
     * Scrolls horizontally over multiple animation frames.
     * Updates cursor, as it moves in/out of the viewport.
     */
    private animateScroll(): void {
        this.currentScrollLeft += this.currentScrollVelocity;

        if (this.currentScrollLeft < 0) {
            this.currentScrollVelocity = 0;
            this.currentScrollLeft = 0;
        } else if (this.currentScrollLeft > this.currentScrollWidth) {
            this.currentScrollLeft = this.currentScrollWidth;
            this.currentScrollVelocity = 0;
        } else if (Math.abs(this.currentScrollVelocity) > 0.2) {
            this.currentScrollVelocity *= this.FRICTION_COFFICIENT;
            this.scrollAnimationFrame = window.requestAnimationFrame(() => this.animateScroll());
        } else {
            this.scrollAnimationFrame = 0;
        }

        this.updateHorizontalScroll();

        // Cursor must be updated, otherwise it would not move at all while scrolling.
        this.updateCursorPassive();
    }

    /**
     * Updates cursor on screen without triggering a scroll in code mirror.
     * Hides Vim's fat cursor, if it is scrolled to the left or right of the viewport.
     */
    private _dispatchedUpdateCursorPassive(): void {
        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor || !this.codeBlockLines.length) return;

        // Cursor must be updated, otherwise it would not move at all while scrolling
        // Timeout fixes bug that causes duplicating text on mobile.
        if (this.cachedCursor !== null) {
            this.plugin.followScroll.skipCursor = true;
            editor.cm.dispatch({
                selection: editor.cm.state.selection,
                effects: [], // Do not update viewport
            });
        }

        // This is only necessary with block cursor in vim mode. .cm-cursor-primary will select that.
        const cursorEl = this.getCursorEl(editor);
        if (!cursorEl) return;
        if (!(cursorEl instanceof HTMLElement)) return;

        if (this.cachedBlockRect === null) {
            this.cachedBlockRect = this.codeBlockLines[0].getBoundingClientRect();
        }

        if (this.cachedSizerLeft === null) {
            this.cachedSizerLeft = editor.cm.contentDOM.parentElement.getBoundingClientRect().left;
        }

        const off = this.cachedBlockRect.left - this.cachedSizerLeft;
        const cursorLeft = Number.parseFloat(cursorEl.style.left) + off;

        const isVisible =
            cursorLeft >= this.cachedBlockRect.left &&
            cursorLeft + editor.cm.defaultCharacterWidth * 0.5 <= this.cachedBlockRect.right;

        const display = isVisible ? "block" : "none";
        if (cursorEl.style.display === display) return;
        cursorEl.style.display = display;
    }

    /**
     * Applies current horizontal scroll position to all currently cached code lines.
     * Assumes that codeBlockLines is correct.
     */
    private updateHorizontalScroll(): void {
        this.codeBlockLines.forEach((el: Element) => {
            el.scrollLeft = this.currentScrollLeft;
        });
    }

    /**
     * Searches for code lines around line.
     * Returns the maximum length of all lines.
     */
    private searchCodeLines(line: Element): number {
        if (this.insideCodeBlock(line.classList)) {
            this.codeBlockLines = [line];
        } else {
            this.codeBlockLines = [];
        }

        let maxScrollWidthWithExtension = line.scrollWidth;

        let next = line.nextElementSibling;
        let prev = line.previousElementSibling;

        while (next && this.insideCodeBlock(next.classList)) {
            this.codeBlockLines.push(next);
            if (next.scrollWidth > maxScrollWidthWithExtension) {
                maxScrollWidthWithExtension = next.scrollWidth;
            }
            next = next.nextElementSibling;
        }

        while (prev && this.insideCodeBlock(prev.classList)) {
            this.codeBlockLines.push(prev);
            if (prev.scrollWidth > maxScrollWidthWithExtension) {
                maxScrollWidthWithExtension = prev.scrollWidth;
            }
            prev = prev.previousElementSibling;
        }

        return maxScrollWidthWithExtension;
    }

    /**
     * Returns true, if the class list indicates,
     * that the related element is a scrollable code line.
     */
    private insideCodeBlock(classes: DOMTokenList): boolean {
        let isCode = false;
        for (let i = 0; i < classes.length; i++) {
            const c = classes[i];
            if (c === "HyperMD-codeblock") {
                isCode = true;
            }
            if (c === "HyperMD-codeblock-begin" || c === "HyperMD-codeblock-end") {
                return false;
            }
        }

        return isCode;
    }
}
