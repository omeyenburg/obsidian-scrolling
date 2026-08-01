import type { Feature } from "@core/Feature";
import type { default as ScrollingPlugin } from "@core/main";
import type { ScrollingPluginSettings } from "@core/settings";

export class FileTreeFeature implements Feature {
    public readonly id = "fileTree";
    private plugin!: ScrollingPlugin;
    private fileTreeScrollEnabled = false;

    public onload(plugin: ScrollingPlugin): void {
        this.plugin = plugin;
        window.requestAnimationFrame(this.updateStyle.bind(this));
    }

    public onunload(): void {
        this.plugin.disableStyleClass("scrolling-horizontal-filetree");
    }

    public onSettingsChange(settings: ScrollingPluginSettings): void {
        this.updateStyle();
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
