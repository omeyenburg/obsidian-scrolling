import { MarkdownView, TFile } from "obsidian";
import type { default as ScrollingPlugin } from "./main";

// NOTE: line and ch are not yet used, seems to work fine already without
export interface PositionData {
    line: number;
    ch: number;
    scrollTop: number;
}

export class RestoreScroll {
    private plugin: ScrollingPlugin;

    private recentLeafChange: boolean;
    private recentFileOpenEvent = false;
    private positions: Map<string, PositionData> = new Map();
    private leafChangeTimeout: number;

    private static readonly LEAF_CHANGE_DEBOUNCE_MS = 500;
    private static readonly SCROLL_RETRY_LIMIT = 25;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        plugin.registerEvent(plugin.app.workspace.on("file-open", this.fileHandler.bind(this)));
        plugin.registerEvent(
            plugin.app.workspace.on("active-leaf-change", this.leafHandler.bind(this)),
        );
    }

    private leafHandler(): void {
        window.clearTimeout(this.leafChangeTimeout);

        this.recentLeafChange = true;
        this.leafChangeTimeout = window.setTimeout(() => {
            this.recentLeafChange = false;
            // if (container) container.style.visibility = "visible";
        }, RestoreScroll.LEAF_CHANGE_DEBOUNCE_MS);
    }

    private fileHandler(file: TFile | null): void {
        if (!file) return;

        const markdownView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!markdownView) return;

        const lastPosition = this.positions.get(file.path);
        if (!lastPosition) return;

        // Query last position.
        // No need to scroll if dest is zero.
        const dest = lastPosition.scrollTop;
        if (!dest) return;

        const editor = markdownView.editor;

        // If scrollTop is 0, assume that file is already loaded.
        if (editor.cm.scrollDOM.scrollTop == 0) {
            editor.cm.scrollDOM.scrollTop = dest;
            return;
        }

        this.recentFileOpenEvent = true;

        // Hide until scrolling is finished
        const container = markdownView.leaf.view.containerEl;
        container.style.visibility = "hidden";

        // Scroll to dest and wait until obsidian overrides it (dest != zero).
        editor.cm.scrollDOM.scrollTop = dest;

        let i = 0;
        const scroll = () => {
            if (i++ < RestoreScroll.SCROLL_RETRY_LIMIT && editor.cm.scrollDOM.scrollTop != 0) {
                editor.cm.scrollDOM.scrollTop = dest;
                window.requestAnimationFrame(scroll);
            } else {
                editor.cm.scrollDOM.scrollTop = dest;
                container.style.visibility = "visible";

                window.requestAnimationFrame(() => {
                    this.recentFileOpenEvent = false;
                });
            }
        };
        scroll();
    }

    // Invoked on cursor movement and mouse scroll.
    public saveScrollPosition() {
        const activeEditor = this.plugin.app.workspace.activeEditor;
        const editor = activeEditor?.editor;
        const file = activeEditor?.file;

        // Defer saving for 500 ms to prevent interference with opening files
        window.setTimeout(() => {
            if (
                !file ||
                !editor ||
                this.recentLeafChange ||
                this.recentFileOpenEvent ||
                this.plugin.app.workspace.activeEditor?.file != file
            )
                return;

            const cursor = editor.getCursor();
            const scrollInfo = editor.getScrollInfo();

            this.positions.set(file.path, {
                line: cursor.line,
                ch: cursor.ch,
                scrollTop: scrollInfo.top,
            });
        }, 500);
    }
}
