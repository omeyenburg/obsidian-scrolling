import type { SettingControl as NativeSettingControl } from "obsidian";

/**
 * A boolean setting state, recomputed on every render.
 *
 * Callbacks are plain functions, never `this`-typed methods. A feature's `settings`
 * is a class field, so an arrow function in its initializer captures the instance and
 * TypeScript checks every `this.<member>` against the real class — including private
 * members. The cost is that a callback cannot be handed a receiver at call time; the
 * translator and the store simply invoke these, so there is nothing to hand.
 */
export type BoolPredicate = boolean | (() => boolean);

/**
 * Parses a raw text field into the value that gets stored.
 * Returning `null` rejects the edit and leaves the stored value untouched.
 */
export type ControlParse = (raw: string) => number | null;

/**
 * The hooks Obsidian's control schema has no slot for.
 *
 * Kept as a separate intersection rather than a redefinition of the control union,
 * so control types added upstream (`color`, `file`, `folder`, …) keep working
 * without changes here.
 */
interface ControlExtras {
    /** `number` only. Presence forces the row to render imperatively. */
    parse?: ControlParse;
    /** `number` only. Renders the stored value; omitted values use `String(value)`. */
    displayFormat?: (value: number) => string;
}

export type SettingControl<K extends string = string> = NativeSettingControl<K> & ControlExtras;

/** The value a control stores, derived from its `type`. */
export type ValueOf<C> = C extends { type: "toggle" }
    ? boolean
    : C extends { type: "dropdown"; options: infer O }
      ? keyof O
      : C extends { type: "number" }
        ? number
        : C extends { type: "slider" }
          ? number
          : C extends { type: "text" }
            ? string
            : C extends { type: "textarea" }
              ? string
              : C extends { type: "file" }
                ? string
                : C extends { type: "folder" }
                  ? string
                  : C extends { type: "color" }
                    ? string
                    : unknown;

export interface SettingItem<C extends SettingControl = SettingControl> {
    name: string;
    desc?: string | DocumentFragment;
    aliases?: string[];
    searchable?: boolean | (() => boolean);
    /** Re-evaluated on each render, and in place on every write. */
    visible?: BoolPredicate;
    /** Runs after the value is written and persisted. */
    onChange?: (value: ValueOf<C>) => void;
    control: C;
}

export interface SettingGroup {
    /** Stable id, for referring to this group from a layout. */
    id?: string;
    heading: string;
    items: readonly SettingItem[];
}

/**
 * A feature's contribution to the settings UI.
 *
 * Deliberately carries no page name: placement lives in `@core/settings.layout`
 * so that unrelated features can share a page.
 */
export interface FeatureSettingsDefinition {
    /** Rendered as an unheaded group. Use for features that own a whole page. */
    items?: readonly SettingItem[];
    /** Rendered as headed groups. Use for features sharing a page with others. */
    groups?: readonly SettingGroup[];
}

/**
 * Normalises a predicate into a re-callable thunk, or `undefined` if there was none.
 *
 * A boolean is already constant, so it becomes a thunk for free; a function is
 * returned as-is, since the callbacks are `this`-free and close over their feature.
 */
export function bindPredicate(predicate: BoolPredicate | undefined): (() => boolean) | undefined {
    if (predicate === undefined) {
        return undefined;
    }

    if (typeof predicate === "boolean") {
        return () => predicate;
    }

    return predicate;
}

/** Every item of a feature, whether declared as loose items or inside groups. */
export function itemsOf(settings: FeatureSettingsDefinition): readonly SettingItem[] {
    return [...(settings.items ?? []), ...(settings.groups?.flatMap((g) => g.items) ?? [])];
}

/**
 * The only shape the settings derivation needs from a feature instance.
 *
 * Deliberately narrower than `Feature`: constraining to the full contract would make
 * the derivation depend on `Feature`, which depends on the setting callbacks, which
 * depend on `ScrollingPluginSettings` — a cycle through the type being derived.
 */
export type FeatureSettingsShape = {
    items?: readonly SettingShape[];
    groups?: readonly { items: readonly SettingShape[] }[];
};

type SettingShape = { control: { key: string } };

/**
 * A feature class, structurally.
 *
 * `@core/settings.layout` needs this to check the layout it declares, so it cannot be
 * derived from the layout's own contents without referring to itself.
 */
export type FeatureConstructor = new () => { settings: FeatureSettingsShape };
