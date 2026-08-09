import type { ScrollingPluginSettings } from "@core/settings";
import type { default as ScrollingPlugin } from "@core/main";
import type { SettingDefinitionPage } from "obsidian";

export interface Feature {
    readonly id: string;
    readonly settings: SettingDefinitionPage;
    onload(plugin: ScrollingPlugin): void | Promise<void>;
    onunload(): void;
    onSettingsChange?(settings: ScrollingPluginSettings): void | Promise<void>;
}
