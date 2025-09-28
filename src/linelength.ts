import { Platform, debounce } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

export class LineLength {
    private readonly plugin: ScrollingPlugin;

    /** Debounce interval (ms) between line length updates. */
    private UPDATE_INTERVAL = 30;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        this.updateLineLength();
    }

    /**
     * Updates the editor’s line length using '--file-line-width'.
     * Does nothing on mobile.
     * Does nothing if 'Readable line length' is disabled in vault.
     * Debounced to avoid frequent style recalculations.
     */
    public updateLineLength = debounce(
        () => {
            if (Platform.isMobile) return;

            const enabled = this.getObsidianReadableLineLength()
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

            // Obsidian already uses this property
            document.body.style.setProperty("--file-line-width", lineLength);
        },
        this.UPDATE_INTERVAL,
        false,
    );

    /**
     * Enable or disable 'Readable line length' setting in vault.
     */
    public setObsidianReadableLineLength(enabled: boolean): void {
        this.plugin.app.vault.setConfig("readableLineLength", enabled);
    }

    /**
     * Query value of 'Readable line length' setting in vault.
     */
    public getObsidianReadableLineLength(): boolean {
        return this.plugin.app.vault.getConfig("readableLineLength");
    }
}
