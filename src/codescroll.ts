import type { default as ScrollingPlugin } from "./main";

function nearCodeBlock(classes: DOMTokenList) {
    return classes.contains("HyperMD-codeblock") && classes.contains("HyperMD-codeblock-bg");
}

function codeBlockBegin(classes: DOMTokenList) {
    return classes.contains("HyperMD-codeblock-begin");
}

function codeBlockEnd(classes: DOMTokenList) {
    return classes.contains("HyperMD-codeblock-end");
}

function insideCodeBlock(classes: DOMTokenList) {
    return nearCodeBlock(classes) && !codeBlockBegin(classes) && !codeBlockEnd(classes);
}

export class CodeScroll {
    private readonly plugin: ScrollingPlugin;

    private lastHorizontal = 0;
    private lastVertical = 0;
    private horizontalVel = 0;
    private horizontalElements: Element[] = [];
    private animation = 0;
    private left = 0;
    private max = 0;

    private readonly EXTRA_LINE_PADDING = 2000;
    private readonly FRICTION_COFFICIENT = 0.8;
    private readonly DELTA_TIME_THRESHOLD = 200;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        document.body.style.setProperty(
            "--scrolling-extra-line-padding",
            `${this.EXTRA_LINE_PADDING}px`,
        );
    }

    public unload() {
        window.cancelAnimationFrame(this.animation);
        document.body.style.removeProperty("--scrolling-scrollbar-width");
    }

    public cursorHandler(): void {
        window.requestAnimationFrame(() => {
            this.updateCursorActive();
            window.requestAnimationFrame(() => {
                this.updateCursorActive();
            });
        });
    }

    private updateCursorActive(): void {
        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor) return;

        const currentLine = document.querySelector(".cm-line.cm-active");

        let cursorLeft: number;
        let cursorRight: number;

        const cursorEl = document.querySelector(".cm-cursor-primary");
        if (cursorEl) {
            // Vim fat cursor
            const cursorRect = cursorEl.getBoundingClientRect();
            cursorLeft = cursorRect.left;
            cursorRight = cursorRect.right;
        } else {
            // Normal text cursor
            const cursorCoords = editor.cm.coordsAtPos(editor.cm.state.selection.main.head);
            if (!cursorCoords) return;

            cursorLeft = cursorCoords.left;
            cursorRight = cursorCoords.right;
        }

        this.findCodeLines(currentLine);
        if (!this.horizontalElements.length) return;

        // Compute visibility
        const blockRect = currentLine.getBoundingClientRect();
        const offset = editor.cm.defaultCharacterWidth * 2;
        if (cursorLeft < blockRect.left + offset) {
            this.left += cursorLeft - blockRect.left - offset;
        } else if (cursorRight > blockRect.right - offset) {
            this.left += cursorRight - blockRect.right + offset;
        }

        this.updateHorizontalScroll();

        this.plugin.cursorScroll.skipCursor = true;
        editor.cm.dispatch({ selection: editor.cm.state.selection.main });

        if (cursorEl && cursorEl instanceof HTMLElement) {
            cursorEl.style.visibility = "visible";
        }
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
                event.timeStamp - this.lastVertical >= this.DELTA_TIME_THRESHOLD) ||
            event.timeStamp - this.lastHorizontal < this.DELTA_TIME_THRESHOLD
        ) {
            event.preventDefault();
            this.horizontalWheelScroll(event, line);
            this.lastHorizontal = event.timeStamp;
        } else {
            // No horizontal scroll
            this.lastVertical = event.timeStamp;
        }
    }

    private horizontalWheelScroll(event: WheelEvent, line: Element) {
        const maxScrollWidthWithExtension = this.findCodeLines(line);

        const padding = 10;
        this.max = Math.max(
            0,
            maxScrollWidthWithExtension - this.EXTRA_LINE_PADDING - line.clientWidth + padding,
        );

        // Init horizontal scroll
        this.horizontalVel = event.deltaX;
        this.lastVertical = 0;

        // Restore previous position
        this.left = this.horizontalElements[0].scrollLeft;

        window.cancelAnimationFrame(this.animation);
        this.animation = window.requestAnimationFrame(() => this.animateScroll());
    }

    private updateCursorPassive() {
        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor || !this.horizontalElements.length) return;

        // This is only necessary with block cursor in vim mode. .cm-cursor-primary will select that.
        const codeBlock = this.horizontalElements[0].parentElement;
        const cursorEl = document.querySelector(".cm-cursor-primary");
        if (!cursorEl) return;

        // Cursor must be updated, otherwise it would not move at all while scrolling
        this.plugin.cursorScroll.skipCursor = true;
        editor.cm.dispatch({
            selection: editor.cm.state.selection.main,
            effects: [],
        });

        // Compute visibility
        const cursorRect = cursorEl.getBoundingClientRect();
        const blockRect = codeBlock.getBoundingClientRect();

        const isVisible = cursorRect.left >= blockRect.left && cursorRect.right <= blockRect.right;

        if (cursorEl instanceof HTMLElement) {
            cursorEl.style.visibility = isVisible ? "visible" : "hidden";
        }
    }

    private animateScroll(): void {
        this.left += this.horizontalVel;

        if (this.left < 0) {
            this.horizontalVel = 0;
            this.left = 0;

            this.updateHorizontalScroll();

            // Cursor must be updated, otherwise it would not move at all while scrolling
            this.updateCursorPassive();

            return;
        }

        if (this.left > this.max) {
            this.left = this.max;
            this.horizontalVel = 0;

            this.updateHorizontalScroll();

            // Cursor must be updated, otherwise it would not move at all while scrolling
            this.updateCursorPassive();

            return;
        }

        this.horizontalVel *= this.FRICTION_COFFICIENT;
        this.updateHorizontalScroll();
        this.updateCursorPassive();

        if (Math.abs(this.horizontalVel) > 0.1) {
            this.animation = window.requestAnimationFrame(() => this.animateScroll());
        } else {
            this.animation = 0;
        }
    }

    // Searches for code lines around line
    // Returns the maximum length of all lines
    private findCodeLines(line: Element): number {
        let maxScrollWidthWithExtension = line.scrollWidth;
        this.horizontalElements = [line];
        let prev = line.previousElementSibling;
        while (prev && insideCodeBlock(prev.classList)) {
            this.horizontalElements.push(prev);
            if (prev.scrollWidth > maxScrollWidthWithExtension) {
                maxScrollWidthWithExtension = prev.scrollWidth;
            }
            prev = prev.previousElementSibling;
        }
        let next = line.nextElementSibling;
        while (next && insideCodeBlock(next.classList)) {
            this.horizontalElements.push(next);
            if (next.scrollWidth > maxScrollWidthWithExtension) {
                maxScrollWidthWithExtension = next.scrollWidth;
            }
            next = next.nextElementSibling;
        }

        return maxScrollWidthWithExtension;
    }

    private updateHorizontalScroll() {
        this.horizontalElements.forEach((el: Element) => {
            el.scrollLeft = this.left;
        });
    }
}
