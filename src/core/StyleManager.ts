import type ScrollingPlugin from "@core/main";

export class StyleManager {
    constructor(private plugin: ScrollingPlugin) {}

    private get body(): HTMLElement {
        return this.plugin.app.workspace.containerEl.ownerDocument.body;
    }

    addClass(name: string | string[]) {
        for (const n of Array.isArray(name) ? name : [name]) {
            this.body.addClass(n);
        }
    }

    removeClass(name: string | string[]) {
        for (const n of Array.isArray(name) ? name : [name]) {
            this.body.removeClass(n);
        }
    }

    setProperty(key: string, value: string) {
        this.body.style.setProperty(key, value);
    }

    removeProperty(key: string) {
        this.body.style.removeProperty(key);
    }
}
