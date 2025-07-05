import { Platform, FileView } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

export class Scrollbar {
    private plugin: ScrollingPlugin;

    private boundScrollHandler;
    private scrollEventSkip = false;
    private currentWidth: number | null;
    private currentVisibility: string;
    private currentFileTreeHorizontal = false;
    private scrollTimeouts = new Map<HTMLElement, number>();

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;
        this.updateStyle();

        this.boundScrollHandler = this.scrollHandler.bind(this);
    }

    // Called in main
    public activeLeafChangeHandler() {
        const view = this.plugin.app.workspace.getActiveViewOfType(FileView);
        if (!view || !view.file) return;

        // Avoid scroll events after attach
        this.scrollEventSkip = true;
        window.setTimeout(() => {
            this.scrollEventSkip = false;
        }, 250);

        if (view.file.extension === "md") {
            const editScroller = view.contentEl.querySelector(".cm-scroller") as HTMLElement;
            const viewScroller = view.contentEl.querySelector(
                ".markdown-preview-view",
            ) as HTMLElement;

            // Hide scrollbars on elements
            editScroller.classList.add("scrolling-transparent");
            viewScroller.classList.add("scrolling-transparent");

            editScroller.removeEventListener("scroll", this.boundScrollHandler);
            viewScroller.removeEventListener("scroll", this.boundScrollHandler);

            this.plugin.registerDomEvent(editScroller, "scroll", this.boundScrollHandler);
            this.plugin.registerDomEvent(viewScroller, "scroll", this.boundScrollHandler);
        } else if (view.file.extension === "pdf") {
            const scroller = view.contentEl.querySelector(".pdf-viewer-container") as HTMLElement;

            // Hide scrollbars on elements
            scroller.classList.add("scrolling-transparent");

            scroller.removeEventListener("scroll", this.boundScrollHandler);
            scroller.addEventListener("scroll", this.boundScrollHandler);
            this.plugin.register(() =>
                scroller.removeEventListener("scroll", this.boundScrollHandler),
            );
        }
    }

    private scrollHandler(event: Event): void {
        if (this.scrollEventSkip) return;

        this.plugin.restoreScroll.saveScrollPosition();

        // Scrollbars styling doesnt work on MacOS.
        if (Platform.isMacOS) return;
        if (this.plugin.settings.scrollbarVisibility != "scroll") return;

        const el = event.currentTarget as HTMLElement;
        if (!el) return;

        // Show scrollbar on target element
        el.classList.remove("scrolling-transparent");

        // Update timeout
        const existingTimeout = this.scrollTimeouts.get(el);
        if (existingTimeout) {
            window.clearTimeout(existingTimeout);
        }

        const timeoutId = window.setTimeout(() => {
            el.classList.add("scrolling-transparent");
            this.scrollTimeouts.delete(el);
        }, 500);

        this.scrollTimeouts.set(el, timeoutId);
    }

    public updateStyle(): void {
        // Styling scrollbars doesnt work on MacOS.
        // Only handle horizontal file tree scrollbar.
        if (Platform.isMacOS) {
            // Only proceed if state changed.
            const fileTreeHorizontal = this.plugin.settings.scrollbarFileTreeHorizontal;
            if (this.currentFileTreeHorizontal == fileTreeHorizontal) return;
            this.currentFileTreeHorizontal = fileTreeHorizontal;

            if (fileTreeHorizontal) {
                document.body.addClass("scrolling-filetree-horizontal");
            } else {
                document.body.removeClass("scrolling-filetree-horizontal");
            }

            return;
        }

        const visibility = this.plugin.settings.scrollbarVisibility;

        // Default width appears to be 12px.
        // Only linux supports this option, set to -1 to ignore width.
        const width = Platform.isLinux ? this.plugin.settings.scrollbarWidth : -1;

        const fileTreeHorizontal = this.plugin.settings.scrollbarFileTreeHorizontal;

        // Only proceed if state changed.
        if (
            this.currentWidth == width &&
            this.currentVisibility == visibility &&
            this.currentFileTreeHorizontal == fileTreeHorizontal
        )
            return;

        this.currentWidth = width;
        this.currentVisibility = visibility;
        this.currentFileTreeHorizontal = fileTreeHorizontal;

        this.removeStyle();

        if (fileTreeHorizontal) {
            document.body.addClass("scrolling-filetree-horizontal");
        }

        if (visibility === "hide") {
            document.body.addClass("scrolling-visibility-hide");
        } else if (visibility === "scroll") {
            document.body.addClass("scrolling-visibility-scroll");
        }

        if (width >= 0) {
            document.body.addClass("scrolling-scrollbar-width");
            document.body.style.setProperty("--scrolling-scrollbar-width", `${width}px`);
        }
    }

    public removeStyle(): void {
        document.body.removeClasses([
            "scrolling-scrollbar-width",
            "scrolling-visibility-hide",
            "scrolling-visibility-scroll",
            "scrolling-filetree-horizontal",
        ]);

        document.body.style.removeProperty("--scrolling-scrollbar-width");
    }
}
