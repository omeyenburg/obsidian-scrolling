import { View, Platform, TAbstractFile, WorkspaceLeaf } from "obsidian";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { Transaction } from "@codemirror/state";
import { around } from "monkey-around";

import type { default as ScrollingPlugin } from "./main";

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

        this.attachHandlers();
        this.attachWrappers();
    }

    private attachHandlers(): void {
        const vault = this.plugin.app.vault;
        const workspace = this.plugin.app.workspace;

        workspace.onLayoutReady(this.layoutReadyHandler.bind(this));

        /* MouseScroll & CodeBlock */
        this.plugin.registerDomEvent(workspace.containerEl, "wheel", this.wheelHandler.bind(this), {
            capture: true,
            passive: false,
        });
        this.plugin.registerDomEvent(
            workspace.containerEl,
            "touchstart",
            this.touchStartHandler.bind(this),
            {
                capture: true,
                passive: true,
            },
        );
        this.plugin.registerDomEvent(
            workspace.containerEl,
            "touchmove",
            this.touchMoveHandler.bind(this),
            {
                capture: true,
                passive: true,
            },
        );

        /* PreviewShortcuts */
        this.plugin.registerDomEvent(document, "keyup", this.keyUpHandler.bind(this), {
            passive: true,
        });

        /* FollowCursor & PreviewShortcuts */
        this.plugin.registerDomEvent(document, "keydown", this.keyDownHandler.bind(this), {
            passive: true,
        });

        /* FollowCursor */
        this.plugin.registerEditorExtension(
            EditorView.updateListener.of(this.viewUpdateHandler.bind(this)),
        );

        /* FollowCursor & RestoreScroll */
        if (Platform.isDesktop) {
            this.plugin.registerDomEvent(document, "mouseup", this.mouseUpHandler.bind(this), {
                passive: true,
            });
        }

        /* CodeBlock, MouseScroll, Scrollbar & RestoreScroll */
        this.plugin.registerEvent(
            workspace.on("active-leaf-change", this.leafChangeHandler.bind(this)),
        );

        this.plugin.registerDomEvent(document, "scroll", this.scrollHandler.bind(this), {
            capture: true,
            passive: true,
        });
        this.plugin.registerDomEvent(document, "scrollend", this.scrollEndHandler.bind(this), {
            capture: true,
            passive: true,
        });

        /* RestoreScroll */
        this.plugin.registerEvent(vault.on("delete", this.deleteFileHandler.bind(this)));
        this.plugin.registerEvent(vault.on("rename", this.renameFileHandler.bind(this)));
        this.plugin.registerEvent(workspace.on("quit", this.quitHandler.bind(this)));
        this.plugin.registerEvent(workspace.on("file-open", this.openFileHandler.bind(this)));
    }

    private attachWrappers(): void {
        const self = this;
        this.plugin.register(
            around(WorkspaceLeaf.prototype, {
                setViewState(old) {
                    return async function (...args) {
                        const result = await old.apply(this, args);
                        self.plugin.restoreScroll.viewStateHandler(this.view);
                        return result;
                    };
                },
            }),
        );

        this.plugin.register(
            around(View.prototype, {
                setEphemeralState(old) {
                    return async function (...args) {
                        self.plugin.restoreScroll.ephemeralStateHandler(this, args);
                        const result = await old.apply(this, args);
                        return result;
                    };
                },
            }),
        );
    }

    private layoutReadyHandler(): void {
        this.plugin.followScroll.layoutReadyHandler();
    }

    private leafChangeHandler(): void {
        this.plugin.mouseScroll.leafChangeHandler();
        this.plugin.followScroll.leafChangeHandler();
        this.plugin.codeBlock.leafChangeHandler();
    }

    private scrollHandler(event: Event): void {
        this.plugin.scrollbar.scrollHandler(event);
        this.plugin.restoreScroll.scrollHandler();
        this.plugin.codeBlock.scrollHandler(event);
    }

    private scrollEndHandler(): void {
        this.plugin.codeBlock.scrollEndHandler();
    }

    private openFileHandler(): void {
        this.plugin.restoreScroll.openFileHandler();
    }

    private deleteFileHandler(file: TAbstractFile): void {
        this.plugin.restoreScroll.deleteFileHandler(file);
    }

    private renameFileHandler(file: TAbstractFile, old: string): void {
        this.plugin.restoreScroll.renameFileHandler(file, old);
    }

    /**
     * May run before Obsidian quits.
     */
    private quitHandler(): void {
        this.plugin.restoreScroll.quitHandler();
    }

    private keyUpHandler(): void {
        this.plugin.previewShortcuts.keyUpHandler();
    }

    private keyDownHandler(event: KeyboardEvent): void {
        this.plugin.previewShortcuts.keyDownHandler(event);
        this.plugin.followCursor.keyDownHandler();
    }

    private mouseUpHandler(): void {
        this.plugin.followCursor.mouseUpHandler();
        this.plugin.restoreScroll.storeStateDebounced();
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

        if (this.skipViewUpdate) return;
        this.skipViewUpdate = true;
        window.requestAnimationFrame(() => (this.skipViewUpdate = false));

        // Only proceed if its a cursor or edit event
        if (!update.selectionSet && !update.docChanged) return;

        // Cancel if selection change is irrelevant, e.g. user copies selected text.
        if (!update.docChanged) {
            const range = update.state.selection.ranges[0];
            const previousRange = update.startState.selection.ranges[0];
            if (range.head === previousRange.head) return;
            if (previousRange.from < previousRange.to && range.head === previousRange.head - 1)
                return;
        }

        this.plugin.restoreScroll.storeStateDebounced();

        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor) return;

        this.plugin.codeBlock.viewUpdateHandler(editor, update.docChanged);
        this.plugin.followCursor.viewUpdateHandler(editor, update.docChanged);
        this.plugin.followScroll.viewUpdateHandler(editor);
    }

    private isWithinScrollContext(el: HTMLElement): boolean {
        return el === this.lastWheelScrollElement || this.lastWheelScrollElement.contains(el);
    }

    /**
     * Mobile only.
     */
    private touchStartHandler(event: TouchEvent): void {
        this.lastTouchX = event.touches[0].clientX;
        this.lastTouchY = event.touches[0].clientY;
    }

    /**
     * Mobile only.
     */
    private touchMoveHandler(event: TouchEvent): void {
        const touchX = event.touches[0].clientX;
        const touchY = event.touches[0].clientY;

        const deltaX = this.lastTouchX - touchX;
        const deltaY = this.lastTouchY - touchY;

        this.lastTouchX = touchX;
        this.lastTouchY = touchY;

        this.plugin.codeBlock.touchHandler(event, deltaX, deltaY);
    }

    /**
     * Desktop only.
     */
    private wheelHandler(event: WheelEvent): void {
        let eventHandled = this.plugin.imageZoom.wheelHandler(event);
        if (eventHandled) return;

        eventHandled = this.plugin.codeBlock.wheelHandler(event);
        if (eventHandled) return;

        if (!event.deltaY) return;
        if (
            !(
                (Platform.isDesktop && this.plugin.settings.scrollMode !== "disabled") ||
                this.plugin.settings.cursorScrollEnabled
            )
        )
            return;

        let el: HTMLElement | null = event.target as HTMLElement;

        const now = performance.now();
        const deltaTime = now - this.lastWheelEventTime;
        this.lastWheelEventTime = now;

        const isStart = this.plugin.mouseScroll.analyzeDelay(deltaTime);

        // Attempt to use cached scroller
        if (!isStart && this.lastWheelScrollElement) {
            if (this.isWithinScrollContext(el)) {
                if (
                    (event.deltaY < 0 && !isScrolledToTop(this.lastWheelScrollElement)) ||
                    (event.deltaY > 0 && !isScrolledToBottom(this.lastWheelScrollElement))
                ) {
                    this.plugin.mouseScroll.wheelHandler(
                        event,
                        this.lastWheelScrollElement,
                        now,
                        deltaTime,
                        isStart,
                    );

                    this.plugin.followScroll.wheelHandler(this.lastWheelScrollElement);
                    return;
                }
            }
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

                this.plugin.mouseScroll.wheelHandler(event, el, now, deltaTime, isStart);
                this.plugin.followScroll.wheelHandler(el);
                this.lastWheelScrollElement = el;
                return;
            }

            el = el.parentElement;
        }
    }
}
