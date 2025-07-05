import { MarkdownView, TFile } from "obsidian";
import type { default as ScrollingPlugin } from "./main";

export class RestoreScroll {
    private plugin: ScrollingPlugin;

    private recentLeafChange: boolean;
    private recentFileOpenEvent = false;
    private leafChangeTimeout: number;

    private static readonly LEAF_CHANGE_DEBOUNCE_MS = 500;
    private static readonly SCROLL_RETRY_LIMIT = 25;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        plugin.registerEvent(plugin.app.workspace.on("file-open", this.fileHandler.bind(this)));
        plugin.registerEvent(
            plugin.app.workspace.on("active-leaf-change", this.leafHandler.bind(this)),
        );

        plugin.registerEvent(
            plugin.app.workspace.on("quit", (tasks) =>
                tasks.add(async () => await plugin.saveSettings()),
            ),
        );
    }

    private leafHandler(): void {
        if (!this.plugin.settings.restoreScrollEnabled) return;

        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        let scroller: HTMLElement;
        if (view.getMode() === "preview") {
            scroller = view.containerEl.querySelector(".markdown-preview-view") as HTMLElement;
            if (!scroller) return;
        } else {
            scroller = view.editor.cm.scrollDOM;
        }

        if (scroller.scrollTop == 0) {
            scroller.scrollTop = 1;
        }

        window.clearTimeout(this.leafChangeTimeout);

        this.recentLeafChange = true;
        this.leafChangeTimeout = window.setTimeout(() => {
            this.recentLeafChange = false;
        }, RestoreScroll.LEAF_CHANGE_DEBOUNCE_MS);
    }

    private fileHandler(file: TFile | null): void {
        if (!this.plugin.settings.restoreScrollEnabled) return;
        if (!file) return;

        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        // Query last position.
        // No need to scroll if dest is zero.
        const dest = this.plugin.settings.restoreScrollPositions[file.path];
        if (!dest) return;

        let scroller: HTMLElement;
        if (view.getMode() === "preview") {
            scroller = view.containerEl.querySelector(".markdown-preview-view") as HTMLElement;
            if (!scroller) return;
        } else {
            scroller = view.editor.cm.scrollDOM;
        }

        // If scrollTop is 0, assume that file is already loaded.
        if (scroller.scrollTop == 0) {
            scroller.scrollTop = dest;
            return;
        }

        // Prevent saving
        this.recentFileOpenEvent = true;

        // Hide until scrolling is finished
        const content = view.leaf.view.containerEl;
        content.style.visibility = "hidden";

        // Scroll to dest and wait until obsidian overrides it (dest != zero).
        scroller.scrollTop = dest;

        let i = 0;
        const scroll = () => {
            if (i++ < RestoreScroll.SCROLL_RETRY_LIMIT && scroller.scrollTop != 0) {
                scroller.scrollTop = dest;
                window.requestAnimationFrame(scroll);
            } else {
                scroller.scrollTop = dest;
                content.style.visibility = "visible";

                window.requestAnimationFrame(() => {
                    this.recentFileOpenEvent = false;
                });
            }
        };
        scroll();
    }

    // Invoked on cursor movement and mouse scroll.
    public saveScrollPosition() {
        if (!this.plugin.settings.restoreScrollEnabled) return;

        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || !view.file) return;

        // Defer saving for 500 ms to prevent interference with opening files
        window.setTimeout(() => {
            if (
                this.recentLeafChange ||
                this.recentFileOpenEvent ||
                this.plugin.app.workspace.activeEditor?.file != view.file
            )
                return;

            let scrollTop;

            if (view.getMode() === "source") {
                scrollTop = view.editor.getScrollInfo().top;
            } else {
                scrollTop = view.containerEl.querySelector(".markdown-preview-view")?.scrollTop;
            }

            // const cursor = editor.getCursor();
            if (scrollTop) {
                this.plugin.settings.restoreScrollPositions[view.file.path] = scrollTop;
            }
        }, 500);
    }
}
