import { ViewUpdate } from "@codemirror/view";

import type { default as ScrollingPlugin } from "./main";

export class CursorScroll {
    private readonly plugin: ScrollingPlugin;

    private skip = false;
    private skipReset: number;
    private relativeLineOffset: number | null = null;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;
    }

    public cursorHandler(update: ViewUpdate) {
        if (this.skip) {
            return;
        }
        const cm = update.view;
        const head = update.state.selection.main.head;
        const block = cm.lineBlockAt(head);

        // Store the offset from the scroll top
        this.relativeLineOffset = block.top - cm.scrollDOM.scrollTop;
    }

    public wheelHandler() {
        if (!this.plugin.settings.cursorScrollEnabled) return
        if (this.relativeLineOffset == null) return;
        const cm = this.plugin.app.workspace.activeEditor.editor.cm;

        const targetTop = cm.scrollDOM.scrollTop + this.relativeLineOffset;
        const targetBlock = cm.lineBlockAtHeight(targetTop);

        const targetPos = targetBlock.from;
        this.skip = true

        // todo: rather use this obs- builtin
        window.clearTimeout(this.skipReset)
        this.skipReset = window.setTimeout(() => this.skip = false, 100)
        cm.dispatch({ selection: { anchor: targetPos } });
    }
}
