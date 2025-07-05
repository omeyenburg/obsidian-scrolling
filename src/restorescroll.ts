import { MarkdownView, WorkspaceLeaf } from "obsidian";
import { default as ScrollingPlugin } from "./main";
import { around } from "monkey-around";

export class RestoreScroll {
    private plugin: ScrollingPlugin;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        plugin.register(
            around(WorkspaceLeaf.prototype, {
                setViewState(old) {
                    return async function (...args) {
                        const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
                        if (!view || !plugin.settings.restoreScrollEnabled) {
                            return await old.apply(this, args);
                        }

                        // Hide content until scrolling is done.
                        const content = view.leaf.view.containerEl;
                        content.style.visibility = "hidden";

                        const result = await old.apply(this, args);

                        // File is available after old.apply was called.
                        if (!view.file) {
                            content.style.visibility = "visible";
                            return result;
                        }

                        // Query last position
                        const dest = plugin.settings.restoreScrollPositions[view.file.path];

                        // No need to scroll if dest is zero.
                        if (!dest) {
                            content.style.visibility = "visible";
                            return result;
                        }

                        let scroller: HTMLElement;
                        if (view.getMode() === "preview") {
                            scroller = view.containerEl.querySelector(
                                ".markdown-preview-view",
                            ) as HTMLElement;
                            if (!scroller) {
                                content.style.visibility = "visible";
                                return result;
                            }
                        } else {
                            scroller = view.editor.cm.scrollDOM;
                        }

                        let iterations = 0;
                        const scroll = () => {
                            if (
                                iterations++ < 10 &&
                                scroller.scrollHeight == scroller.clientHeight
                            ) {
                                window.requestAnimationFrame(scroll);
                                return;
                            }

                            scroller.scrollTop = dest;
                            content.style.visibility = "visible";
                        };
                        scroll();

                        return result;
                    };
                },
            }),
        );
    }

    // Invoked on cursor movement and mouse scroll.
    public saveScrollPosition() {
        if (!this.plugin.settings.restoreScrollEnabled) return;

        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || !view.file) return;

        if (this.plugin.app.workspace.activeEditor?.file != view.file) return;

        let scrollTop;

        if (view.getMode() === "source") {
            scrollTop = view.editor.getScrollInfo().top;
        } else {
            scrollTop = view.containerEl.querySelector(".markdown-preview-view")?.scrollTop;
        }

        // const cursor = editor.getCursor();
        if (scrollTop) {
            this.plugin.settings.restoreScrollPositions[view.file.path] = scrollTop;
        }
    }
}
