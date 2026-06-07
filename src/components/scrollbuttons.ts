import { MarkdownView, WorkspaceLeaf, setIcon } from "obsidian";

import type { default as ScrollingPlugin } from "@core/main";

export class ScrollButtons {
    private plugin: ScrollingPlugin;

    private leaves: Set<WorkspaceLeaf> = new Set();

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        plugin.events.onLayoutReady(this.layoutReadyHandler.bind(this));
        plugin.events.onLeafChange(this.leafChangeHandler.bind(this));
    }

    private layoutReadyHandler(): void {
        this.plugin.app.workspace.iterateRootLeaves((leaf) => {
            this.initLeaf(leaf);
        });
    }

    private leafChangeHandler(view: MarkdownView): void {
        if (view.leaf) {
            this.initLeaf(view.leaf);
            return;
        }

        view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (view && view.leaf) {
            this.initLeaf(view.leaf);
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
        let buttonContainer = view.containerEl.createDiv({
            attr: { id: "scrolling-overlay-button-container" },
        });

        this.createButton(buttonContainer, "arrow-up", this.scrollToTop.bind(this, view));
        this.createButton(buttonContainer, "arrow-down", this.scrollToBottom.bind(this, view));

        this.plugin.events.onUnload(() => {
            buttonContainer.remove();
        });
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
        switch (view.getMode()) {
            case "source":
                view.currentMode.applyScroll(pos);
                break;
            case "preview":
                let scroller = view.contentEl.getElementsByClassName("markdown-preview-view")[0];
                scroller.scrollTo({ top: pos });
                window.requestAnimationFrame(() => {
                    scroller.scrollTo({ top: pos });
                })
                break;
        }
    }
}
