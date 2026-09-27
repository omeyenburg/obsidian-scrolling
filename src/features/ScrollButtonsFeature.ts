import { MarkdownView, WorkspaceLeaf, setIcon } from "obsidian";
import type { Feature, FeatureSettingsDefinition, ScrollingPlugin } from "@core/Feature";

export class ScrollButtonsFeature implements Feature {
    public readonly settings = {
        heading: "Scroll buttons",
        items: [
            {
                name: "Show top/bottom scroll buttons",
                desc: "Adds buttons to scroll to the top/bottom of the file.",
                control: {
                    type: "toggle",
                    key: "scrollButtonsEnabled",
                    defaultValue: false,
                },
                onChange: (): void => {
                    this.setup();
                },
            },
            {
                name: "Button position",
                desc: "Moves the buttons in the note.",
                control: {
                    type: "dropdown",
                    key: "scrollButtonsPosition",
                    defaultValue: "top",
                    options: {
                        top: "Top",
                        bottom: "Bottom",
                    },
                    disabled: (): boolean => {
                        return this.plugin.settings.scrollButtonsEnabled === false;
                    }
                },
                onChange: (): void => {
                    this.setup();
                },
            },
        ],
    } as const satisfies FeatureSettingsDefinition;

    private plugin!: ScrollingPlugin;
    private leaves: Set<WorkspaceLeaf> = new Set();
    private buttonContainers: Set<HTMLElement> = new Set();

    public onload(plugin: ScrollingPlugin): void {
        this.plugin = plugin;
        this.plugin.events.onLayoutReady(this.setup.bind(this));
        this.plugin.events.onLeafChange(this.leafChangeHandler.bind(this));
    }

    public onunload(): void {
        this.cleanup();
    }

    public setup(): void {
        this.clearButtons();

        if (!this.plugin.settings.scrollButtonsEnabled) {
            return;
        }

        if (this.plugin.settings.scrollButtonsPosition === "top") {
            this.plugin.enableStyleClass("scrolling-overlay-buttons-top");
        } else {
            this.plugin.disableStyleClass("scrolling-overlay-buttons-top");
        }

        this.plugin.app.workspace.iterateRootLeaves((leaf) => {
            this.initLeaf(leaf);
        });
    }

    private leafChangeHandler(view: MarkdownView): void {
        if (!this.plugin.settings.scrollButtonsEnabled) {
            return;
        }

        if (view.leaf) {
            this.initLeaf(view.leaf);
            return;
        }

        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.leaf) {
            this.initLeaf(activeView.leaf);
        }
    }

    private initLeaf(leaf: WorkspaceLeaf): void {
        if (!(leaf.view instanceof MarkdownView)) {
            return;
        }

        if (!this.leaves.has(leaf)) {
            this.leaves.add(leaf);
            this.initView(leaf.view);
        }
    }

    private initView(view: MarkdownView): void {
        const buttonContainer = view.containerEl.createDiv({
            cls: "scrolling-overlay-button-container",
        });
        this.buttonContainers.add(buttonContainer);

        this.createButton(buttonContainer, "arrow-up", this.scrollToTop.bind(this, view));
        this.createButton(buttonContainer, "arrow-down", this.scrollToBottom.bind(this, view));
    }

    private createButton(buttonContainer: Element, icon: string, callback: () => void): void {
        const button = buttonContainer.createEl("button", { cls: "scrolling-overlay-button" });
        button.addEventListener("click", callback);
        setIcon(button, icon);
    }

    private scrollToTop(view: MarkdownView): void {
        this.scrollTo(view, 0);
    }

    private scrollToBottom(view: MarkdownView): void {
        this.scrollTo(view, 1000000000);
    }

    private scrollTo(view: MarkdownView, pos: number): void {
        if (view.getMode() === "source") {
            view.currentMode.applyScroll(pos);
        } else {
            const scroller = view.contentEl.getElementsByClassName("markdown-preview-view")[0];
            if (scroller) {
                scroller.scrollTo({ top: pos });
                window.requestAnimationFrame(() => {
                    scroller.scrollTo({ top: pos });
                });
            }
        }
    }

    private clearButtons(): void {
        for (const leaf of this.leaves) {
            if (leaf.view && leaf.view.containerEl) {
                const containers = leaf.view.containerEl.findAll(
                    ".scrolling-overlay-button-container",
                );
                for (const el of containers) {
                    el.remove();
                }
            }
        }
        this.leaves.clear();

        for (const container of this.buttonContainers) {
            container.remove();
        }
        this.buttonContainers.clear();
    }

    private cleanup(): void {
        this.clearButtons();
        this.plugin.disableStyleClass("scrolling-overlay-buttons-top");
    }
}
