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
        desc: "Automatically scrolls the view to keep the cursor near the center when you move it.",
        features: ["followCursor"],
    },
    {
        name: "Mouse & Touchpad scrolling",
        desc: "",
        features: ["mouseScroll"],
    },
    {
        name: "Scroll buttons & keys",
        desc: "Buttons and keybinds for jumping to the top and bottom of a note.",
        features: ["commands", "scrollButtons", "previewScrollKeys"],
    },
    {
        name: "Remember scroll position",
        desc: "Automatically save your position before closing a file and restore it upon opening the file again.",
        features: ["rememberFileState"],
    },
    {
        name: "Line length",
        desc: "Limit maximum line length. Less content fits on screen, but long blocks of text are more readable.",
        features: ["lineLength"],
    },
    {
        name: "Scrollbars",
        desc: "",
        features: ["scrollbar"],
    },
    {
        name: "File tree",
        desc: "Horizontal scrolling in the file tree",
        features: ["fileTree"],
    },
    {
        name: "Code blocks",
        desc: "Disable code wrapping & allow horizontal scrolling of code blocks in source and preview mode.",
        features: ["codeBlock"],
    },
    {
        name: "Horizontal scrolling of MathJax",
        desc: "",
        features: ["mathJax"],
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
