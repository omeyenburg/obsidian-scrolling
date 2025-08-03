import { View, Platform, Editor, FileView, TAbstractFile, WorkspaceLeaf } from "obsidian";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { Transaction } from "@codemirror/state";
import { around } from "monkey-around";

import type { default as ScrollingPlugin } from "./main";

export class Events {
    private readonly plugin: ScrollingPlugin;

    private scrollEventSkip = false;

    private readonly scrollHandler: (event: Event) => void;

    private static readonly LEAF_CHANGE_SCROLL_EVENT_DELAY = 500;
    private static readonly IMAGE_EXTENSIONS = new Set([
        "png",
        "jpg",
        "jpeg",
        "gif",
        "svg",
        "webp",
        "bmp",
        "ico",
        "apng",
        "avif",
    ]);

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;
        this.scrollHandler = this.unboundScrollHandler.bind(this);

        /* MouseScroll */
        if (Platform.isDesktop) {
            plugin.registerDomEvent(document, "wheel", this.wheelHandler.bind(this), {
                passive: false,
            });
        }

        /* FollowCursor */
        plugin.registerDomEvent(document, "keydown", this.keyHandler.bind(this), { passive: true });

        // Suppress first invocation
        let initialEditorChange = plugin.app.workspace.on("editor-change", () => {
            plugin.app.workspace.offref(initialEditorChange);
            plugin.registerEvent(
                plugin.app.workspace.on("editor-change", this.editHandler.bind(this)),
            );
        });
        plugin.registerEvent(initialEditorChange);

        plugin.registerEditorExtension(EditorView.updateListener.of(this.cursorHandler.bind(this)));

        /* FollowCursor & RestoreScroll */
        if (Platform.isDesktop) {
            plugin.registerDomEvent(document, "mouseup", this.mouseUpHandler.bind(this), {
                passive: true,
            });
        }

        /* MouseScroll, Scrollbar & RestoreScroll */
        plugin.registerEvent(
            plugin.app.workspace.on("active-leaf-change", this.leafChangeHandler.bind(this)),
        );
        window.requestAnimationFrame(() => this.attachScrollHandler());

        /* RestoreScroll */
        plugin.registerEvent(plugin.app.vault.on("delete", this.deleteFileHandler.bind(this)));
        plugin.registerEvent(plugin.app.vault.on("rename", this.renameFileHandler.bind(this)));
        plugin.registerEvent(plugin.app.workspace.on("quit", this.quitHandler.bind(this)));
        plugin.registerEvent(plugin.app.workspace.on("file-open", this.openFileHandler.bind(this)));

        // Wrap WorkspaceLeaf.setViewState
        const self = this;
        plugin.register(
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

        plugin.register(
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

    private attachScrollHandler(): void {
        const view = this.plugin.app.workspace.getActiveViewOfType(FileView);
        if (!view || !view.file) return;

        // Avoid scroll events after attach
        this.scrollEventSkip = true;
        window.setTimeout(
            () => (this.scrollEventSkip = false),
            Events.LEAF_CHANGE_SCROLL_EVENT_DELAY,
        );

        if (view.file.extension === "md") {
            this.attachScrollHandlerMarkdown(view);
        } else if (view.file.extension === "pdf") {
            this.attachScrollHandlerPdf(view);
        } else if (Events.IMAGE_EXTENSIONS.has(view.file.extension.toLowerCase())) {
            this.attachScrollHandlerImage(view);
        }
    }

    private attachScrollHandlerMarkdown(view: FileView) {
        const editScroller = view.contentEl.querySelector(".cm-scroller") as HTMLElement;
        const viewScroller = view.contentEl.querySelector(".markdown-preview-view") as HTMLElement;
        if (!editScroller || !viewScroller) return;

        this.plugin.scrollbar.registerScrollbar(editScroller);
        this.plugin.scrollbar.registerScrollbar(viewScroller);

        editScroller.removeEventListener("scroll", this.scrollHandler);
        viewScroller.removeEventListener("scroll", this.scrollHandler);

        this.plugin.registerDomEvent(editScroller, "scroll", this.scrollHandler, { passive: true });
        this.plugin.registerDomEvent(viewScroller, "scroll", this.scrollHandler, { passive: true });
    }

    private attachScrollHandlerPdf(view: FileView) {
        const scroller = view.contentEl.querySelector(".pdf-viewer-container") as HTMLElement;
        if (!scroller) return;

        this.plugin.scrollbar.registerScrollbar(scroller);

        scroller.removeEventListener("scroll", this.scrollHandler);
        scroller.addEventListener("scroll", this.scrollHandler);
        this.plugin.register(() => scroller.removeEventListener("scroll", this.scrollHandler));
    }

    private attachScrollHandlerImage(view: FileView) {
        const scroller = view.contentEl.querySelector(".image-container")
            ?.parentElement as HTMLElement;
        if (!scroller) return;

        this.plugin.scrollbar.registerScrollbar(scroller);

        scroller.removeEventListener("scroll", this.scrollHandler);
        scroller.addEventListener("scroll", this.scrollHandler);
        this.plugin.register(() => scroller.removeEventListener("scroll", this.scrollHandler));
    }

    private leafChangeHandler(): void {
        this.plugin.mouseScroll.leafChangeHandler();
        this.attachScrollHandler();
    }

    private unboundScrollHandler(event: Event): void {
        if (this.scrollEventSkip) return;

        this.plugin.scrollbar.scrollHandler(event);
        this.plugin.restoreScroll.scrollHandler();
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

    private quitHandler(): void {
        this.plugin.restoreScroll.quitHandler();
    }

    private keyHandler(): void {
        this.plugin.followCursor.keyHandler();
    }

    private mouseUpHandler(): void {
        this.plugin.followCursor.mouseUpHandler();
        this.plugin.restoreScroll.storeStateDebounced();
    }

    private editHandler(editor: Editor): void {
        this.plugin.followCursor.editHandler(editor);
    }

    private cursorHandler(update: ViewUpdate): void {
        // Always cancel if event was caused by mouse down/movement.
        // This only checks if this update was caused by a mouse down event,
        // but can't detect mouse up.
        for (const tr of update.transactions) {
            const event = tr.annotation(Transaction.userEvent);
            if (event === "select.pointer") {
                return;
            }
        }

        this.plugin.followCursor.cursorHandler(update);
        this.plugin.cursorScroll.cursorHandler(update);
    }

    private wheelHandler(event: WheelEvent): void {
        this.plugin.mouseScroll.wheelHandler(event);
        this.plugin.cursorScroll.wheelHandler(event);
    }
}
