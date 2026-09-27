import { CenteredCursorFeature } from "@features/CenteredCursorFeature";
import { CodeBlockFeature } from "@features/CodeBlockFeature";
import { QuickCommandsFeature } from "@features/QuickCommandsFeature";
import { FileTreeFeature } from "@features/FileTreeFeature";
import { LineLengthFeature } from "@features/LineLengthFeature";
import { MathJaxFeature } from "@features/MathJaxFeature";
import { ReadingModeShortcutsFeature } from "@features/ReadingModeShortcutsFeature";
import { RememberFileStateFeature } from "@features/RememberFileStateFeature";
import { ScrollButtonsFeature } from "@features/ScrollButtonsFeature";
import { ScrollbarFeature } from "@features/ScrollbarFeature";

import type { FeatureConstructor } from "@core/settings.schema";

export interface PageLayout<F extends FeatureConstructor = FeatureConstructor> {
    name: string;
    desc?: string;
    /**
     * Features contributing a group to this page, in render order. Each feature is
     * exactly one group, so this is what lets unrelated features share a page.
     *
     * The page declares no visibility of its own: it is shown whenever at least one
     * of these features is, which a feature hides itself by gating its own group.
     * Gating is therefore never declared here — see `FeatureSettingsDefinition.visible`.
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
 *
 * Whether a page appears is deliberately not a decision of this file. It follows from
 * the features: a page whose every feature is gated away disappears, one with at least
 * one ungated feature stays. A feature that is inert on a platform — mouse scroll
 * behaviour, say — therefore declares that on itself, where the reason is visible.
 * Hiding is presentational throughout: a gated feature still registers its settings,
 * so no value is ever reset by it being hidden.
 */
export const settingsLayout = [
    {
        name: "Centered cursor",
        desc: "",
        features: [CenteredCursorFeature],
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
        features: [ScrollButtonsFeature, QuickCommandsFeature, ReadingModeShortcutsFeature],
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
] as const satisfies readonly PageLayout[];

/** Every feature class named anywhere in the layout, flattened. */
export type AnyFeatureConstructor = (typeof settingsLayout)[number]["features"][number];
