import { Platform, debounce } from "obsidian";
import type { Feature, FeatureSettingsDefinition, ScrollingPlugin } from "@core/Feature";

export class LineLengthFeature implements Feature {
    public readonly settings = {
        visible: (): boolean => !Platform.isMobile,
        items: [
            {
                name: "Readable line length",
                desc: "Limit maximum line length. Less content fits on screen, but long blocks of text are more readable.",
                control: {
                    type: "toggle",
                    key: "readableLineLengthEnabled",
                    defaultValue: true,
                },
                onChange: (enabled): void => {
                    this.setObsidianReadableLineLength(enabled === true);
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
                        return !this.getObsidianReadableLineLength();
                    },
                },
                onChange: (): void => {
                    this.updateLineLength();
                },
            },
            {
                name: "Number of pixels",
                desc: "Maximum line length as pixels (px).",
                control: {
                    type: "slider",
                    key: "lineLengthPixels",
                    defaultValue: 700,
                    min: 400,
                    max: 3000,
                    step: 50,
                    disabled: (): boolean => {
                        return !this.getObsidianReadableLineLength();
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
                    defaultValue: 50,
                    min: 30,
                    max: 200,
                    step: 1,
                    disabled: (): boolean => {
                        return !this.getObsidianReadableLineLength();
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
                    defaultValue: 50,
                    min: 20,
                    max: 100,
                    step: 2,
                    disabled: (): boolean => {
                        return !this.getObsidianReadableLineLength();
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

    private plugin!: ScrollingPlugin;

    private readonly UPDATE_INTERVAL = 30;

    public onload(plugin: ScrollingPlugin): void {
        this.plugin = plugin;

        // The vault owns this preference, so the row that displays it starts from the
        // vault's value instead of from our default. Without this a user who turned
        // readable line length off in Obsidian would see the toggle on, and the length
        // controls enabled, while the runtime correctly did nothing.
        const inVault = this.getObsidianReadableLineLength();
        if (plugin.settings.readableLineLengthEnabled !== inVault) {
            void plugin.settingsStore.set("readableLineLengthEnabled", inVault);
        }

        this.updateLineLength();
    }

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

    private setObsidianReadableLineLength(enabled: boolean): void {
        this.plugin.app.vault.setConfig("readableLineLength", enabled);
    }

    private getObsidianReadableLineLength(): boolean {
        return this.plugin.app.vault.getConfig("readableLineLength") as boolean;
    }
}
