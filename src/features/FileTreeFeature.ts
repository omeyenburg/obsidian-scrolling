import type { Feature } from "@core/Feature";
import type { default as ScrollingPlugin } from "@core/main";
import type { ScrollingPluginSettings } from "@core/settings";
import { SettingDefinitionPage } from "obsidian";

export class FileTreeFeature implements Feature {
    public readonly id = "fileTree";

    public readonly settings = {
        name: "File tree",
        desc: "Horizontal scrolling in the file tree",
        type: "page",
        items: [
            {
                name: "Enable",
                desc: "Allow horizontal scrolling in the file tree and show a scrollbar.",
                control: {
                    type: "toggle",
                    key: "horizontalFileTreeEnabled",
                    defaultValue: false,
                },
            },
        ],
    } as const satisfies SettingDefinitionPage;

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
