import { Platform, WorkspaceLeaf, Editor, TFile, TAbstractFile } from "obsidian";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { Transaction } from "@codemirror/state";

import type { default as ScrollingPlugin } from "@core/main";

function isScrolledToTop(el: HTMLElement): boolean {
    return el.scrollTop == 0;
}

function isScrolledToBottom(el: HTMLElement): boolean {
    return Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
}

export class Events {
    private readonly plugin: ScrollingPlugin;

    private lastTouchX = 0;
    private lastTouchY = 0;

    private lastWheelEventTime = 0;
    private lastWheelScrollElement: HTMLElement | null;

    private skipViewUpdate = false;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        const workspace = this.plugin.app.workspace;

        plugin.registerDomEvent(workspace.containerEl, "wheel", this.wheelHandler.bind(this), {
            capture: true,
            passive: false,
        });

        plugin.registerDomEvent(
            workspace.containerEl,
            "touchstart",
            this.touchStartHandler.bind(this),
            {
                capture: true,
                passive: true,
            },
        );

        plugin.registerDomEvent(
            workspace.containerEl,
            "touchmove",
            this.touchMoveHandler.bind(this),
            {
                capture: true,
                passive: true,
            },
        );

        this.onLayoutReady(() => {
            // Wait for containerEl before attaching resize observer.
            const observer = new ResizeObserver(() => {
                this.resizeHandlers.forEach(callback => callback());
            });

            const containerEl = plugin.app.workspace.containerEl;
            const workspaceTabContainer =
                containerEl.getElementsByClassName("workspace-tab-container")[0];
            observer.observe(workspaceTabContainer);

            plugin.register(() => {
                observer.disconnect();
            });
        });
    }

    public postInit(): void {
        // Wait for other components to initialize before attaching view update handler.
        this.plugin.registerEditorExtension(
            EditorView.updateListener.of(this.viewUpdateHandler.bind(this)),
        );
    }

    private cursorUpdateHandlers: Set<
        (editor: Editor, docChanged: boolean, vimModeChanged: boolean) => any
    > = new Set();
    public onCursorUpdate(
        callback: (editor: Editor, docChanged: boolean, vimModeChanged: boolean) => any,
    ): void {
        this.cursorUpdateHandlers.add(callback);
    }
    public onFileDelete(callback: (file: TAbstractFile) => any): void {
        this.plugin.registerEvent(this.plugin.app.vault.on("delete", callback));
    }
    public onFileOpen(callback: (file: TFile | null) => any): void {
        this.plugin.registerEvent(this.plugin.app.workspace.on("file-open", callback));
    }
    public onFileRename(callback: (file: TAbstractFile, oldPath: string) => any): void {
        this.plugin.registerEvent(this.plugin.app.vault.on("rename", callback));
    }
    private geometryChangeHandlers: Set<(editor: Editor) => any> = new Set();
    public onGeometryChange(callback: (editor: Editor) => any): void {
        this.geometryChangeHandlers.add(callback);
    }
    public onKeyDown(callback: (ev: KeyboardEvent) => any): void {
        this.plugin.registerDomEvent(document, "keydown", callback, { passive: true });
    }
    public onKeyUp(callback: (ev: KeyboardEvent) => any): void {
        this.plugin.registerDomEvent(document, "keyup", callback, { passive: true });
    }

    /**
     * Runs once on layout ready after Obsidian startup or plugin reload.
     */
    public onLayoutReady(callback: () => any): void {
        this.plugin.app.workspace.onLayoutReady(callback);
    }
    public onLeafChange(callback: (leaf: WorkspaceLeaf | null) => any): void {
        this.plugin.registerEvent(this.plugin.app.workspace.on("active-leaf-change", callback));
    }
    public onMouseUp(callback: (ev: MouseEvent) => any): void {
        if (Platform.isDesktop) {
            this.plugin.registerDomEvent(document, "mouseup", callback, { passive: true });
        }
    }
    private resizeHandlers: Set<() => any> = new Set();
    public onResize(callback: () => any): void {
        this.resizeHandlers.add(callback);
    }
    public onScroll(callback: (ev: Event) => any): void {
        this.plugin.registerDomEvent(document, "scroll", callback, {
            capture: true,
            passive: true,
        });
    }
    public onScrollEnd(callback: (ev: Event) => any): void {
        this.plugin.registerDomEvent(document, "scrollend", callback, {
            capture: true,
            passive: true,
        });
    }
    private touchHandlers: Set<(event: TouchEvent, deltaX: number, deltaY: number) => any> =
        new Set();
    public onTouchMove(callback: (event: TouchEvent, deltaX: number, deltaY: number) => any): void {
        this.touchHandlers.add(callback);
    }

    private wheelCancellingHandlers: { callback: (event: Event) => boolean; priority: number }[] = [];
    /**
     * Register a callback to run on a wheel event.
     * The callback must return a boolean, indicating whether the event should not be processed any further.
     * Callbacks with higher priorities will run first.
     */
    public onWheelCancelling(callback: (event: Event) => boolean, priority: number): void {
        // Append new callback and sort in descending order by priority.
        this.wheelCancellingHandlers.push({ callback, priority });
        this.wheelCancellingHandlers.sort((a, b) => b.priority - a.priority);
    }

    private wheelExtendedHandlers: Set<
        (event: Event, el: HTMLElement, deltaTime: number, isStart: boolean) => any
    > = new Set();

    /**
     * Register a callback to run on a wheel event along the y-axis.
     * The callback will not run on horizontal movement.
     * The callback might be blocked by a cancelling wheel handler.
     */
    public onWheelExtended(
        callback: (event: Event, el: HTMLElement, deltaTime: number, isStart: boolean) => any,
    ): void {
        this.wheelExtendedHandlers.add(callback);
    }

    private viewUpdateHandler(update: ViewUpdate): void {
        if (this.plugin.followScroll.skipCursor) {
            this.plugin.followScroll.skipCursor = false;
            return;
        }

        // Always cancel if event was caused by mouse down/movement.
        // This only checks if this update was caused by a mouse down event,
        // but can't detect mouse up.
        for (const tr of update.transactions) {
            const event = tr.annotation(Transaction.userEvent);
            if (event === "select.pointer") {
                return;
            }
        }

        if (this.skipViewUpdate && !update.docChanged && !update.selectionSet) return;
        this.skipViewUpdate = true;
        window.requestAnimationFrame(() => (this.skipViewUpdate = false));

        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor) return;

        // Only proceed if its a cursor or edit event
        if (!update.selectionSet && !update.docChanged) {
            // Handle geometry events
            for (const callback of this.geometryChangeHandlers) {
                callback(editor);
            }
            return;
        }

        // Cancel if selection change is irrelevant.
        // e.g. user copies selected text or changes vim mode.
        let vimModeSwitch = false;
        if (!update.docChanged) {
            const selection = update.state.selection.main;
            const previousSelection = update.startState.selection.main;

            if (selection.head === previousSelection.head) {
                if (selection.anchor !== previousSelection.anchor) return; // copy
            } else if (selection.head === previousSelection.head - 1) {
                if (previousSelection.from < previousSelection.to) return; // copy downwards in normal mode
                if (selection.assoc === 0 && previousSelection.assoc === 1) {
                    // insert -> normal mode
                    vimModeSwitch = true;
                }
            } else if (selection.head === previousSelection.head + 1) {
                if (selection.assoc === 1 && previousSelection.assoc === 0) {
                    // normal -> insert mode
                    vimModeSwitch = true;
                }
            }
        }

        for (const callback of this.cursorUpdateHandlers) {
            callback(editor, update.docChanged, vimModeSwitch);
        }
    }

    private touchStartHandler(event: TouchEvent): void {
        this.lastTouchX = event.touches[0].clientX;
        this.lastTouchY = event.touches[0].clientY;
    }

    private touchMoveHandler(event: TouchEvent): void {
        const touchX = event.touches[0].clientX;
        const touchY = event.touches[0].clientY;

        const deltaX = this.lastTouchX - touchX;
        const deltaY = this.lastTouchY - touchY;

        this.lastTouchX = touchX;
        this.lastTouchY = touchY;

        for (const callback of this.touchHandlers) {
            callback(event, deltaX, deltaY);
        }
    }

    /**
     * Desktop only.
     */
    private wheelHandler(event: WheelEvent): void {
        if (Platform.isMobile) return;

        // Run cancelling callbacks.
        // As soon as one callback returns true abort handling event.
        for (const { callback } of this.wheelCancellingHandlers) {
            if (callback(event)) return;
        }

        if (!event.deltaY) return;

        let el: HTMLElement | null = event.target as HTMLElement;

        const now = performance.now();
        const deltaTime = now - this.lastWheelEventTime;
        this.lastWheelEventTime = now;

        const isStart = this.plugin.mouseScroll.analyzeDelay(deltaTime);

        // Attempt to use cached scroller
        if (
            !isStart &&
            this.lastWheelScrollElement &&
            (el === this.lastWheelScrollElement || this.lastWheelScrollElement.contains(el)) &&
            ((event.deltaY < 0 && !isScrolledToTop(this.lastWheelScrollElement)) ||
                (event.deltaY > 0 && !isScrolledToBottom(this.lastWheelScrollElement)))
        ) {
            for (const callback of this.wheelExtendedHandlers) {
                callback(event, this.lastWheelScrollElement, deltaTime, isStart);
            }

            return;
        }

        // Traverse DOM to find actual scrollable element
        while (el && el != document.body) {
            const { overflowY } = getComputedStyle(el);
            if (
                (overflowY === "auto" || overflowY === "scroll") &&
                el.scrollHeight > el.clientHeight
            ) {
                // Handle nested scroll containers
                if (isStart) {
                    if (event.deltaY < 0 && isScrolledToTop(el)) {
                        el = el.parentElement;
                        continue;
                    }
                    if (event.deltaY > 0 && isScrolledToBottom(el)) {
                        el = el.parentElement;
                        continue;
                    }
                }

                for (const callback of this.wheelExtendedHandlers) {
                    callback(event, this.lastWheelScrollElement, deltaTime, isStart);
                }

                this.lastWheelScrollElement = el;
                return;
            }

            el = el.parentElement;
        }
    }
}
