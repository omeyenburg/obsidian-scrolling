import { Platform } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

function setVisibility(visibility: string): void {
    if (visibility === "hide") {
        document.body.removeClass("scrolling-visibility-scroll");
        document.body.addClass("scrolling-visibility-hide");
    } else if (visibility === "scroll") {
        document.body.removeClass("scrolling-visibility-hide");
        document.body.addClass("scrolling-visibility-scroll");
    } else {
        document.body.removeClass("scrolling-visibility-scroll");
        document.body.removeClass("scrolling-visibility-hide");
    }
}

function setWidth(width: number) {
    if (width >= 0) {
        document.body.addClass("scrolling-scrollbar-width");
        document.body.style.setProperty("--scrolling-scrollbar-width", `${width}px`);
    } else {
        document.body.removeClass("scrolling-scrollbar-width");
    }
}

function cleanup(): void {
    document.body.removeClasses([
        "scrolling-scrollbar-width",
        "scrolling-visibility-hide",
        "scrolling-visibility-scroll",
    ]);

    document.body.style.removeProperty("--scrolling-scrollbar-width");
}

export class Scrollbar {
    private readonly plugin: ScrollingPlugin;

    private scrollTimeouts = new Map<HTMLElement, number>();

    private readonly SCROLLBAR_IDLE_TIMEOUT = 1000;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;
        this.updateStyle();
        plugin.register(cleanup);
    }

    public scrollHandler(event: Event): void {
        this.showScrollbarTemporary(event);
    }

    public updateStyle(): void {
        // Styling scrollbars doesnt work on MacOS.
        if (Platform.isMacOS) return;

        setVisibility(this.plugin.settings.scrollbarVisibility);

        // Default width on Linux (Desktop) appears to be 12px.
        // Only Linux supports this option. Android does support this, but has different defaults.
        if (Platform.isLinux && Platform.isDesktop) {
            setWidth(this.plugin.settings.scrollbarWidth);
        }
    }

    private showScrollbarTemporary(event: Event) {
        // Scrollbars styling doesnt work on MacOS.
        if (Platform.isMacOS) return;
        if (this.plugin.settings.scrollbarVisibility != "scroll") return;

        const el = event.target as HTMLElement;
        if (!el) return;

        // Update timeout
        const existingTimeout = this.scrollTimeouts.get(el);
        if (existingTimeout) {
            window.clearTimeout(existingTimeout);
        }

        // Show scrollbar on target element
        el.classList.add("scrolling-show-temporary");

        // Hide scrollbar after delay
        const timeoutId = window.setTimeout(
            () => this.hideScrollbarTemporary(el),
            this.SCROLLBAR_IDLE_TIMEOUT,
        );
        this.scrollTimeouts.set(el, timeoutId);
    }

    private hideScrollbarTemporary(el: HTMLElement) {
        el.classList.remove("scrolling-show-temporary");
        this.scrollTimeouts.delete(el);
    }
}
