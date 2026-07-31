import type { default as ScrollingPlugin } from "@core/main";

export class MathJax {
    private readonly plugin: ScrollingPlugin;

    private mathJaxEnabled = false;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        window.requestAnimationFrame(this.updateStyle.bind(this));

        plugin.register(() => {
            this.plugin.disableStyleClass("scrolling-horizontal-mathjax");
        });
    }

    /**
     * Update mathjax styles to allow horizontal scrolling.
     * Called on plugin load and change of settings.
     */
    public updateStyle(): void {
        // Only proceed if state changed.
        const isEnabled = this.plugin.settings.mathjaxScrollEnabled;
        if (this.mathJaxEnabled == isEnabled) return;
        this.mathJaxEnabled = isEnabled;

        if (isEnabled) {
            this.plugin.enableStyleClass("scrolling-horizontal-mathjax");
        } else {
            this.plugin.disableStyleClass("scrolling-horizontal-mathjax");
        }
    }
}
