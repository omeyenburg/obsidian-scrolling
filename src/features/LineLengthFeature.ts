import { Platform, debounce } from "obsidian";
import type { Feature, FeatureSettingsDefinition, ScrollingPlugin } from "@core/Feature";

export class LineLengthFeature implements Feature {
    private plugin!: ScrollingPlugin;
    private readonly UPDATE_INTERVAL = 30;

    public onload(plugin: ScrollingPlugin): void {
        this.plugin = plugin;
        this.updateLineLength();
    }

    public readonly settings = {
        items: [
            {
                name: "Readable line length",
                desc: "Limit maximum line length. Less content fits on screen, but long blocks of text are more readable.",
                control: {
                    type: "toggle",
                    key: "readableLineLengthEnabled",
                    defaultValue: true,
                },
                onChange: (): void => {
                    this.updateObsidianReadableLineLength();
                    this.updateLineLength();
                },
            },
            {
                name: "Length unit",
                desc: "Choose to set the line length as percentage, pixels or characters.",
                control: {
                    type: "dropdown",
                    key: "lineLengthUnit",
                    defaultValue: "pixels",
                    options: {
                        pixels: "Pixels (px)",
                        characters: "Characters (ch)",
                        percentage: "Percentage (%)",
                    },
                    disabled: (): boolean => {
                        return this.plugin.settings.readableLineLengthEnabled === false;
                    },
                },
            },
            {
                name: "Number of pixels",
                desc: "Maximum line length as pixels (px).",
                control: {
                    type: "slider",
                    key: "lineLengthPixels",
                    defaultValue: 800,
                    min: 400,
                    max: 3000,
                    step: 50,
                    disabled: (): boolean => {
                        return this.plugin.settings.readableLineLengthEnabled === false;
                    },
                },
                visible: (): boolean => {
                    return this.plugin.settings.lineLengthUnit === "pixels";
                },
                onChange: (): void => {
                    this.updateLineLength();
                },
            },
            {
                name: "Number of characters",
                desc: "Maximum line length as character count (ch).",
                control: {
                    type: "slider",
                    key: "lineLengthCharacters",
                    defaultValue: 80,
                    min: 30,
                    max: 200,
                    step: 1,
                    disabled: (): boolean => {
                        return this.plugin.settings.readableLineLengthEnabled === false;
                    },
                },
                visible: (): boolean => {
                    return this.plugin.settings.lineLengthUnit === "characters";
                },
                onChange: (): void => {
                    this.updateLineLength();
                },
            },
            {
                name: "Percentage of editor",
                desc: "Maximum line length as percentage of the editor width (%).",
                control: {
                    type: "slider",
                    key: "lineLengthPercentage",
                    defaultValue: 80,
                    min: 20,
                    max: 100,
                    step: 2,
                    disabled: (): boolean => {
                        return this.plugin.settings.readableLineLengthEnabled === false;
                    },
                },
                visible: (): boolean => {
                    return this.plugin.settings.lineLengthUnit === "percentage";
                },
                onChange: (): void => {
                    this.updateLineLength();
                },
            },
        ],
    } as const satisfies FeatureSettingsDefinition;

    public onunload(): void {
        this.plugin.removeStyleProperty("--file-line-width");
    }

    private updateLineLength = debounce(
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

    private updateObsidianReadableLineLength(): void {
        const enabled = this.plugin.settings.readableLineLengthEnabled;
        this.plugin.app.vault.setConfig("readableLineLength", enabled);
    }

    private getObsidianReadableLineLength(): boolean {
        return this.plugin.app.vault.getConfig("readableLineLength") as boolean;
    }
}
