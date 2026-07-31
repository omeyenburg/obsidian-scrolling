import { Platform } from "obsidian";

import type { default as ScrollingPlugin } from "@core/main";

export class Scrollbar {
    private readonly plugin: ScrollingPlugin;

    private scrollTimeouts = new Map<HTMLElement, number>();

    private readonly SCROLLBAR_IDLE_TIMEOUT = 1000;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        this.updateStyle();
        plugin.register(this.cleanup.bind(this));

        plugin.events.onScroll(this.scrollHandler.bind(this));
    }

    private scrollHandler(event: Event): void {
        this.showScrollbarTemporary(event);
    }

    public updateStyle(): void {
        // Styling scrollbars doesnt work on MacOS.
        if (Platform.isMacOS) return;

        this.setVisibility(this.plugin.settings.scrollbarVisibility);

        // Default width on Linux (Desktop) appears to be 12px.
        // Only Linux supports this option. Android does support this, but has different defaults.
        if (Platform.isLinux && Platform.isDesktop) {
            this.setWidth(this.plugin.settings.scrollbarWidth);
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

    private setVisibility(visibility: string): void {
        if (visibility === "hide") {
            this.plugin.disableStyleClass("scrolling-visibility-scroll");
            this.plugin.enableStyleClass("scrolling-visibility-hide");
        } else if (visibility === "scroll") {
            this.plugin.disableStyleClass("scrolling-visibility-hide");
            this.plugin.enableStyleClass("scrolling-visibility-scroll");
        } else {
            this.plugin.disableStyleClass("scrolling-visibility-scroll");
            this.plugin.disableStyleClass("scrolling-visibility-hide");
        }
    }

    private setWidth(width: number) {
        if (width >= 0) {
            this.plugin.enableStyleClass("scrolling-scrollbar-width");
            this.plugin.setStyleProperty("--scrolling-scrollbar-width", `${width}px`);
        } else {
            this.plugin.disableStyleClass("scrolling-scrollbar-width");
        }
    }

    private cleanup(): void {
        this.plugin.disableStyleClass([
            "scrolling-scrollbar-width",
            "scrolling-visibility-hide",
            "scrolling-visibility-scroll",
        ]);

        this.plugin.removeStyleProperty("--scrolling-scrollbar-width");
    }
}
