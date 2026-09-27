import { CenterCursorFeature } from "@features/CenterCursorFeature";
import { CodeBlockFeature } from "@features/CodeBlockFeature";
import { CommandsFeature } from "@features/CommandsFeature";
import { FileTreeFeature } from "@features/FileTreeFeature";
import { LineLengthFeature } from "@features/LineLengthFeature";
import { MathJaxFeature } from "@features/MathJaxFeature";
import { MouseScrollFeature } from "@features/MouseScrollFeature";
import { PreviewScrollKeysFeature } from "@features/PreviewScrollKeysFeature";
import { RememberFileStateFeature } from "@features/RememberFileStateFeature";
import { ScrollButtonsFeature } from "@features/ScrollButtonsFeature";
import { ScrollbarFeature } from "@features/ScrollbarFeature";

import type { FeatureConstructor } from "@core/settings.schema";

export interface PageLayout<F extends FeatureConstructor = FeatureConstructor> {
    name: string;
    desc?: string;
    /**
     * Features contributing a group to this page, in render order. A feature's
     * `groups` each become a headed group; a feature's `items` become one
     * unheaded group. This is what lets unrelated features share a page.
     */
    features: readonly F[];
}

/**
 * The single source of truth for the plugin's features: which ones exist, and where
 * each one's settings appear.
 *
 * A feature's class is all that is declared here — it contributes its own setting
 * definitions from `@core/settings.schema`. Adding a feature therefore means creating
 * the class and adding it to one page below; nothing else needs to list it, and there
 * is no way to register one without placing it.
 *
 * Order matters twice over: it is the order of the pages in the settings sidebar, and
 * the order features are constructed and loaded.
 */
export const settingsLayout = [
    {
        name: "Centered cursor",
        desc: "",
        features: [CenterCursorFeature],
    },
    {
        name: "Code block wrapping",
        desc: "",
        features: [CodeBlockFeature],
    },
    {
        name: "Remember file state",
        desc: "",
        features: [RememberFileStateFeature],
    },
    {
        name: "Scroll buttons & shortcuts",
        desc: "",
        features: [ScrollButtonsFeature, CommandsFeature, PreviewScrollKeysFeature],
    },
    {
        name: "Scrollbar appearance",
        desc: "",
        features: [ScrollbarFeature],
    },
    {
        name: "Line length",
        desc: "",
        features: [LineLengthFeature],
    },
    {
        name: "File tree",
        desc: "",
        features: [FileTreeFeature],
    },
    {
        name: "MathJax",
        desc: "",
        features: [MathJaxFeature],
    },
    {
        name: "Mouse scroll behaviour",
        desc: "",
        features: [MouseScrollFeature],
    },
] as const satisfies readonly PageLayout[];

/** Every feature class named anywhere in the layout, flattened. */
export type AnyFeatureConstructor = (typeof settingsLayout)[number]["features"][number];
