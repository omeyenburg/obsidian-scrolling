import { Editor, debounce } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

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

    private currentScrollLeft = 0;
    private currentScrollVelocity = 0;
    private lastHorizontalTimeStamp = 0;

    private currentScrollWidth: number | null = null;
    private scrollAnimationFrame: number | null = null;

    private readonly verticalWheelScrollDebouncer: (line: Element) => void;

    private cachedCursor: HTMLElement | null = null;

    private readonly FRICTION_COFFICIENT = 0.8;

    private cachedBlockWidth = 0;
    private cachedBlockWidthTimeStamp = 0;
    private cachedLineWidth = 0;
    private cachedLineCharCount = 0;
    private CACHED_BLOCK_WIDTH_TIMEOUT = 500;

    // Grace period to keep horizontal/vertical scrolling alive.
    // Higher values might cause vertical scroll detection while
    // actually scrolling horizontally.
    private readonly DELTA_TIME_THRESHOLD = 50;

    // Large constant used to artificially extend line length so that
    // each code line does not limit horizontal scrolling individually.
    // This allows the plugin to handle the scroll boundary uniformly across
    // all code lines in a block instead of relying on their individual widths.
    private readonly EXTRA_LINE_LENGTH = 1_000_000;
    private readonly EXTRA_LINE_LENGTH_WITH_PADDING = 1_000_000 + 15;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        this.verticalWheelScrollDebouncer = debounce(
            this.verticalWheelScroll.bind(this),
            50,
            false,
        );

        document.body.style.setProperty(
            "--scrolling-extra-line-length",
            `${this.EXTRA_LINE_LENGTH_WITH_PADDING}px`,
        );

        this.updateStyle();

        plugin.register(() => {
            window.cancelAnimationFrame(this.scrollAnimationFrame);
            document.body.style.removeProperty("--scrolling-scrollbar-width");
            document.body.removeClass("scrolling-horizontal-code-blocks");
        });
    }

    public updateStyle(): void {
        if (this.plugin.settings.horizontalScrollingCodeBlockEnabled) {
            document.body.addClass("scrolling-horizontal-code-blocks");
        } else {
            document.body.removeClass("scrolling-horizontal-code-blocks");
        }
    }

    public leafChangeHandler(): void {
        this.cachedCursor = null;
        this.currentScrollWidth = null;

        this.currentScrollLeft = 0;
        this.lastHorizontalTimeStamp = 0;

        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor || !this.plugin.settings.horizontalScrollingCodeBlockEnabled) return;

        const lineEl = editor.cm.contentDOM.querySelector(".cm-line.cm-active");
        if (!lineEl) return;

        this.searchCodeLines(lineEl);
        this.updateCursorPassive();
    }

    public wheelHandler(event: WheelEvent): void {
        const target = event.target as Element;
        const parent = target?.parentElement;

        // Fast exit for non-code blocks
        if (!this.plugin.settings.horizontalScrollingCodeBlockEnabled) return;
        if (
            !target?.classList?.contains("HyperMD-codeblock") &&
            !parent?.classList?.contains("HyperMD-codeblock")
        ) {
            return;
        }

        // Only do the full check when we know we are in a code block
        const line = this.insideCodeBlock(parent?.classList) ? parent : target;
        if (line === target && !this.insideCodeBlock(target?.classList)) return;

        let { deltaX, deltaY } = normalizeWheelDelta(event);
        const isHorizontalScroll = Math.abs(deltaX) >= Math.abs(deltaY);

        if (
            isHorizontalScroll ||
            event.timeStamp - this.lastHorizontalTimeStamp < this.DELTA_TIME_THRESHOLD
        ) {
            this.horizontalWheelScroll(deltaX, line);
            this.lastHorizontalTimeStamp = event.timeStamp;
            event.preventDefault();
        } else {
            this.verticalWheelScrollDebouncer(line);
        }
    }

    public touchHandler(event: TouchEvent, deltaX: number, deltaY: number): void {
        const target = event.target as Element;
        const parent = target?.parentElement;

        // Fast exit for non-code blocks
        if (!this.plugin.settings.horizontalScrollingCodeBlockEnabled) return;
        if (
            !target?.classList?.contains("HyperMD-codeblock") &&
            !parent?.classList?.contains("HyperMD-codeblock")
        ) {
            return;
        }

        // Only do the full check when we know we are in a code block
        const line = this.insideCodeBlock(parent?.classList) ? parent : target;
        if (line === target && !this.insideCodeBlock(target?.classList)) return;

        const isHorizontalScroll = Math.abs(deltaX) >= Math.abs(deltaY);

        if (
            isHorizontalScroll ||
            event.timeStamp - this.lastHorizontalTimeStamp < this.DELTA_TIME_THRESHOLD
        ) {
            this.horizontalWheelScroll(deltaX, line);
            this.lastHorizontalTimeStamp = event.timeStamp;

            if (this.currentScrollVelocity) {
                event.preventDefault();
            }
        } else {
            this.verticalWheelScrollDebouncer(line);
        }
    }

    public cursorHandler(isEdit: boolean): void {
        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor || !this.plugin.settings.horizontalScrollingCodeBlockEnabled) return;

        const self = this;
        editor.cm.requestMeasure({
            key: "cursor-active",
            read(view) {
                const cursorEl = self.getCursorEl(editor);

                const lineEl = editor.cm.contentDOM.querySelector(".cm-line.cm-active");
                if (!lineEl?.classList?.contains("HyperMD-codeblock")) {
                    self.codeBlockLines = [];
                    return { valid: false, cursorEl };
                }

                if (!self.codeBlockLines.contains(lineEl) || isEdit) {
                    self.updateWidthAndBlock(lineEl);
                    self.currentScrollLeft = Math.min(
                        self.currentScrollLeft,
                        self.currentScrollWidth,
                    );
                }

                const pos = view.state.selection.main.head;
                const line = view.state.doc.lineAt(pos);
                const col = pos - line.from;

                const charWidth = view.defaultCharacterWidth;

                // Cache bounding rect widths
                const now = performance.now();
                if (now - self.cachedBlockWidthTimeStamp > self.CACHED_BLOCK_WIDTH_TIMEOUT) {
                    self.cachedBlockWidthTimeStamp = now;
                    self.cachedBlockWidth = lineEl.getBoundingClientRect().width;
                    self.cachedLineWidth = lineEl.firstElementChild.getBoundingClientRect().width;
                    self.cachedLineCharCount = line.length;
                } else {
                    self.cachedLineWidth += charWidth * (line.length - self.cachedLineCharCount);
                    self.cachedLineCharCount = line.length;
                }

                const cursorScroll = line.length ? self.cachedLineWidth * (col / line.length) : 0;

                self.currentScrollLeft = Math.min(
                    cursorScroll,
                    Math.max(
                        cursorScroll - self.cachedBlockWidth + charWidth * (cursorEl ? 5 : 4),
                        self.currentScrollLeft,
                    ),
                );

                return { valid: true, cursorEl: cursorEl };
            },
            write(measure, view) {
                // Cursor is now in view
                if (measure.cursorEl) {
                    measure.cursorEl.style.visibility = "visible";
                }

                // Abort if cursor not in code block
                if (!measure.valid) return;

                self.updateHorizontalScroll();

                // Tell CodeMirror to update cursor
                window.requestAnimationFrame(() => {
                    self.plugin.followScroll.skipCursor = true;
                    view.dispatch({ selection: editor.cm.state.selection });
                });
            },
        });
    }

    // Returns cursor element with caching
    private getCursorEl(editor: Editor): HTMLElement | null {
        if (this.cachedCursor && this.cachedCursor.isConnected) {
            return this.cachedCursor;
        }

        this.cachedCursor = editor.cm.scrollDOM.querySelector<HTMLElement>(".cm-cursor-primary");
        return this.cachedCursor;
    }

    private verticalWheelScroll(line: Element): void {
        this.searchCodeLines(line);
        this.updateHorizontalScroll();
    }

    private updateWidthAndBlock(line: Element): void {
        const width = this.searchCodeLines(line) - this.EXTRA_LINE_LENGTH - line.clientWidth;
        this.currentScrollWidth = Math.max(0, width);
    }

    private horizontalWheelScroll(deltaX: number, line: Element) {
        if (!this.codeBlockLines.contains(line) || this.currentScrollWidth === null) {
            this.updateWidthAndBlock(line);
        } else {
            // Remove dead lines
            this.codeBlockLines.filter((e) => e.isConnected);
        }

        this.currentScrollVelocity = deltaX;

        // Restore previous position
        this.currentScrollLeft = this.codeBlockLines[0].scrollLeft;

        window.cancelAnimationFrame(this.scrollAnimationFrame);
        this.animateScroll();
    }

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

        // Cursor must be updated, otherwise it would not move at all while scrolling
        this.updateCursorPassive();
    }

    private updateCursorPassive() {
        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor || !this.codeBlockLines.length) return;

        // Cursor must be updated, otherwise it would not move at all while scrolling
        this.plugin.followScroll.skipCursor = true;
        editor.cm.dispatch({
            selection: editor.cm.state.selection,
            effects: [], // Do not update viewport
        });

        let cursorEl: Element | null;

        editor.cm.requestMeasure({
            key: "cursor-passive",
            read: (_view) => {
                // This is only necessary with block cursor in vim mode. .cm-cursor-primary will select that.
                cursorEl = this.getCursorEl(editor);
                if (!cursorEl) return;
                if (!(cursorEl instanceof HTMLElement)) return;

                // Compute visibility
                const cursorRect = cursorEl.getBoundingClientRect();
                const codeBlockEl = this.codeBlockLines[0].parentElement;
                if (!this.codeBlockLines[0].parentElement) {
                    this.codeBlockLines = [];
                    return;
                }

                const codeBlockRect = codeBlockEl.getBoundingClientRect();

                const isVisible =
                    cursorRect.left >= codeBlockRect.left &&
                    cursorRect.right <= codeBlockRect.right;

                return isVisible;
            },
            write: (isVisible, _view) => {
                if (!cursorEl) return;
                if (!(cursorEl instanceof HTMLElement)) return;
                cursorEl.style.visibility = isVisible ? "visible" : "hidden";
            },
        });
    }

    private updateHorizontalScroll() {
        this.codeBlockLines.forEach((el: Element) => {
            el.scrollLeft = this.currentScrollLeft;
        });
    }

    // Searches for code lines around line
    // Returns the maximum length of all lines
    private searchCodeLines(line: Element): number {
        if (this.insideCodeBlock(line.classList)) {
            this.codeBlockLines = [line];
        } else {
            this.codeBlockLines = [];
        }

        return Math.max(
            line.scrollWidth,
            this.searchCodeLinesAbove(line),
            this.searchCodeLinesBelow(line),
        );
    }

    private searchCodeLinesBelow(line: Element): number {
        let maxScrollWidthWithExtension = 0;
        let next = line.nextElementSibling;

        while (next && this.insideCodeBlock(next.classList)) {
            this.codeBlockLines.push(next);
            if (next.scrollWidth > maxScrollWidthWithExtension) {
                maxScrollWidthWithExtension = next.scrollWidth;
            }
            next = next.nextElementSibling;
        }

        return maxScrollWidthWithExtension;
    }

    private searchCodeLinesAbove(line: Element): number {
        let maxScrollWidthWithExtension = 0;
        let prev = line.previousElementSibling;

        while (prev && this.insideCodeBlock(prev.classList)) {
            this.codeBlockLines.push(prev);
            if (prev.scrollWidth > maxScrollWidthWithExtension) {
                maxScrollWidthWithExtension = prev.scrollWidth;
            }
            prev = prev.previousElementSibling;
        }

        return maxScrollWidthWithExtension;
    }

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
