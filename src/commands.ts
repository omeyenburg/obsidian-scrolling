import { MarkdownView } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

export function setupCommands(plugin: ScrollingPlugin): void {
    plugin.addCommand({
        id: "scroll-to-top",
        name: "to top",
        callback: scrollCallbackWrapper(plugin, scrollToTop),
    });

    plugin.addCommand({
        id: "scroll-to-bottom",
        name: "to bottom",
        callback: scrollCallbackWrapper(plugin, scrollToBottom),
    });
}

function scrollCallbackWrapper(plugin: ScrollingPlugin, func: (el: Element) => void) {
    return () => {
        const view = plugin.app.workspace.getActiveFileView();
        if (!view) return false;

        let scroller: Element;
        switch (view.getViewType()) {
            case "pdf":
                scroller = view.contentEl.getElementsByClassName("pdf-viewer-container")[0];
                break;
            case "image":
                scroller = view.contentEl.getElementsByClassName("view-content")[0];
                break;
            case "markdown":
                if ((view as MarkdownView).getMode() === "source") {
                    scroller = (view as MarkdownView).editor.cm.scrollDOM;
                } else {
                    scroller = view.contentEl.getElementsByClassName("markdown-preview-view")[0];
                }
                break;
            default:
                return;
        }

        func(scroller);
    };
}

function scrollToTop(el: Element) {
    el.scrollTo({ top: 0 });
}

function scrollToBottom(el: Element) {
    el.scrollTo({ top: 99999999999 });
}
