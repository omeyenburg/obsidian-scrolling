import { Plugin } from "obsidian";
import type { Events } from "@core/events";
import type { SettingDefinition } from "@core/settings.schema";
import { ScrollingPluginSettings } from "./feature.schema";

export interface FeatureSettingsDefinition<K extends string = string> {
    name: string;
    desc: string;
    items: readonly SettingDefinition<K>[];
}

export interface ScrollingPlugin extends Plugin {
    settings: ScrollingPluginSettings;
    events: Events;
    featureRegistery: any;
    getMainDoc(): Document;
    saveSettings(): Promise<void>;
    enableStyleClass(name: string | string[]): void;
    disableStyleClass(name: string | string[]): void;
    setStyleProperty(key: string, value: string): void;
    removeStyleProperty(key: string): void;
}

export interface Feature {
    readonly id: string;
    readonly settings: FeatureSettingsDefinition;
    onload(plugin: ScrollingPlugin): void | Promise<void>;
    onunload(): void;
    onSettingsChange?(settings: any): void | Promise<void>;
}
