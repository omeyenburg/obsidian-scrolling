import { Plugin, Editor, MarkdownView } from "obsidian";


export default class ScrollingPlugin extends Plugin {
    // prev_line: any;
    editing: boolean;
    mousedown: boolean;
    mouseup: boolean;
    last_selectionchange: number;
    smoothscroll_timeout: any;

    async onload() {
        // this.prev_line = -1;

        // Callbacks for markdown changes and cursor movements
        // Will be automatically deleted on reload
        this.registerEvent(this.app.workspace.on("editor-change", (editor) => this.edit_callback(editor)));

        // this is invoked on mouse down (selection start), editing as well, wrapping/layout changes due to stuff expanding while hovering on a line with cursor
        this.registerDomEvent(document, "selectionchange", () => this.selectionchange_callback());
        this.registerDomEvent(document, "mousedown", () => this.mousedown_callback());
        this.registerDomEvent(document, "mouseup", () => this.mouseup_callback());

        console.log("ScrollingPlugin loaded");
    }

    async onunload() {
        console.log("ScrollingPlugin unloaded");
    }

    edit_callback(editor: Editor) {
        this.editing = true;
        this.scroll(editor);
    }

    mousedown_callback() {
        this.mousedown = true;
    }

    mouseup_callback() {
        this.mousedown = false;
        this.mouseup = true;
    }

    selectionchange_callback() {
        // selectionchange will also be invoked with mouse actions; this prevents further actions.
        // maybe expose as a setting.
        if (this.mousedown) return null;
        if (this.mouseup) {
            this.mouseup = false;
            return null;
        }

        setTimeout(() => {
            if (this.mousedown) return null;

            if (this.editing) {
                this.editing = false;
                return null;
            }

            // const editor = this.app.workspace.activeEditor?.editor;
            const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor
            if (!editor) return null;

            // return if text got selected; we do not want to interfere with that
            if (editor.somethingSelected()) return null;

            // const line = editor.getCursor().line;
            // const prev_line = this.prev_line;
            // this.prev_line = line;
            // if (prev_line == line) return null;

            this.scroll(editor);
        }, 10);
    }

    scroll(editor: Editor) {
        // console.log("called")
        // this.prev_line = editor.getCursor().line;

        const editor_view = editor.cm;

        // cursor position on screen in pixels
        const cursor = editor_view.coordsAtPos(editor_view.state.selection.main.head);
        if (!cursor) return null;

        const current_scroll_y = editor.getScrollInfo().top;
        const cursor_y = cursor.top;
        const scrollInfo = editor_view.scrollDOM.getBoundingClientRect();
        const center = (scrollInfo.top + scrollInfo.bottom) / 2
        const center_offset = cursor_y - center;

        // editor.scrollTo(null, current_scroll_y + center_offset);
        clearTimeout(this.smoothscroll_timeout);
        const steps = 5;
        const time = 5;
        this.smoothscroll(editor, current_scroll_y + center_offset, center_offset / steps, time, steps);
    }

    smoothscroll(editor: Editor, dest: number, step_size: number, time: number, step: number) {
        if (!step) return null;
        const move_to = dest - step_size * step;
        editor.scrollTo(null, move_to);
        this.smoothscroll_timeout = setTimeout(() => this.smoothscroll(editor, dest, step_size, time, step - 1), time);
    }
}