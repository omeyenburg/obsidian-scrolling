import type { Feature } from "@core/Feature";
import type { default as ScrollingPlugin } from "@core/main";
import type { ScrollingPluginSettings } from "@core/settings";

export class MathJaxFeature implements Feature {
    public readonly id = "mathJax";
    private plugin!: ScrollingPlugin;
    private mathJaxEnabled = false;

    public onload(plugin: ScrollingPlugin): void {
        this.plugin = plugin;
        window.requestAnimationFrame(this.updateStyle.bind(this));
    }

    public onunload(): void {
        this.plugin.disableStyleClass("scrolling-horizontal-mathjax");
    }

    public onSettingsChange(settings: ScrollingPluginSettings): void {
        this.updateStyle();
    }

    public updateStyle(): void {
        const isEnabled = this.plugin.settings.mathjaxScrollEnabled;
        if (this.mathJaxEnabled === isEnabled) return;
        this.mathJaxEnabled = isEnabled;

        if (isEnabled) {
            this.plugin.enableStyleClass("scrolling-horizontal-mathjax");
        } else {
            this.plugin.disableStyleClass("scrolling-horizontal-mathjax");
        }
    }
}
