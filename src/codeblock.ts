import { Editor, debounce } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

function normalizeWheel(event: WheelEvent) {
    let scale = 1;

    // Approximate line height as 16 pixels
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) scale = 16;
    else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) scale = window.innerHeight;

    return { deltaX: event.deltaX * scale, deltaY: event.deltaY * scale };
}

export class CodeBlock {
    private readonly plugin: ScrollingPlugin;

    private codeBlockLines: Element[] = [];

    private currentScrollLeft = 0;
    private currentScrollVelocity = 0;
    private currentScrollWidth = 0;
    private lastHorizontalTimeStamp = 0;
    private lastVerticalTimeStamp = 0;
    private scrollAnimationFrame = 0;

    private readonly verticalWheelScrollDebouncer: (line: Element) => void;

    private cursorScheduled = false;
    private cachedCursor: HTMLElement | null = null;

    private readonly FRICTION_COFFICIENT = 0.8;

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
        this.currentScrollLeft = 0;

        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor || !this.plugin.settings.horizontalScrollingCodeBlockEnabled) return;

        const lineEl = document.querySelector(".cm-line.cm-active");
        if (!lineEl) return;

        this.searchCodeLines(lineEl);
        this.updateCursorPassive();
    }

    public wheelHandler(event: WheelEvent): void {
        const target = event.target as Element;
        const parent = target?.parentElement;

        let { deltaX, deltaY } = normalizeWheel(event);

        if (event.shiftKey && Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
            deltaX = deltaY;
            deltaY = 0;
        }

        const isHorizontalScroll = Math.abs(deltaX) >= Math.abs(deltaY);

        // Fast exit for non-code blocks
        if (
            !this.plugin.settings.horizontalScrollingCodeBlockEnabled ||
            (!target?.classList?.contains("HyperMD-codeblock") &&
                !parent?.classList?.contains("HyperMD-codeblock"))
        ) {
            return;
        }

        // Only do the full check when we know we are in a code block
        const line = this.insideCodeBlock(parent?.classList) ? parent : target;
        if (line === target && !this.insideCodeBlock(target?.classList)) return;

        if (
            (isHorizontalScroll &&
                event.timeStamp - this.lastVerticalTimeStamp >= this.DELTA_TIME_THRESHOLD) ||
            event.timeStamp - this.lastHorizontalTimeStamp < this.DELTA_TIME_THRESHOLD
        ) {
            event.preventDefault();
            this.horizontalWheelScroll(deltaX, line);
            this.lastHorizontalTimeStamp = event.timeStamp;
        } else {
            // No horizontal scroll
            this.lastVerticalTimeStamp = event.timeStamp;
            this.verticalWheelScrollDebouncer(line);
        }
    }

    public cursorHandler(isEdit: boolean): void {
        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (
            this.cursorScheduled ||
            !editor ||
            !this.plugin.settings.horizontalScrollingCodeBlockEnabled
        )
            return;

        const lineEl = document.querySelector(".cm-line.cm-active");
        if (!lineEl?.classList?.contains("HyperMD-codeblock")) {
            this.codeBlockLines = [];
            return;
        }

        this.cursorScheduled = true;
        window.requestAnimationFrame(() => {
            this.cursorScheduled = false;

            const cursorEl = this.getCursorEl(editor);
            if (!cursorEl) return;

            if (!this.codeBlockLines.contains(lineEl) || !isEdit) {
                this.searchCodeLines(lineEl);
            }

            this.updateCursorActive(editor, lineEl, cursorEl);
        });
    }

    private getCursorEl(editor: Editor): HTMLElement | null {
        if (this.cachedCursor && this.cachedCursor.isConnected) {
            return this.cachedCursor;
        }

        this.cachedCursor = editor.cm.dom.querySelector<HTMLElement>(".cm-cursor-primary");
        return this.cachedCursor;
    }

    private verticalWheelScroll(line: Element): void {
        this.searchCodeLines(line);
        this.updateHorizontalScroll();
    }

    private horizontalWheelScroll(deltaX: number, line: Element) {
        if (!this.codeBlockLines.contains(line) || !this.currentScrollWidth) {
            this.currentScrollWidth = Math.max(
                0,
                this.searchCodeLines(line) - this.EXTRA_LINE_LENGTH - line.clientWidth,
            );
        } else {
            // Remove dead lines
            this.codeBlockLines.filter((e) => e.isConnected);
        }

        this.currentScrollVelocity = deltaX;
        this.lastVerticalTimeStamp = 0;

        // Restore previous position
        this.currentScrollLeft = this.codeBlockLines[0].scrollLeft;

        window.cancelAnimationFrame(this.scrollAnimationFrame);
        this.scrollAnimationFrame = window.requestAnimationFrame(() => this.animateScroll());
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

    private updateCursorActive(editor: Editor, lineEl: Element, cursorEl: Element): void {
        let cursorLeft: number;
        let cursorRight: number;

        const cursorCoords = editor.cm.coordsAtPos(editor.cm.state.selection.main.head);
        if (!cursorCoords) return;

        // Respect Vim's fat cursor
        cursorLeft = cursorCoords.left;
        cursorRight = cursorCoords.right + (cursorEl ? editor.cm.defaultCharacterWidth : 0);

        // Compute visibility
        const blockRect = lineEl.getBoundingClientRect();
        const offset = editor.cm.defaultCharacterWidth * 2;
        if (cursorLeft < blockRect.left + offset) {
            this.currentScrollLeft += cursorLeft - blockRect.left - offset;
        } else if (cursorRight > blockRect.right - offset) {
            this.currentScrollLeft += cursorRight - blockRect.right + offset;
        }

        this.updateHorizontalScroll();

        // Tell codemirror to update cursor
        this.plugin.followScroll.skipCursor = true;
        editor.cm.dispatch({ selection: editor.cm.state.selection });

        if (
            cursorEl &&
            cursorEl instanceof HTMLElement &&
            cursorEl.style.visibility !== "visible"
        ) {
            cursorEl.style.visibility = "visible";
        }
    }

    private updateCursorPassive() {
        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor || !this.codeBlockLines.length) return;

        // This is only necessary with block cursor in vim mode. .cm-cursor-primary will select that.
        const cursorEl = this.getCursorEl(editor);
        if (!cursorEl) return;

        // Cursor must be updated, otherwise it would not move at all while scrolling
        this.plugin.followScroll.skipCursor = true;
        editor.cm.dispatch({
            selection: editor.cm.state.selection,
            effects: [],
        });

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
            cursorRect.left >= codeBlockRect.left && cursorRect.right <= codeBlockRect.right;
        cursorEl.style.visibility = isVisible ? "visible" : "hidden";
    }

    private updateHorizontalScroll() {
        this.codeBlockLines.forEach((el: Element) => {
            el.scrollLeft = this.currentScrollLeft;
        });
    }

    // Searches for code lines around line
    // Returns the maximum length of all lines
    private searchCodeLines(line: Element): number {
        this.codeBlockLines = [line];
        return Math.max(
            line.scrollWidth,
            this.searchCodeLinesAbove(line),
            this.searchCodeLinesBelow(line),
        );
    }

    private searchCodeLinesBelow(line: Element): number {
        let maxScrollWidthWithExtension = 0;
        let next = line.nextElementSibling;

        while (next && this.insideCodeBlockBelow(next)) {
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

        while (prev && this.insideCodeBlockAbove(prev)) {
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

    private insideCodeBlockBelow(lineBelow: Element): boolean {
        let isCode = false;
        const classes = lineBelow.classList;
        for (let i = 0; i < classes.length; i++) {
            const c = classes[i];
            if (c === "HyperMD-codeblock") {
                isCode = true;
            }
            if (c === "HyperMD-codeblock-end") {
                return false;
            }
        }

        return isCode;
    }

    private insideCodeBlockAbove(lineAbove: Element): boolean {
        let isCode = false;
        const classes = lineAbove.classList;
        for (let i = 0; i < classes.length; i++) {
            const c = classes[i];
            if (c === "HyperMD-codeblock") {
                isCode = true;
            }
            if (c === "HyperMD-codeblock-begin") {
                return false;
            }
        }

        return isCode;
    }
}
