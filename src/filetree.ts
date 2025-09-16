import type { default as ScrollingPlugin } from "./main";

export class FileTree {
    private readonly plugin: ScrollingPlugin;

    private fileTreeScrollEnabled = false;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        window.requestAnimationFrame(this.updateStyle.bind(this));

        plugin.register(() => {
            document.body.removeClass("scrolling-horizontal-filetree");
        });
    }

    /**
     * Update file tree styles to allow horizontal scrolling.
     * Called on plugin load and change of settings.
     */
    public updateStyle(): void {
        // Only proceed if state changed.
        const isEnabled = this.plugin.settings.horizontalScrollingFileTreeEnabled;
        if (this.fileTreeScrollEnabled == isEnabled) return;
        this.fileTreeScrollEnabled = isEnabled;

        if (isEnabled) {
            document.body.addClass("scrolling-horizontal-filetree");
        } else {
            document.body.removeClass("scrolling-horizontal-filetree");
        }
    }
}
