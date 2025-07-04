import { Platform, MarkdownView } from "obsidian";
import type { default as ScrollingPlugin } from "./main";

export class Scrollbar {
    private plugin: ScrollingPlugin;

    private scrolling = false;
    private scrollTimeout: number;
    private scrollEventSkip = false;

    private currentVisibility: "show" | "hide" | "transparent" | null;
    private currentWidth: number | null;
    private currentFileTreeHorizontal = false;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;
        this.updateStyle();

        // Scrollbars styling doesnt work on MacOS.
        // Toggling file tree scrollbar works.
        if (Platform.isMacOS) return;

        this.attachScrollHandler();
        plugin.registerEvent(
            plugin.app.workspace.on("active-leaf-change", this.attachScrollHandler.bind(this)),
        );
    }

    // Not invoked on MacOS.
    private attachScrollHandler() {
        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        this.scrollEventSkip = true;
        window.setTimeout(() => {
            this.scrollEventSkip = false;
        }, 250);

        window.requestAnimationFrame(() => {
            const scroller =
                view.contentEl.querySelector(".cm-scroller") ||
                view.contentEl.querySelector(".markdown-preview-view");
            if (!scroller) return;

            this.plugin.registerDomEvent(
                scroller as HTMLElement,
                "scroll",
                this.scrollHandler.bind(this),
            );
        });
    }

    // Not invoked on MacOS.
    private scrollHandler(): void {
        if (this.scrollEventSkip) {
            return;
        }

        window.clearTimeout(this.scrollTimeout);

        if (!this.scrolling) {
            this.scrolling = true;
            this.updateStyle();
        }

        // Hide scrollbar again after 500 ms.
        this.scrollTimeout = window.setTimeout(() => {
            this.scrolling = false;
            this.updateStyle();
        }, 500);
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

        let visibility: "show" | "hide" | "transparent" = "show";
        if (this.plugin.settings.scrollbarVisibility == "hide") {
            visibility = "hide";
        } else if (this.plugin.settings.scrollbarVisibility == "scroll" && !this.scrolling) {
            visibility = "transparent";
        }

        // Default width of Obsidian appears to be 12px.
        // Only linux supports this option, set to -1 to ignore width.
        const width = Platform.isLinux ? this.plugin.settings.scrollbarWidth : -1;

        if (width == 0) {
            visibility = "hide";
        }

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

        if (this.plugin.settings.scrollbarGlobal) {
            document.body.addClass("scrolling-global");
        } else {
            document.body.addClass("scrolling-markdown");
        }

        if (visibility == "hide") {
            document.body.addClass("scrolling-hidden");
        } else if (visibility == "transparent") {
            document.body.addClass("scrolling-transparent");
        }

        if (width > 0) {
            document.body.addClass("scrolling-width");
            document.body.style.setProperty("--scrolling-scrollbar-width", `${width}px`);
        }
    }

    public removeStyle(): void {
        document.body.removeClasses([
            "scrolling-global",
            "scrolling-markdown",
            "scrolling-hidden",
            "scrolling-transparent",
            "scrolling-width",
            "scrolling-filetree-horizontal",
        ]);

        document.body.style.removeProperty("--scrolling-scrollbar-width");
    }
}
