import { MarkdownView, Platform } from "obsidian";
import type { Feature, FeatureSettingsDefinition, ScrollingPlugin } from "@core/Feature";

export class ReadingModeShortcutsFeature implements Feature {
    public readonly settings = {
        heading: "Reading mode shortcuts",
        visible: (): boolean => !Platform.isMobile,
        items: [
            {
                name: "Single line scroll shortcuts",
                desc: "Scroll by single lines with j/k.",
                control: {
                    type: "toggle",
                    key: "readingLineScrollEnabled",
                    defaultValue: true,
                },
            },
            {
                name: "Half page scroll shortcuts",
                desc: "Scroll half pages with d/u.",
                control: {
                    type: "toggle",
                    key: "readingHalfPageScrollEnabled",
                    defaultValue: true,
                },
            },
            {
                name: "Top/bottom scroll shortcuts",
                desc: "Scroll to top/bottom with g/G.",
                control: {
                    type: "toggle",
                    key: "readingTopBottomScrollEnabled",
                    defaultValue: true,
                },
            },
        ],
    } as const satisfies FeatureSettingsDefinition;

    private plugin!: ScrollingPlugin;

    private goal: number | null = null;
    private scroller: Element | null = null;

    private lastKeyPress = 0;
    private animationFrame: number;

    public onload(plugin: ScrollingPlugin): void {
        this.plugin = plugin;

        this.plugin.events.onKeyUp(this.keyUpHandler.bind(this));
        this.plugin.events.onKeyDown(this.keyDownHandler.bind(this));
    }

    public onunload(): void {
        window.cancelAnimationFrame(this.animationFrame);
    }

    private keyUpHandler() {
        this.goal = null;
    }

    private keyDownHandler(event: KeyboardEvent) {
        if (Platform.isMobile) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;

        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || view.getMode() !== "preview") return;

        const modal = activeDocument.body.getElementsByClassName("mod-dim");
        if (modal.length !== 0) return;

        this.scroller = view.contentEl.getElementsByClassName("markdown-preview-view")[0];
        if (!this.scroller) return;

        if (
            activeDocument.activeElement !== activeDocument.body &&
            activeDocument.activeElement !== this.scroller
        )
            return;

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

    private scrollLine(direction: -1 | 1, deltaTime: number) {
        if (!this.plugin.settings.readingLineScrollEnabled) return;

        if (this.goal !== null) {
            this.scroller.scrollTo({ top: this.goal });
        }

        const deltaTimeNormalization = deltaTime < 200 ? deltaTime * 0.02 : 1;
        const change = this.getLineHeight() * direction * deltaTimeNormalization;
        this.goal = this.scroller.scrollTop + change;

        const steps = 5;
        window.cancelAnimationFrame(this.animationFrame);
        this.animateScrollLine(this.goal, change / steps, steps);
    }

    private scrollHalfPage(direction: -1 | 1) {
        if (!this.plugin.settings.readingHalfPageScrollEnabled) return;

        const change = (this.scroller.clientHeight * direction) / 2;
        const goal = this.scroller.scrollTop + change;

        const steps = 5;
        this.animateScrollLine(goal, change / steps, steps);
    }

    private scrollToTop() {
        if (!this.plugin.settings.readingTopBottomScrollEnabled) return;

        this.scroller.scrollTo({ top: 0 });
    }

    private scrollToBottom() {
        if (!this.plugin.settings.readingTopBottomScrollEnabled) return;

        this.scroller.scrollTo({ top: 1000000000 });
        window.requestAnimationFrame(() => {
            if (this.scroller) {
                this.scroller.scrollTo({ top: 1000000000 });
            }
        });
    }

    private animateScrollLine(goal: number, stepSize: number, step: number): void {
        if (step <= 0) return;

        this.scroller.scrollTo({ top: goal - stepSize * (step - 1) });
        this.animationFrame = window.requestAnimationFrame(() =>
            this.animateScrollLine(goal, stepSize, step - 1),
        );
    }

    private getLineHeight() {
        const cssFontSize = this.plugin.getMainDoc().body.getCssPropertyValue("--font-text-size");
        const charHeight = Number.parseInt(cssFontSize) || 16;
        return charHeight * 1.5;
    }
}
