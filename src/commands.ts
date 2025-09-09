import { MarkdownView } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

function scrollToTop(el: Element) {
    el.scrollTo({ top: 0 });
}

function scrollToBottom(el: Element) {
    el.scrollTo({ top: 1000000000 });
}

export class Commands {
    private readonly plugin: ScrollingPlugin;

    private scrollTopRibbon: HTMLElement | null = null;
    private scrollBottomRibbon: HTMLElement | null = null;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        plugin.addCommand({
            id: "scroll-to-top",
            name: "to top",
            callback: this.scrollCallbackWrapper(scrollToTop),
        });

        plugin.addCommand({
            id: "scroll-to-bottom",
            name: "to bottom",
            callback: this.scrollCallbackWrapper(scrollToBottom),
        });

        this.updateRibbonButtons();
    }

    public updateRibbonButtons(): void {
        if (this.plugin.settings.ribbonScrollButtonsEnabled) {
            this.addScrollRibbonButtons();
        } else {
            this.removeScrollRibbonButtons();
        }
    }

    private addScrollRibbonButtons(): void {
        this.scrollTopRibbon = this.plugin.addRibbonIcon(
            "arrow-up-to-line",
            "Scroll to top",
            this.scrollCallbackWrapper(scrollToTop),
        );
        this.scrollBottomRibbon = this.plugin.addRibbonIcon(
            "arrow-down-to-line",
            "Scroll to bottom",
            this.scrollCallbackWrapper(scrollToBottom),
        );
    }

    private removeScrollRibbonButtons(): void {
        if (this.scrollTopRibbon !== null) {
            this.scrollTopRibbon.remove();
        }

        if (this.scrollBottomRibbon !== null) {
            this.scrollBottomRibbon.remove();
        }
    }

    private scrollCallbackWrapper(scrollFunc: (el: Element) => void) {
        return () => {
            const view = this.plugin.app.workspace.getActiveFileView();
            if (!view) return false;

            let scroller: Element;
            switch (view.getViewType()) {
                case "pdf":
                    scroller = view.contentEl.getElementsByClassName("pdf-viewer-container")[0];
                    break;
                case "image":
                    scroller = view.contentEl.getElementsByClassName("view-content")[0];
                    break;
                case "markdown":
                    if ((view as MarkdownView).getMode() === "source") {
                        scroller = (view as MarkdownView).editor.cm.scrollDOM;
                    } else {
                        scroller =
                            view.contentEl.getElementsByClassName("markdown-preview-view")[0];
                    }
                    break;
                default:
                    return;
            }

            scrollFunc(scroller);
        };
    }
}
