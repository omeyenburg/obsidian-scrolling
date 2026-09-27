import { Editor } from "obsidian";

export function getVimCursor(editor: Editor): HTMLElement | null {
    const cursorLayerList = editor.cm.scrollDOM.getElementsByClassName("cm-vimCursorLayer");
    if (cursorLayerList.length < 1) {
        return null;
    }

    const cursorList = cursorLayerList[0].getElementsByClassName("cm-cursor-primary");
    if (cursorList.length < 1) {
        return null;
    }
    return cursorList[0] as HTMLElement;
}
