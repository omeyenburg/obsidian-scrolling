import { Editor } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

function insideCodeBlock(classes: DOMTokenList): boolean {
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

export class CodeScroll {
    private readonly plugin: ScrollingPlugin;

    private codeBlockLines: Element[] = [];

    private currentScrollLeft = 0;
    private currentScrollVelocity = 0;
    private currentScrollWidth = 0;
    private lastHorizontalTimeStamp = 0;
    private lastVerticalTimeStamp = 0;
    private scrollAnimationFrame = 0;

    private verticalScroll = false;
    private cursorScheduled = false;
    private cachedCursor: HTMLElement | null = null;

    private readonly FRICTION_COFFICIENT = 0.8;

    // Grace period to keep horizontal/vertical scrolling alive.
    // Higher values might cause vertical scroll detection while
    // actually scrolling horizontally.
    private readonly DELTA_TIME_THRESHOLD = 100;

    // Large constant used to artificially extend line length so that
    // each code line does not limit horizontal scrolling individually.
    // This allows the plugin to handle the scroll boundary uniformly across
    // all code lines in a block instead of relying on their individual widths.
    private readonly EXTRA_LINE_LENGTH = 1_000_000;
    private readonly EXTRA_LINE_LENGTH_WITH_PADDING = 1_000_000 + 15;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        document.body.style.setProperty(
            "--scrolling-extra-line-length",
            `${this.EXTRA_LINE_LENGTH_WITH_PADDING}px`,
        );
    }

    public unload() {
        window.cancelAnimationFrame(this.scrollAnimationFrame);
        document.body.style.removeProperty("--scrolling-scrollbar-width");
    }

    public leafChangeHandler(): void {
        this.cachedCursor = null;
        this.currentScrollLeft = 0;

        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor) return;

        const pos = editor.cm.state.selection.main.head;
        const lineInfo = editor.cm.state.doc.lineAt(pos);
        const lineEl = editor.cm.contentDOM.children[lineInfo.number - 1];
        if (!lineEl) return;

        this.findCodeLines(lineEl);
        this.updateCursorPassive();
    }

    public wheelHandler(event: WheelEvent): void {
        // Often parent but not always
        let line = event.targetNode.parentElement as Element;
        if (!line || !insideCodeBlock(line.classList)) {
            if (
                event.target instanceof Element &&
                insideCodeBlock((event.target as Element).classList)
            ) {
                line = event.target as Element;
            } else {
                return;
            }
        }

        if (
            (Math.abs(event.deltaX) > Math.abs(event.deltaY) &&
                event.timeStamp - this.lastVerticalTimeStamp >= this.DELTA_TIME_THRESHOLD) ||
            event.timeStamp - this.lastHorizontalTimeStamp < this.DELTA_TIME_THRESHOLD
        ) {
            event.preventDefault();
            this.horizontalWheelScroll(event, line);
            this.lastHorizontalTimeStamp = event.timeStamp;
            this.verticalScroll = false
        } else {
            // No horizontal scroll
            this.lastVerticalTimeStamp = event.timeStamp;
            this.verticalScroll = true
        }
    }

    public cursorHandler(isEdit: boolean): void {
        if (this.cursorScheduled) return;
        this.cursorScheduled = true;

        window.requestAnimationFrame(() => {
            this.cursorScheduled = false;

            const editor = this.plugin.app.workspace.activeEditor?.editor;
            if (!editor) return;

            const cursorEl = this.getCursorEl(editor);
            if (!cursorEl) return;

            const pos = editor.cm.state.selection.main.head;
            const lineInfo = editor.cm.state.doc.lineAt(pos);
            const lineEl = editor.cm.contentDOM.children[lineInfo.number - 1];
            if (!lineEl) return;

            if (!this.codeBlockLines.contains(lineEl) || !isEdit) {
                this.findCodeLines(lineEl);
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

    private horizontalWheelScroll(event: WheelEvent, line: Element) {
        if (this.verticalScroll || !this.codeBlockLines.contains(line)) {
            this.currentScrollWidth = Math.max(
                0,
                this.findCodeLines(line) - this.EXTRA_LINE_LENGTH - line.clientWidth,
            );
        }

        this.currentScrollVelocity = event.deltaX;
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
        } else if (Math.abs(this.currentScrollVelocity) > 0.1) {
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
        this.plugin.cursorScroll.skipCursor = true;
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
        this.plugin.cursorScroll.skipCursor = true;
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

    // Searches for code lines around line
    // Returns the maximum length of all lines
    private findCodeLines(line: Element): number {
        let maxScrollWidthWithExtension = line.scrollWidth;

        this.codeBlockLines = [line];

        let prev = line.previousElementSibling;
        while (prev && insideCodeBlock(prev.classList)) {
            this.codeBlockLines.push(prev);
            if (prev.scrollWidth > maxScrollWidthWithExtension) {
                maxScrollWidthWithExtension = prev.scrollWidth;
            }
            prev = prev.previousElementSibling;
        }

        let next = line.nextElementSibling;
        while (next && insideCodeBlock(next.classList)) {
            this.codeBlockLines.push(next);
            if (next.scrollWidth > maxScrollWidthWithExtension) {
                maxScrollWidthWithExtension = next.scrollWidth;
            }
            next = next.nextElementSibling;
        }

        return maxScrollWidthWithExtension;
    }

    private updateHorizontalScroll() {
        this.codeBlockLines.forEach((el: Element) => {
            el.scrollLeft = this.currentScrollLeft;
        });
    }
}
