import { Platform } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

function applyStyle(visibility: string, width: number): void {
    if (visibility === "hide") {
        document.body.addClass("scrolling-visibility-hide");
    } else if (visibility === "scroll") {
        document.body.addClass("scrolling-visibility-scroll");
    }

    if (width >= 0) {
        document.body.addClass("scrolling-scrollbar-width");
        document.body.style.setProperty("--scrolling-scrollbar-width", `${width}px`);
    }
}

function cleanup(): void {
    document.body.removeClasses([
        "scrolling-scrollbar-width",
        "scrolling-visibility-hide",
        "scrolling-visibility-scroll",
        "scrolling-filetree-horizontal",
    ]);

    document.body.style.removeProperty("--scrolling-scrollbar-width");
}

export class Scrollbar {
    private readonly plugin: ScrollingPlugin;

    private currentWidth = 0;
    private currentVisibility = "";
    private scrollTimeouts = new Map<HTMLElement, number>();

    private readonly SCROLLBAR_IDLE_TIMEOUT = 500;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;
        this.updateStyle();
        plugin.register(cleanup);
    }

    public registerScrollbar(scroller: HTMLElement): void {
        scroller.classList.add("scrolling-transparent");
    }

    public scrollHandler(event: Event): void {
        this.showScrollbarTemporary(event);
    }

    public updateStyle(): void {
        // Styling scrollbars doesnt work on MacOS.
        if (Platform.isMacOS || !Platform.isDesktop) return;

        const visibility = this.plugin.settings.scrollbarVisibility;

        // Default width appears to be 12px.
        // Only linux supports this option, set to -1 to ignore width.
        const width = Platform.isLinux ? this.plugin.settings.scrollbarWidth : -1;

        // Only proceed if state changed.
        if (this.currentWidth == width && this.currentVisibility == visibility) return;
        this.currentWidth = width;
        this.currentVisibility = visibility;

        cleanup();
        applyStyle(visibility, width);
    }

    private showScrollbarTemporary(event: Event) {
        // Scrollbars styling doesnt work on MacOS.
        if (Platform.isMacOS) return;
        if (this.plugin.settings.scrollbarVisibility != "scroll") return;

        const el = event.currentTarget as HTMLElement;
        if (!el) return;

        // Update timeout
        const existingTimeout = this.scrollTimeouts.get(el);
        if (existingTimeout) {
            window.clearTimeout(existingTimeout);
        }

        // Show scrollbar on target element
        el.classList.remove("scrolling-transparent");

        // Hide scrollbar after delay
        const timeoutId = window.setTimeout(
            () => this.hideScrollbarTemporary(el),
            this.SCROLLBAR_IDLE_TIMEOUT,
        );
        this.scrollTimeouts.set(el, timeoutId);
    }

    private hideScrollbarTemporary(el: HTMLElement) {
        el.classList.add("scrolling-transparent");
        this.scrollTimeouts.delete(el);
    }
}
