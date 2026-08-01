import { Platform, debounce } from "obsidian";
import type { Feature } from "@core/Feature";
import type { default as ScrollingPlugin } from "@core/main";
import type { ScrollingPluginSettings } from "@core/settings";

export class LineLengthFeature implements Feature {
    public readonly id = "lineLength";
    private plugin!: ScrollingPlugin;
    private readonly UPDATE_INTERVAL = 30;

    public onload(plugin: ScrollingPlugin): void {
        this.plugin = plugin;
        this.updateLineLength();
        console.log("loaded")
    }

    public onunload(): void {
        this.plugin.removeStyleProperty("--file-line-width");
    }

    public onSettingsChange(settings: ScrollingPluginSettings): void {
        this.updateLineLength();
    }

    public updateLineLength = debounce(
        () => {
            if (Platform.isMobile) return;

            const enabled = this.getObsidianReadableLineLength();
            if (!enabled) return;

            let lineLength: string;
            switch (this.plugin.settings.lineLengthUnit) {
                case "percentage":
                    lineLength = `${this.plugin.settings.lineLengthPercentage}%`;
                    break;
                case "characters":
                    lineLength = `${this.plugin.settings.lineLengthCharacters}ch`;
                    break;
                default:
                    lineLength = `${this.plugin.settings.lineLengthPixels}px`;
                    break;
            }

            this.plugin.setStyleProperty("--file-line-width", lineLength);
        },
        this.UPDATE_INTERVAL,
        false,
    );

    public setObsidianReadableLineLength(enabled: boolean): void {
        this.plugin.app.vault.setConfig("readableLineLength", enabled);
    }

    public getObsidianReadableLineLength(): boolean {
        return this.plugin.app.vault.getConfig("readableLineLength") as boolean;
    }
}
