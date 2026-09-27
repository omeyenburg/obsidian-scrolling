import { Plugin } from "obsidian";
import type { Events } from "@core/events";
import type { FeatureSettingsDefinition, SettingItem } from "@core/settings.schema";
import type { ScrollingPluginSettings } from "@core/feature.schema";
import type { SettingsStore } from "@core/SettingsStore";

export type { FeatureSettingsDefinition, SettingItem };

export interface ScrollingPlugin extends Plugin {
    settings: ScrollingPluginSettings;
    settingsStore: SettingsStore;
    events: Events;
    getMainDoc(): Document;
    enableStyleClass(name: string | string[]): void;
    disableStyleClass(name: string | string[]): void;
    setStyleProperty(key: string, value: string): void;
    removeStyleProperty(key: string): void;
}

export interface Feature {
    readonly settings: FeatureSettingsDefinition;
    onload(plugin: ScrollingPlugin): void | Promise<void>;
    onunload(): void;
}
