import type { Feature, FeatureSettingsDefinition, ScrollingPlugin } from "@core/Feature";

export class FileTreeFeature implements Feature {
    public readonly settings = {
        items: [
            {
                name: "Horizontal scrolling",
                desc: "Allow horizontal scrolling in the file tree instead of cutting off long file names.",
                control: {
                    type: "toggle",
                    key: "horizontalFileTreeEnabled",
                    defaultValue: false,
                },
                onChange: (): void => {
                    this.updateStyle();
                },
            },
        ],
    } as const satisfies FeatureSettingsDefinition;

    private plugin!: ScrollingPlugin;

    private fileTreeScrollEnabled = false;

    public onload(plugin: ScrollingPlugin): void {
        this.plugin = plugin;
        window.requestAnimationFrame(this.updateStyle.bind(this));
    }

    public onunload(): void {
        this.plugin.disableStyleClass("scrolling-horizontal-filetree");
    }

    public updateStyle(): void {
        const isEnabled = this.plugin.settings.horizontalFileTreeEnabled;
        if (this.fileTreeScrollEnabled === isEnabled) return;
        this.fileTreeScrollEnabled = isEnabled;

        if (isEnabled) {
            this.plugin.enableStyleClass("scrolling-horizontal-filetree");
        } else {
            this.plugin.disableStyleClass("scrolling-horizontal-filetree");
        }
    }
}
