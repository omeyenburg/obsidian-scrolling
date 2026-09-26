import { Platform } from "obsidian";
import type { Feature, FeatureSettingsDefinition, ScrollingPlugin } from "@core/Feature";

function scrollToTop(el: Element) {
    el.scrollTo({ top: 0 });
}

function scrollToBottom(el: Element) {
    el.scrollTo({ top: 1000000000 });
}

export class CommandsFeature implements Feature {
    public readonly id = "commands";

    public readonly settings = {
        name: "todo: merge into scroll buttons",
        desc: "todo",
        items: [
            {
                name: "Commands for scrolling to top/bottom",
                desc: "Adds buttons to the ribbon bar for scrolling to the top/bottom of the file.\nMay require reload.",
                control: {
                    type: "toggle",
                    key: "ribbonScrollButtonsEnabled",
                    defaultValue: false,
                },
                onChange() {
                    this.updateRibbonButtons()
                },
            }
        ],
    } as const satisfies FeatureSettingsDefinition;

    private plugin!: ScrollingPlugin;
    private scrollTopRibbon: HTMLElement | null = null;
    private scrollBottomRibbon: HTMLElement | null = null;

    public onload(plugin: ScrollingPlugin): void {
        this.plugin = plugin;

        this.plugin.addCommand({
            id: "scroll-to-top",
            name: "To top",
            callback: this.scrollCallbackWrapper(scrollToTop),
        });

        this.plugin.addCommand({
            id: "scroll-to-bottom",
            name: "To bottom",
            callback: this.scrollCallbackWrapper(scrollToBottom),
        });

        this.updateRibbonButtons();
    }

    public onunload(): void {
        this.removeScrollRibbonButtons();
    }

    public updateRibbonButtons(): void {
        if (Platform.isDesktop) return;

        if (this.plugin.settings.ribbonScrollButtonsEnabled) {
            this.addScrollRibbonButtons();
        } else {
            this.removeScrollRibbonButtons();
        }
    }

    private addScrollRibbonButtons(): void {
        if (this.scrollTopRibbon || this.scrollBottomRibbon) return;
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
            this.scrollTopRibbon = null;
        }

        if (this.scrollBottomRibbon !== null) {
            this.scrollBottomRibbon.remove();
            this.scrollBottomRibbon = null;
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
                    if ((view as any).getMode() === "source") {
                        scroller = (view as any).editor.cm.scrollDOM;
                    } else {
                        scroller =
                            view.contentEl.getElementsByClassName("markdown-preview-view")[0];
                    }
                    break;
                default:
                    return;
            }

            if (scroller) {
                scrollFunc(scroller);
            }
        };
    }
}
