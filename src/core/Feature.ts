import type { default as ScrollingPlugin } from "@core/main";
import { FeatureSettingsDefinition, ScrollingPluginSettings } from "./feature.schema";

export interface Feature {
    readonly id: string;
    readonly settings: FeatureSettingsDefinition;
    onload(plugin: ScrollingPlugin): void | Promise<void>;
    onunload(): void;
    onSettingsChange?(settings: ScrollingPluginSettings): void | Promise<void>;
}
