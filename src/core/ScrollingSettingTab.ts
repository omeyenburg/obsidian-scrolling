import { PluginSettingTab, SettingDefinitionItem } from "obsidian";

import type { default as ScrollingPlugin } from "@core/main";
import { FeatureRegistry } from "@core/FeatureRegistry";

export class ScrollingSettingTab extends PluginSettingTab {
    constructor(
        readonly plugin: ScrollingPlugin,
        private readonly featureRegistery: FeatureRegistry,
    ) {
        super(plugin.app, plugin);
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        return this.featureRegistery.getSettingDefinitions();
    }
}
