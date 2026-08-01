import { Platform } from "obsidian";
import type { Feature } from "@core/Feature";
import type { default as ScrollingPlugin } from "@core/main";
import type { ScrollingPluginSettings } from "@core/settings";

export class ScrollbarFeature implements Feature {
    public readonly id = "scrollbar";
    private plugin!: ScrollingPlugin;
    private scrollTimeouts = new Map<HTMLElement, number>();
    private readonly SCROLLBAR_IDLE_TIMEOUT = 1000;

    public onload(plugin: ScrollingPlugin): void {
        this.plugin = plugin;
        this.updateStyle();

        this.plugin.events.onScroll(this.scrollHandler.bind(this));
    }

    public onunload(): void {
        this.cleanup();
    }

    public onSettingsChange(settings: ScrollingPluginSettings): void {
        this.updateStyle();
    }

    private scrollHandler(event: Event): void {
        this.showScrollbarTemporary(event);
    }

    public updateStyle(): void {
        if (Platform.isMacOS) return;

        this.setVisibility(this.plugin.settings.scrollbarVisibility);

        if (Platform.isLinux && Platform.isDesktop) {
            this.setWidth(this.plugin.settings.scrollbarWidth);
        }
    }

    private showScrollbarTemporary(event: Event) {
        if (Platform.isMacOS) return;
        if (this.plugin.settings.scrollbarVisibility !== "scroll") return;

        const el = event.target as HTMLElement;
        if (!el) return;

        const existingTimeout = this.scrollTimeouts.get(el);
        if (existingTimeout) {
            window.clearTimeout(existingTimeout);
        }

        el.classList.add("scrolling-show-temporary");

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

        for (const timeoutId of this.scrollTimeouts.values()) {
            window.clearTimeout(timeoutId);
        }
        this.scrollTimeouts.clear();
    }
}
