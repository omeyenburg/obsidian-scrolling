import { Editor, MarkdownView, WorkspaceLeaf, debounce } from "obsidian";
import { Line } from "@codemirror/state";

import type { default as ScrollingPlugin } from "@core/main";
import { getVimCursor } from "@core/util";

export class CodeBlock {
    private readonly plugin: ScrollingPlugin;

    private codeBlockLines: Element[] = [];

    private scrollHandlerAnimationFrame: number | null = null;

    private lastScroller: Element | null = null;
    private lastScrollTop: number | null = null;
    private lastScrollerClientHeight = 0;
    private isScrollingVertically = false;

    private currentScrollLeft = 0;
    private currentScrollVelocity = 0;

    private currentScrollWidth: number | null = null;
    private scrollAnimationFrame = 0;

    private readonly verticalWheelScrollDebouncer: (editor: Editor, line: Element) => void;

    private cachedCursor: HTMLElement | null = null;

    private readonly FRICTION_COFFICIENT = 0.8;

    private cachedLine: Element | null = null;
    private cachedBlockRect: DOMRect | null = null;
    private cachedBlockWidthTimeStamp = 0;
    private cachedLineWidth = 0;
    private cachedLineCharCount = 0;
    private CACHED_BLOCK_WIDTH_TIMEOUT = 250;

    private lastHorizontalScrollTimeStamp = 0;
    private readonly CODE_BLOCK_WIDTH_TIMEOUT = 200;

    /**
     * Large constant used to artificially extend line length so that
     * each code line does not limit horizontal scrolling individually.
     * This allows the plugin to handle the scroll boundary uniformly across
     * all code lines in a block instead of relying on their individual widths.
     */
    private readonly EXTRA_LINE_LENGTH = 1_000_000;

    private readonly SCROLL_FACTOR = 0.4;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        this.verticalWheelScrollDebouncer = debounce(
            this.verticalWheelScroll.bind(this),
            50,
            false,
        );

        document.body.style.setProperty(
            "--scrolling-extra-line-length",
            `${this.EXTRA_LINE_LENGTH}px`,
        );

        this.updateStyle();

        plugin.register(() => {
            window.cancelAnimationFrame(this.scrollAnimationFrame);
            document.body.removeClass("scrolling-horizontal-code-blocks");
        });

        plugin.events.onScroll(this.scrollHandler.bind(this));
        plugin.events.onScrollEnd(this.scrollEndHandler.bind(this));
        plugin.events.onTouchMove(this.touchMoveHandler.bind(this));
        plugin.events.onLeafChange(this.leafChangeHandler.bind(this));
        plugin.events.onWheelCancelling(this.wheelHandler.bind(this), 9);
        plugin.events.onCursorUpdate(this.cursorUpdateHandler.bind(this));
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
    private scrollHandler(event: Event): void {
        if (this.isScrollingVertically || this.scrollHandlerAnimationFrame !== null) return;

        const leaf = this.getEventLeaf(event);
        if (!leaf || !(leaf.view instanceof MarkdownView) || !leaf.view.editor) return;

        this.scrollHandlerAnimationFrame = window.setTimeout(() => {
            this.scrollHandlerAnimationFrame = null;
            (leaf.view as MarkdownView).editor.cm.requestMeasure({
                key: "code-scroll-handler",
                read: (_view) => {
                    const target = event.target as Element;
                    const newScrollTop = target.scrollTop;

                    if (this.lastScrollerClientHeight !== target.clientHeight) {
                        this.lastScrollerClientHeight = target.clientHeight;
                        return;
                    }

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
    private scrollEndHandler(): void {
        this.isScrollingVertically = false;
        window.clearTimeout(this.scrollHandlerAnimationFrame);
        this.scrollHandlerAnimationFrame = null;
    }

    /**
     * On leaf change.
     * Resets cached values.
     */
    private leafChangeHandler(): void {
        this.cachedCursor = null;
        this.currentScrollWidth = null;

        this.currentScrollLeft = 0;

        this.lastScrollTop = null;
        this.isScrollingVertically = false;

        // We may expect the new leaf to have an editor.
        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor || !this.plugin.settings.horizontalScrollingCodeBlockEnabled) return;

        const lineEl = editor.cm.contentDOM.querySelector(".cm-line.cm-active");
        if (!lineEl) return;

        this.updateWidthAndBlock(lineEl);
        this.updateCursorPassive(editor);
    }

    /**
     * On wheel event.
     * Scrolls multiple connected code lines simultanously.
     * Returns true if the wheel event is handled successfully.
     */
    private wheelHandler(event: WheelEvent): boolean {
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
            line = line.parentElement.parentElement;
            if (line.classList.contains("cm-hmd-codeblock")) {
                line = line.parentElement;
            }
        } else if (line.classList.contains("cm-indent")) {
            line = line.parentElement.parentElement;
        } else if (line.classList.contains("cm-hmd-codeblock")) {
            line = line.parentElement;
        }

        if (!line.classList.contains("HyperMD-codeblock")) return false;

        // Find correct leaf to grab editor.
        const leaf = this.getEventLeaf(event);
        if (!leaf || !(leaf.view instanceof MarkdownView)) return false;

        let { deltaX, deltaY } = this.normalizeWheelDelta(event);
        const isHorizontalScroll = Math.abs(deltaX) >= Math.abs(deltaY);
        if (isHorizontalScroll && !this.isScrollingVertically) {
            this.horizontalWheelScroll(leaf.view.editor, deltaX, line, event.timeStamp);
            return true;
        }

        if (!leaf.view.editor) return false;
        this.verticalWheelScrollDebouncer(leaf.view.editor, line);

        return false;
    }

    private getEventLeaf(event: Event) {
        let eventLeaf: WorkspaceLeaf;
        this.plugin.app.workspace.iterateRootLeaves((leaf) => {
            if (leaf.view.containerEl.contains(event.target as Node)) {
                eventLeaf = leaf;
            }
        });

        return eventLeaf;
    }

    /**
     * On touch move event.
     * Scrolls multiple connected code lines simultanously.
     * Assumes that code elements do not handle horizontal scroll natively (css).
     */
    private touchMoveHandler(event: TouchEvent, deltaX: number, deltaY: number): void {
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

        // Find correct leaf to grab editor.
        const leaf = this.getEventLeaf(event);
        if (!leaf || !(leaf.view instanceof MarkdownView)) return;

        const isHorizontalScroll = Math.abs(deltaX) >= Math.abs(deltaY);
        if (isHorizontalScroll && !this.isScrollingVertically) {
            this.horizontalWheelScroll(leaf.view.editor, deltaX, line, event.timeStamp);

            // Stop Obsidian from expanding the side panels
            event.stopPropagation();
            return;
        } else if (leaf.view.editor) {
            this.verticalWheelScrollDebouncer(leaf.view.editor, line);
        }
    }

    /**
     * On cursor update.
     * Updates code blocks and code block length.
     * Scrolls to keep cursor in view.
     */
    private cursorUpdateHandler(
        editor: Editor,
        docChanged: boolean,
        _vimModeChanged: boolean,
    ): void {
        if (!this.plugin.settings.horizontalScrollingCodeBlockEnabled) return;

        const cursorEl = this.getCursorEl(editor);

        const lineEl = editor.cm.contentDOM.querySelector(".cm-line.cm-active");
        if (!lineEl?.classList?.contains("HyperMD-codeblock")) {
            this.codeBlockLines = [];
            return;
        }

        if (!this.codeBlockLines.includes(lineEl) || docChanged) {
            this.updateWidthAndBlock(lineEl);
        }

        const pos = editor.cm.state.selection.main.head;
        const line = editor.cm.state.doc.lineAt(pos);
        const col = pos - line.from;

        const charWidth = editor.cm.defaultCharacterWidth;

        this.updateCachedValues(editor, lineEl, line);

        const cursorScroll = line.length ? this.cachedLineWidth * (col / line.length) : 0;

        this.currentScrollLeft = Math.min(
            this.currentScrollWidth,
            cursorScroll,
            Math.max(
                cursorScroll - this.cachedBlockRect.width + charWidth * (cursorEl ? 5 : 4),
                this.currentScrollLeft,
            ),
        );

        // Vim cursor is now in view, show it.
        if (cursorEl && cursorEl.style.display !== "block") {
            cursorEl.style.display = "block";
        }

        this.updateHorizontalScroll();

        // Tell CodeMirror to update cursor
        if (this.cachedCursor !== null) {
            this.plugin.followScroll.skipCursor = true;
            editor.cm.dispatch({ selection: editor.cm.state.selection });
        }
    }

    /**
     * Normalizes the delta values of the event.
     * Swaps the X and Y axis if the shift key is held and the delta dominates on the Y axis.
     */
    private normalizeWheelDelta(event: WheelEvent) {
        let scale = 1;

        // Approximate line height as 16 pixels
        if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) scale = 16;
        else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) scale = window.innerHeight;

        if (event.shiftKey && Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
            return { deltaX: event.deltaY * scale, deltaY: 0 };
        }

        return { deltaX: event.deltaX * scale, deltaY: event.deltaY * scale };
    }

    /**
     * If timeout has passed, update cachedLineCharCount, cachedBlockRect & cachedLineWidth.
     */
    private updateCachedValues(editor: Editor, lineEl: Element, line?: Line): void {
        const now = performance.now();
        const timeoutPassed =
            now - this.cachedBlockWidthTimeStamp > this.CACHED_BLOCK_WIDTH_TIMEOUT;
        const lineChanged = this.cachedLine !== lineEl;

        if (timeoutPassed) {
            this.cachedBlockWidthTimeStamp = now;
            this.cachedBlockRect = lineEl.getBoundingClientRect();
        }

        if (timeoutPassed || lineChanged) {
            this.cachedLine = lineEl;
            this.cachedLineWidth = 0;
            for (let i = 0; i < lineEl.children.length; i++) {
                this.cachedLineWidth += lineEl.children[i].getBoundingClientRect().width;
            }
        } else {
            const diff = line.length - this.cachedLineCharCount;
            this.cachedLineWidth += editor.cm.defaultCharacterWidth * diff;
        }

        this.cachedLineCharCount = line.length;
    }

    /**
     * Returns the cached cursor element of the Vim cursor.
     */
    private getCursorEl(editor: Editor): HTMLElement | null {
        if (this.cachedCursor && this.cachedCursor.isConnected) {
            return this.cachedCursor;
        }

        this.cachedCursor = getVimCursor(editor);
        return this.cachedCursor;
    }

    /**
     * Updates newly loaded code block lines when scrolling vertically.
     * (Code mirror adds and removes lines on the fly)
     */
    private verticalWheelScroll(editor: Editor, line: Element): void {
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
    private horizontalWheelScroll(
        editor: Editor | null,
        deltaX: number,
        line: Element,
        now: number,
    ): void {
        if (!this.codeBlockLines.includes(line) || this.currentScrollWidth === null) {
            this.updateWidthAndBlock(line);
            this.lastHorizontalScrollTimeStamp = now;
        } else if (now - this.lastHorizontalScrollTimeStamp > this.CODE_BLOCK_WIDTH_TIMEOUT) {
            this.updateWidthAndBlock(line);
            this.lastHorizontalScrollTimeStamp = now;
        } else {
            // Remove dead lines
            this.codeBlockLines = this.codeBlockLines.filter((e) => e.isConnected);
        }

        this.currentScrollVelocity = deltaX * this.SCROLL_FACTOR;

        // Restore previous position
        this.currentScrollLeft = this.codeBlockLines[0].scrollLeft;

        // Only cancel animation frame if one is currently running
        if (this.scrollAnimationFrame) {
            window.cancelAnimationFrame(this.scrollAnimationFrame);
        }

        if (!this.currentScrollWidth) return;

        this.animateScroll(editor);
    }

    /**
     * Scrolls horizontally over multiple animation frames.
     * Updates cursor, as it moves in/out of the viewport.
     */
    private animateScroll(editor: Editor | null): void {
        this.currentScrollLeft += this.currentScrollVelocity;

        if (this.currentScrollLeft < 0) {
            this.currentScrollVelocity = 0;
            this.currentScrollLeft = 0;
        } else if (this.currentScrollLeft > this.currentScrollWidth) {
            this.currentScrollLeft = this.currentScrollWidth;
            this.currentScrollVelocity = 0;
        } else if (Math.abs(this.currentScrollVelocity) > 0.2) {
            this.currentScrollVelocity *= this.FRICTION_COFFICIENT;
            this.scrollAnimationFrame = window.requestAnimationFrame(() =>
                this.animateScroll(editor),
            );
        } else {
            this.scrollAnimationFrame = 0;
        }

        this.updateHorizontalScroll();

        // Cursor must be updated, otherwise it would not move at all while scrolling.
        this.updateCursorPassive(editor);
    }

    /**
     * Hides Vim's fat cursor, updating every frame would be laggy.
     */
    private updateCursorPassive(editor: Editor | null): void {
        // Fast path: only check editor if we have code block lines
        if (!this.codeBlockLines.length) return;

        // A different leaf with an inactive editor might be scrolled.
        if (editor && editor !== this.plugin.app.workspace.activeEditor?.editor) return;

        const cursorEl = this.getCursorEl(editor);
        if (!cursorEl) return;
        cursorEl.detach();
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
        } else if (line.classList.contains("HyperMD-codeblock")) {
            this.codeBlockLines = [];
        } else {
            this.codeBlockLines = [];
            return;
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
