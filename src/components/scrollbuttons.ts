import { MarkdownView, setIcon } from "obsidian";

import type { default as ScrollingPlugin } from "@core/main";

function getButtonContainer(): Element | null {
    let containers = document.getElementsByClassName(
        "workspace-tabs mod-top mod-top-left-space mod-top-right-space",
    );
    if (containers.length != 1) return null;
    return containers.item(0);
}

export class ScrollButtons {
    private plugin: ScrollingPlugin;

    private buttonContainer: HTMLDivElement;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        // plugin.events.onLeafChange(this.leafChangeHandler.bind(this));

        plugin.events.onLayoutReady(this.layoutReadyHandler.bind(this));
    }

    private layoutReadyHandler() {
        this.buttonContainer = getButtonContainer().createEl("div", {
            attr: { id: "scrolling-overlay-button" },
        });

        this.createButton("arrow-up", this.scrollToTop.bind(this));
        this.createButton("arrow-down", this.scrollToBottom.bind(this));

        this.plugin.events.onUnload(() => {
            this.buttonContainer.remove();
        });
    }

    private createButton(icon: string, callback: () => any) {
        let button = this.buttonContainer.createEl("button");
        button.addEventListener("click", callback);

        button.style.display = "none";
        window.setTimeout(() => (button.style.display = "block"), 100);

        setIcon(button, icon);
    }

    // private leafChangeHandler(view: MarkdownView) {
    //     this.plugin.app.workspace.iterateRootLeaves((leaf) => {
    //         if ((leaf as any)._empty?._loaded == false) {
    //             console.log("bad");
    //         }
    //     });
    // }

    private scrollToTop() {
        this.scrollTo(0);
    }

    private scrollToBottom() {
        this.scrollTo(Infinity);
    }

    private scrollTo(pos: number) {
        let view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
            view.currentMode.applyScroll(pos);
        }
    }
}
