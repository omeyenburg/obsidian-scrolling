import { Platform } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

export class LineWidth {
    private readonly plugin: ScrollingPlugin;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;
        this.updateLineWidth();
    }

    public updateLineWidth(): void {
        if (Platform.isMobile) return;

        if (
            this.plugin.settings.lineWidthMode === "disabled" ||
            this.isReadableLineWidthEnabled()
        ) {
            document.body.removeClass("scrolling-line-width-enabled");
        } else if (this.plugin.settings.lineWidthMode === "percentage") {
            const lineWidth = this.plugin.settings.lineWidthPercentage;
            document.body.addClass("scrolling-line-width-enabled");
            document.body.style.setProperty("--scrolling-line-width", `${lineWidth}%`);
        } else {
            const lineWidth = this.plugin.settings.lineWidthCharacters;
            document.body.addClass("scrolling-line-width-enabled");
            document.body.style.setProperty("--scrolling-line-width", `${lineWidth}ch`);
        }
    }

    public isReadableLineWidthEnabled() {
        const sourceEl = document.querySelector(".markdown-source-view") as HTMLElement;
        const readingEl = document.querySelector(".markdown-reading-view") as HTMLElement;

        return (
            sourceEl?.classList.contains("is-readable-line-width") ||
            readingEl?.classList.contains("is-readable-line-width")
        );
    }
}
