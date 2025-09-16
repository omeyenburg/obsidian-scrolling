import type { default as ScrollingPlugin } from "./main";

export class MathJax {
    private readonly plugin: ScrollingPlugin;

    private mathJaxEnabled = false;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        window.requestAnimationFrame(this.updateStyle.bind(this));

        plugin.register(() => {
            document.body.removeClass("scrolling-horizontal-mathjax");
        });
    }

    /**
     * Update mathjax styles to allow horizontal scrolling.
     * Called on plugin load and change of settings.
     */
    public updateStyle(): void {
        // Only proceed if state changed.
        const isEnabled = this.plugin.settings.horizontalScrollingMathjaxEnabled;
        if (this.mathJaxEnabled == isEnabled) return;
        this.mathJaxEnabled = isEnabled;

        if (isEnabled) {
            document.body.addClass("scrolling-horizontal-mathjax");
        } else {
            document.body.removeClass("scrolling-horizontal-mathjax");
        }
    }
}
