import type { ScrollingPluginSettings } from "@core/settings";
import type { default as ScrollingPlugin } from "@core/main";

export interface Feature {
    readonly id: string;
    onload(plugin: ScrollingPlugin): void | Promise<void>;
    onunload(): void;
    onSettingsChange?(settings: ScrollingPluginSettings): void | Promise<void>;
}
