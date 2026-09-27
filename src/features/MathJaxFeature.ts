import type { Feature, FeatureSettingsDefinition, ScrollingPlugin } from "@core/Feature";

export class MathJaxFeature implements Feature {
    public readonly settings = {
        items: [
            {
                name: "Horizontal scrolling",
                desc: "Allow horizontal scrolling of long inline MathJax blocks without scrolling the entire viewport.",
                control: {
                    type: "toggle",
                    key: "mathjaxScrollEnabled",
                    defaultValue: false,
                },
                onChange: (): void => {
                    this.updateStyle();
                },
            },
        ],
    } as const satisfies FeatureSettingsDefinition;

    private plugin!: ScrollingPlugin;
    private mathJaxEnabled = false;

    public onload(plugin: ScrollingPlugin): void {
        this.plugin = plugin;
        window.requestAnimationFrame(this.updateStyle.bind(this));
    }

    public onunload(): void {
        this.plugin.disableStyleClass("scrolling-horizontal-mathjax");
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
