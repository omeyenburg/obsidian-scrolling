import { Editor, MarkdownView, WorkspaceLeaf, debounce } from "obsidian";
import { Line } from "@codemirror/state";
import { getVimCursor } from "@core/util";
import type { Feature, FeatureSettingsDefinition, ScrollingPlugin } from "@core/Feature";

export class CodeBlockFeature implements Feature {
    public readonly settings = {
        items: [
            {
                name: "Prevent code wrapping",
                desc: "Disable code wrapping & allow horizontal scrolling of code blocks in source and preview mode.",
                aliases: ["Horizontal scrolling"],
                control: {
                    type: "toggle",
                    key: "codeBlockScrollEnabled",
                    defaultValue: false,
                },
                onChange: (): void => {
                    this.updateStyle();
                },
            },
        ],
    } as const satisfies FeatureSettingsDefinition;

    private plugin!: ScrollingPlugin;

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

    private verticalWheelScrollDebouncer!: (editor: Editor, line: Element) => void;

    private cachedCursor: HTMLElement | null = null;

    private readonly FRICTION_COFFICIENT = 0.8;

    private cachedLine: Element | null = null;
    private cachedBlockRect: DOMRect | null = null;
    private cachedBlockWidthTimeStamp = 0;
    private cachedLineWidth = 0;
    private cachedLineCharCount = 0;
    private readonly CACHED_BLOCK_WIDTH_TIMEOUT = 250;

    private lastHorizontalScrollTimeStamp = 0;
    private readonly CODE_BLOCK_WIDTH_TIMEOUT = 200;

    private readonly EXTRA_LINE_LENGTH = 1_000_000;
    private readonly SCROLL_FACTOR = 0.4;

    public onload(plugin: ScrollingPlugin): void {
        this.plugin = plugin;

        this.verticalWheelScrollDebouncer = debounce(
            this.verticalWheelScroll.bind(this),
            50,
            false,
        );

        this.plugin.setStyleProperty(
            "--scrolling-extra-line-length",
            `${this.EXTRA_LINE_LENGTH}px`,
        );

        this.updateStyle();

        this.plugin.events.onScroll(this.scrollHandler.bind(this));
        this.plugin.events.onScrollEnd(this.scrollEndHandler.bind(this));
        this.plugin.events.onTouchMove(this.touchMoveHandler.bind(this));
        this.plugin.events.onLeafChange(this.leafChangeHandler.bind(this));
        this.plugin.events.onWheelCancelling(this.wheelHandler.bind(this), 9);
        this.plugin.events.onCursorUpdate(this.cursorUpdateHandler.bind(this));
    }

    public onunload(): void {
        window.cancelAnimationFrame(this.scrollAnimationFrame);
        if (this.scrollHandlerAnimationFrame !== null) {
            window.clearTimeout(this.scrollHandlerAnimationFrame);
        }
        this.plugin.disableStyleClass("scrolling-horizontal-code-blocks");
        this.plugin.removeStyleProperty("--scrolling-extra-line-length");
    }

    public updateStyle(): void {
        if (this.plugin.settings.codeBlockScrollEnabled) {
            this.plugin.enableStyleClass("scrolling-horizontal-code-blocks");
        } else {
            this.plugin.disableStyleClass("scrolling-horizontal-code-blocks");
        }
    }

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

    private scrollEndHandler(): void {
        this.isScrollingVertically = false;
        if (this.scrollHandlerAnimationFrame !== null) {
            window.clearTimeout(this.scrollHandlerAnimationFrame);
            this.scrollHandlerAnimationFrame = null;
        }
    }

    private leafChangeHandler(): void {
        this.cachedCursor = null;
        this.currentScrollWidth = null;
        this.currentScrollLeft = 0;
        this.lastScrollTop = null;
        this.isScrollingVertically = false;

        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor || !this.plugin.settings.codeBlockScrollEnabled) return;

        const lineEl = editor.cm.contentDOM.querySelector(".cm-line.cm-active");
        if (!lineEl) return;

        this.updateWidthAndBlock(lineEl);
        this.updateCursorPassive(editor);
    }

    private wheelHandler(event: WheelEvent): boolean {
        if (!this.plugin.settings.codeBlockScrollEnabled) return false;

        let line = event.target as Element;

        if (line.localName === "path") {
            line = line.parentElement?.parentElement || line;
        } else if (line.localName === "svg") {
            line = line.parentElement || line;
        }
        if (line.classList.contains("collapse-indicator")) {
            line = line.parentElement?.parentElement || line;
            if (line.classList.contains("cm-hmd-codeblock")) {
                line = line.parentElement || line;
            }
        } else if (line.classList.contains("cm-indent")) {
            line = line.parentElement?.parentElement || line;
        } else if (line.classList.contains("cm-hmd-codeblock")) {
            line = line.parentElement || line;
        }

        if (!line.classList.contains("HyperMD-codeblock")) return false;

        const leaf = this.getEventLeaf(event);
        if (!leaf || !(leaf.view instanceof MarkdownView)) return false;

        const { deltaX, deltaY } = this.normalizeWheelDelta(event);
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
        let eventLeaf: WorkspaceLeaf | undefined;
        this.plugin.app.workspace.iterateRootLeaves((leaf) => {
            if (leaf.view.containerEl.contains(event.target as Node)) {
                eventLeaf = leaf;
            }
        });
        return eventLeaf;
    }

    private touchMoveHandler(event: TouchEvent, deltaX: number, deltaY: number): void {
        if (!this.plugin.settings.codeBlockScrollEnabled) return;

        let line = event.target as Element;
        if (line.classList.contains("cm-indent")) {
            line = line.parentElement?.parentElement || line;
        } else if (line.classList.contains("cm-hmd-codeblock")) {
            line = line.parentElement || line;
        }

        if (!line.classList.contains("HyperMD-codeblock")) return;
        if (
            line.classList.contains("HyperMD-codeblock-begin") ||
            line.classList.contains("HyperMD-codeblock-end")
        )
            return;

        const leaf = this.getEventLeaf(event);
        if (!leaf || !(leaf.view instanceof MarkdownView)) return;

        const isHorizontalScroll = Math.abs(deltaX) >= Math.abs(deltaY);
        if (isHorizontalScroll && !this.isScrollingVertically) {
            this.horizontalWheelScroll(leaf.view.editor, deltaX, line, event.timeStamp);
            event.stopPropagation();
            return;
        } else if (leaf.view.editor) {
            this.verticalWheelScrollDebouncer(leaf.view.editor, line);
        }
    }

    private cursorUpdateHandler(
        editor: Editor,
        docChanged: boolean,
        _vimModeChanged: boolean,
    ): void {
        if (!this.plugin.settings.codeBlockScrollEnabled) return;

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
            this.currentScrollWidth || 0,
            cursorScroll,
            Math.max(
                cursorScroll - (this.cachedBlockRect?.width || 0) + charWidth * (cursorEl ? 5 : 4),
                this.currentScrollLeft,
            ),
        );

        if (cursorEl) {
            cursorEl.setCssStyles({ display: "block" });
        }

        this.updateHorizontalScroll();

        if (this.cachedCursor !== null) {
            this.plugin.events.skipNextViewUpdate();
            editor.cm.dispatch({ selection: editor.cm.state.selection });
        }
    }

    private normalizeWheelDelta(event: WheelEvent) {
        let scale = 1;

        if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) scale = 16;
        else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) scale = window.innerHeight;

        if (event.shiftKey && Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
            return { deltaX: event.deltaY * scale, deltaY: 0 };
        }

        return { deltaX: event.deltaX * scale, deltaY: event.deltaY * scale };
    }

    private updateCachedValues(editor: Editor, lineEl: Element, line: Line): void {
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

    private getCursorEl(editor: Editor): HTMLElement | null {
        if (this.cachedCursor && this.cachedCursor.isConnected) {
            return this.cachedCursor;
        }

        this.cachedCursor = getVimCursor(editor);
        return this.cachedCursor;
    }

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

    private updateWidthAndBlock(line: Element): void {
        const width = this.searchCodeLines(line) - this.EXTRA_LINE_LENGTH - line.clientWidth;
        this.currentScrollWidth = Math.max(0, width);
    }

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
            this.codeBlockLines = this.codeBlockLines.filter((e) => e.isConnected);
        }

        this.currentScrollVelocity = deltaX * this.SCROLL_FACTOR;

        if (this.codeBlockLines.length > 0) {
            this.currentScrollLeft = this.codeBlockLines[0].scrollLeft;
        }

        if (this.scrollAnimationFrame) {
            window.cancelAnimationFrame(this.scrollAnimationFrame);
        }

        if (!this.currentScrollWidth) return;

        this.animateScroll(editor);
    }

    private animateScroll(editor: Editor | null): void {
        this.currentScrollLeft += this.currentScrollVelocity;

        if (this.currentScrollLeft < 0) {
            this.currentScrollVelocity = 0;
            this.currentScrollLeft = 0;
        } else if (this.currentScrollLeft > (this.currentScrollWidth || 0)) {
            this.currentScrollLeft = this.currentScrollWidth || 0;
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
        this.updateCursorPassive(editor);
    }

    private updateCursorPassive(editor: Editor | null): void {
        if (!this.codeBlockLines.length) return;
        if (editor && editor !== this.plugin.app.workspace.activeEditor?.editor) return;

        const cursorEl = this.getCursorEl(editor);
        if (!cursorEl) return;
        cursorEl.detach();
    }

    private updateHorizontalScroll(): void {
        this.codeBlockLines.forEach((el: Element) => {
            el.scrollLeft = this.currentScrollLeft;
        });
    }

    private searchCodeLines(line: Element): number {
        if (this.insideCodeBlock(line.classList)) {
            this.codeBlockLines = [line];
        } else if (line.classList.contains("HyperMD-codeblock")) {
            this.codeBlockLines = [];
            return 0;
        } else {
            this.codeBlockLines = [];
            return 0;
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
