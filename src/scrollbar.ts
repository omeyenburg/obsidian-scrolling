import type { default as ScrollingPlugin } from "./main";
import { Platform } from "obsidian";

export class Scrollbar {
    plugin: ScrollingPlugin;

    private scrolling = false;
    private scrollTimeout: NodeJS.Timeout;

    constructor(plugin: ScrollingPlugin) {
        // Styling scrollbars doesnt work on MacOS.
        if (Platform.isMacOS) return;

        this.plugin = plugin;
        this.updateStyle();

        plugin.registerDomEvent(document, "wheel", this.scrollHandler.bind(this));
    }

    private scrollHandler(): void {
        clearTimeout(this.scrollTimeout);

        if (!this.scrolling) {
            this.scrolling = true;
            this.updateStyle();
        }

        // Hide scrollbar again after 500 ms.
        this.scrollTimeout = setTimeout(() => {
            this.scrolling = false;
            this.updateStyle();
        }, 500);
    }

    updateStyle(): void {
        // Styling scrollbars doesnt work on MacOS.
        if (Platform.isMacOS) return;

        this.removeStyle();

        const style = document.createElement("style");
        style.id = "scrolling-scrollbar-style";
        const global = this.plugin.settings.scrollbarGlobal;

        let display: string | undefined;
        let color: string | undefined;

        const visibility = this.plugin.settings.scrollbarVisibility;
        if (visibility == "hide") {
            display = "none";
        } else if (visibility == "scroll" && !this.scrolling) {
            color = "transparent";
        }

        // Default width of Obsidian appears to be 12px.
        // Only linux supports this option, set to -1 to ignore width.
        const width = Platform.isLinux ? this.plugin.settings.scrollbarWidth : -1;
        if (width == 0) {
            display = "none";
        }

        if (global) {
            style.textContent = `\
* {\
  ${width > 0 ? `scrollbar-width: ${width}px !important;` : ""}\
  ${display !== undefined ? `-ms-overflow-style: ${display};` : ""}\
}\
*::-webkit-scrollbar {\
  ${width > 0 ? `width: ${width}px !important;` : ""}\
  ${display !== undefined ? `display: ${display};` : ""}\
}\
*::-webkit-scrollbar-thumb {\
  ${color !== undefined ? `background-color: ${color} !important;` : ""}\
}`;
        } else {
            style.textContent = `\
.markdown-source-view,\
.cm-scroller {\
  ${width > 0 ? `scrollbar-width: ${width}px !important;` : ""}\
  ${display !== undefined ? `-ms-overflow-style: ${display};` : ""}\
}\
.markdown-source-view::-webkit-scrollbar,\
.cm-scroller::-webkit-scrollbar {\
  ${width > 0 ? `width: ${width}px !important;` : ""}\
  ${display !== undefined ? `display: ${display};` : ""}\
}\
.markdown-source-view::-webkit-scrollbar-thumb,\
.cm-scroller::-webkit-scrollbar-thumb {\
  ${color !== undefined ? `background-color: ${color} !important;` : ""}\
}`;
        }

        document.head.appendChild(style);
    }

    removeStyle(): void {
        document.getElementById("scrolling-scrollbar-style")?.remove();
    }
}
