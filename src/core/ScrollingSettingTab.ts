import { PluginSettingTab, type SettingDefinitionItem } from "obsidian";

import type { default as ScrollingPlugin } from "@core/main";
import type { FeatureRegistry } from "@core/FeatureRegistry";
import type { SettingKey, SettingsStore } from "@core/SettingsStore";

/**
 * Adapts Obsidian's declarative settings renderer to the plugin's store.
 *
 * `getSettingDefinitions` / `getControlValue` / `setControlValue` are the whole
 * contract: Obsidian reads and writes values through here, so the settings UI has
 * no rendering code of its own.
 */
export class ScrollingSettingTab extends PluginSettingTab {
    constructor(
        plugin: ScrollingPlugin,
        private readonly featureRegistry: FeatureRegistry,
        private readonly store: SettingsStore,
    ) {
        super(plugin.app, plugin);
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        return this.featureRegistry.getSettingDefinitions();
    }

    getControlValue(key: string): unknown {
        return this.store.get(asSettingKey(key));
    }

    setControlValue(key: string, value: unknown): void | Promise<void> {
        return this.store.set(asSettingKey(key), value as never);
    }
}

/**
 * The single place where Obsidian's untyped `(key: string, value: unknown)` boundary
 * meets the typed store. `key` is always one of the declared setting keys, because
 * Obsidian only ever calls back with a key from the emitted definitions.
 */
function asSettingKey(key: string): SettingKey {
    return key as SettingKey;
}
