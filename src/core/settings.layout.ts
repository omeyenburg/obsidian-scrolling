import { features } from "@core/feature.schema";

type AnyFeature = InstanceType<(typeof features)[number]>;

/** Union of the `id`s declared by registered features. */
export type FeatureId = AnyFeature["id"];

export interface PageLayout {
    name: string;
    desc?: string;
    /**
     * Features contributing a group to this page, in render order. A feature's
     * `groups` each become a headed group; a feature's `items` become one
     * unheaded group. This is what lets unrelated features share a page.
     */
    features: readonly FeatureId[];
}

/**
 * The single source of truth for where settings appear.
 *
 * Features declare *what* their settings are; this decides *where* they show up.
 * Order of the pages below is the order in the settings sidebar.
 */
export const settingsLayout = [
    {
        name: "Centered cursor",
        desc: "",
        features: ["followCursor"],
    },
    {
        name: "Code block wrapping",
        desc: "",
        features: ["codeBlock"],
    },
    {
        name: "Remember file state",
        desc: "",
        features: ["rememberFileState"],
    },
    {
        name: "Scroll buttons & shortcuts",
        desc: "",
        features: ["scrollButtons", "commands", "previewScrollKeys"],
    },
    {
        name: "Scrollbar appearance",
        desc: "",
        features: ["scrollbar"],
    },
    {
        name: "Line length",
        desc: "",
        features: ["lineLength"],
    },
    {
        name: "File tree",
        desc: "",
        features: ["fileTree"],
    },
    {
        name: "MathJax",
        desc: "",
        features: ["mathJax"],
    },
    {
        name: "Mouse scroll behaviour",
        desc: "",
        features: ["mouseScroll"],
    },
] as const satisfies readonly PageLayout[];

type PlacedFeatureId = (typeof settingsLayout)[number]["features"][number];

/**
 * Compile-time: every registered feature appears in the layout above.
 *
 * Exported so the assignment below is never treated as dead code — the value is
 * what forces TypeScript to evaluate the check.
 */
type UnplacedFeatures = Exclude<FeatureId, PlacedFeatureId>;
export const _everyFeatureIsPlaced: UnplacedFeatures extends never
    ? true
    : ["Feature missing from settingsLayout:", UnplacedFeatures] = true;
