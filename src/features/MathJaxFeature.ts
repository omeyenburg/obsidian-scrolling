import type { Feature, FeatureSettingsDefinition, ScrollingPlugin } from "@core/Feature";
import { ScrollingPluginSettings } from "@core/feature.schema";


export class MathJaxFeature implements Feature {
    public readonly id = "mathJax";

    public readonly settings = {
        name: "Horizontal scrolling of MathJax",
        desc: "",
        items: [
            {
                name: "Enable",
                desc: "Allow horizontal scrolling of inline MathJax without scrolling the entire viewport.",
                control: {
                    type: "toggle",
                    key: "mathjaxScrollEnabled",
                    defaultValue: false,
                },
            },
        ],
    } as const satisfies FeatureSettingsDefinition

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
