import { Editor, FileView, TAbstractFile, WorkspaceLeaf } from "obsidian";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { around } from "monkey-around";

import type { default as ScrollingPlugin } from "./main";

export class Events {
    private readonly plugin: ScrollingPlugin;
    private readonly scrollHandler;

    private scrollEventSkip = false;

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

        plugin.registerDomEvent(document, "keydown", this.keyHandler.bind(this));
        plugin.registerDomEvent(document, "mouseup", this.mouseUpHandler.bind(this));
        plugin.registerDomEvent(document, "wheel", this.wheelHandler.bind(this), {
            passive: false,
        });

        plugin.registerEvent(plugin.app.vault.on("delete", this.deleteFileHandler.bind(this)));
        plugin.registerEvent(plugin.app.vault.on("rename", this.renameFileHandler.bind(this)));
        plugin.registerEvent(plugin.app.workspace.on("quit", this.quitHandler.bind(this)));
        plugin.registerEvent(
            plugin.app.workspace.on("active-leaf-change", this.leafChangeHandler.bind(this)),
        );

        plugin.registerEditorExtension(EditorView.updateListener.of(this.cursorHandler.bind(this)));

        // Supress first invocation
        let initialEditorChange = plugin.app.workspace.on("editor-change", () => {
            plugin.app.workspace.offref(initialEditorChange);
            plugin.registerEvent(
                plugin.app.workspace.on("editor-change", this.editHandler.bind(this)),
            );
        });
        plugin.registerEvent(initialEditorChange);

        // Wrap WorkspaceLeaf.setViewState
        const self = this;
        plugin.register(
            around(WorkspaceLeaf.prototype, {
                setViewState(old) {
                    return async function (...args) {
                        const result = await old.apply(this, args);
                        await self.fileLoadHandler();
                        return result;
                    };
                },
            }),
        );
    }

    private attachScrollHandlerMarkdown(view: FileView) {
        const editScroller = view.contentEl.querySelector(".cm-scroller") as HTMLElement;
        const viewScroller = view.contentEl.querySelector(".markdown-preview-view") as HTMLElement;
        if (!editScroller || !viewScroller) return;

        this.plugin.scrollbar.registerScrollbar(editScroller);
        this.plugin.scrollbar.registerScrollbar(viewScroller);

        editScroller.removeEventListener("scroll", this.scrollHandler);
        viewScroller.removeEventListener("scroll", this.scrollHandler);

        this.plugin.registerDomEvent(editScroller, "scroll", this.scrollHandler);
        this.plugin.registerDomEvent(viewScroller, "scroll", this.scrollHandler);
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
        this.plugin.mousescroll.leafChangeHandler();

        const view = this.plugin.app.workspace.getActiveViewOfType(FileView);
        if (!view || !view.file) return;

        // Avoid scroll events after attach
        this.scrollEventSkip = true;
        window.setTimeout(() => {
            this.scrollEventSkip = false;
        }, Events.LEAF_CHANGE_SCROLL_EVENT_DELAY);

        if (view.file.extension === "md") {
            this.attachScrollHandlerMarkdown(view);
        } else if (view.file.extension === "pdf") {
            this.attachScrollHandlerPdf(view);
        } else if (Events.IMAGE_EXTENSIONS.has(view.file.extension.toLowerCase())) {
            this.attachScrollHandlerImage(view);
        }
    }

    private unboundScrollHandler(event: Event): void {
        if (this.scrollEventSkip) return;

        this.plugin.scrollbar.scrollHandler(event);
        this.plugin.restoreScroll.scrollHandler();
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
        this.plugin.followcursor.keyHandler();
    }

    private mouseUpHandler(): void {
        this.plugin.followcursor.mouseUpHandler();
    }

    private editHandler(editor: Editor): void {
        this.plugin.followcursor.editHandler(editor);
    }

    private cursorHandler(update: ViewUpdate): void {
        this.plugin.followcursor.cursorHandler(update);
    }

    private fileLoadHandler(): void {
        this.plugin.restoreScroll.fileOpenHandler();
    }

    private wheelHandler(event: WheelEvent): void {
        this.plugin.mousescroll.wheelHandler(event);
    }
}
