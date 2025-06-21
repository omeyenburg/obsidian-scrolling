import type { default as ScrollingPlugin } from "./main";
import { Platform, MarkdownView, WorkspaceLeaf } from "obsidian";

export class Scrollbar {
    plugin: ScrollingPlugin;

    private scrolling = false;
    private scrollTimeout: NodeJS.Timeout;
    private currentVisibility: "show" | "hide" | "transparent" | null;
    private currentWidth: number | null;

    constructor(plugin: ScrollingPlugin) {
        // Styling scrollbars doesnt work on MacOS.
        if (Platform.isMacOS) return;

        this.plugin = plugin;
        this.updateStyle();

        plugin.registerEvent(
            plugin.app.workspace.on("active-leaf-change", this.attachScrollHandler.bind(this)),
        );

        this.attachScrollHandler();
    }

    private attachScrollHandler() {
        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        setTimeout(() => {
            const scroller =
                view.contentEl.querySelector(".cm-scroller") ||
                view.contentEl.querySelector(".markdown-preview-view");
            if (!scroller) return;

            this.plugin.registerDomEvent(
                scroller as HTMLElement,
                "scroll",
                this.scrollHandler.bind(this),
            );
        }, 50);
    }

    private scrollHandler(): void {
        clearTimeout(this.scrollTimeout);

        if (!this.scrolling) {
            this.scrolling = true;
            this.updateStyle();
        }

        // Hide scrollbar again after 500 ms.
        this.scrollTimeout = setTimeout(() => {
            this.scrolling = false;
            this.updateStyle();
        }, 500);
    }

    updateStyle(): void {
        // Styling scrollbars doesnt work on MacOS.
        if (Platform.isMacOS) return;

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

        // Only proceed if state changed.
        if (this.currentVisibility == visibility && this.currentWidth == width) return;
        this.currentVisibility = visibility;
        this.currentWidth = width;

        this.removeStyle();

        const styles = document.body.classList;

        if (this.plugin.settings.scrollbarGlobal) {
            styles.add("scrolling-global");
        } else {
            styles.add("scrolling-markdown");
        }

        if (visibility == "hide") {
            styles.add("scrolling-hidden");
        } else if (visibility == "transparent") {
            styles.add("scrolling-transparent");
        }

        if (width > 0) {
            styles.add("scrolling-width");
            document.body.style.setProperty("--scrolling-scrollbar-width", `${width}px`);
        }
    }

    removeStyle(): void {
        document.body.classList.remove(
            "scrolling-global",
            "scrolling-markdown",
            "scrolling-hidden",
            "scrolling-transparent",
            "scrolling-width",
        );

        document.body.style.removeProperty("--scrolling-scrollbar-width");
    }
}
