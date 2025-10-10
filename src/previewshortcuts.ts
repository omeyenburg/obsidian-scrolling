import { MarkdownView, Platform, Editor } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

function getLineHeight() {
    const cssFontSize = document.body.getCssPropertyValue("--font-text-size");
    const charHeight = Number.parseInt(cssFontSize) || 16;
    return charHeight * 1.5;
}

export class PreviewShortcuts {
    private plugin: ScrollingPlugin;

    private goal: number | null = null;
    private scroller: Element | null = null;

    private lastKeyPress = 0;
    private animationFrame: number;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;
    }

    /**
     * On key up event.
     * Resets goal for line scroll animation.
     */
    public keyUpHandler() {
        this.goal = null;
    }

    /**
     * On key down event.
     * Handles specific vim motion keys and scrolls.
     */
    public keyDownHandler(event: KeyboardEvent) {
        if (Platform.isMobile) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;

        // Only scroll in preview mode
        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || view.getMode() !== "preview") return;

        // Only scroll if editor is in focus
        const modal = document.body.getElementsByClassName("mod-dim");
        if (modal.length != 0 || document.activeElement !== document.body) return;

        this.scroller = view.contentEl.getElementsByClassName("markdown-preview-view")[0];
        if (!this.scroller) return;

        const now = event.timeStamp;
        const deltaTime = now - this.lastKeyPress;
        this.lastKeyPress = now;

        switch (event.key) {
            case "k":
                this.scrollLine(-1, deltaTime);
                break;
            case "j":
                this.scrollLine(1, deltaTime);
                break;
            case "u":
                this.scrollHalfPage(-1);
                break;
            case "d":
                this.scrollHalfPage(1);
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

    private scrollHalfPage(direction: -1 | 1) {
        this.scroller.scrollBy({ top: (this.scroller.clientHeight * direction) / 2 });
    }

    private scrollLine(direction: -1 | 1, deltaTime: number) {
        if (this.goal !== null) {
            this.scroller.scrollTo({ top: this.goal });
        }

        const deltaTimeNormalization = deltaTime < 200 ? deltaTime * 0.02 : 1;
        const change = getLineHeight() * direction * deltaTimeNormalization;
        this.goal = this.scroller.scrollTop + change;

        const steps = 5;
        window.cancelAnimationFrame(this.animationFrame);
        this.animateScrollLine(this.goal, change / steps, steps);
    }

    private animateScrollLine(goal: number, stepSize: number, step: number): void {
        if (step <= 0) return;

        this.scroller.scrollTo({ top: goal - stepSize * (step - 1) });
        this.animationFrame = window.requestAnimationFrame(() =>
            this.animateScrollLine(goal, stepSize, step - 1),
        );
    }

    private scrollToTop() {
        this.scroller.scrollTo({ top: 0 });
    }

    private scrollToBottom() {
        this.scroller.scrollTo({ top: 1000000000 });
    }
}
