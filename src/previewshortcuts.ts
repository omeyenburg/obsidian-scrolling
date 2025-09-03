import { MarkdownView } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

function getLineHeight() {
    const cssFontSize = document.body.getCssPropertyValue("--font-text-size");
    const charHeight = Number.parseInt(cssFontSize) || 16;
    return charHeight * 1.5;
}

export class PreviewShortcuts {
    private plugin: ScrollingPlugin;
    private scroller: Element | null = null;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;
    }

    public keyUpHandler() {
        this.goal = null;
    }

    public keyDownHandler(event: KeyboardEvent) {
        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || view.getMode() !== "preview") return;

        this.scroller = view.contentEl.getElementsByClassName("markdown-preview-view")[0];
        if (!this.scroller) return;

        if (event.ctrlKey) {
            switch (event.key) {
                case "u":
                    this.scrollHalfPage(-1);
                    break;
                case "d":
                    this.scrollHalfPage(1);
                    break;
                default:
                    this.goal = null;
            }
        } else {
            switch (event.key) {
                case "k":
                    this.scrollLine(-1);
                    break;
                case "j":
                    this.scrollLine(1);
                    break;
                case "g":
                    this.scrollToTop();
                    break;
                case "G":
                    this.scrollToBottom();
                    break;
                default:
                    this.goal = null;
            }
        }
    }

    private scrollHalfPage(direction: -1 | 1) {
        this.scroller.scrollBy({ top: (this.scroller.clientHeight * direction) / 2 });
    }

    private goal = null;
    private scrollLine(direction: -1 | 1) {
        if (this.goal !== null) {
            this.scroller.scrollTo({ top: this.goal });
        }

        const change = getLineHeight() * direction;
        this.goal = this.scroller.scrollTop + change;
        this.scroller.scrollBy({ top: change, behavior: "smooth" });
    }

    private scrollToTop() {
        this.scroller.scrollTo({ top: 0 });
    }

    private scrollToBottom() {
        this.scroller.scrollTo({ top: 1000000000 });
    }
}
