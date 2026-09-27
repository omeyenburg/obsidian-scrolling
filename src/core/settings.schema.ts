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

/**
 * A feature's contribution to the settings UI.
 *
 * Deliberately carries no page name: placement lives in `@core/settings.layout`
 * so that unrelated features can share a page.
 */
export interface FeatureSettingsDefinition {
    /** Omitted for a group that needs no heading — e.g. a feature's only group. */
    heading?: string;
    /**
     * Re-evaluated on each render, and in place on every write.
     *
     * Declaring it on the whole group is how a feature hides itself on a platform
     * where its runtime is inert: the page it sits on derives its own visibility
     * from this, so a feature gated here takes its page with it. Note that the
     * native group has `visible` but no `disabled`, so rows that should grey out
     * rather than disappear must keep item-level `disabled`.
     */
    visible?: BoolPredicate;
    items: readonly SettingItem[];
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

/**
 * The only shape the settings derivation needs from a feature instance.
 *
 * Deliberately narrower than `Feature`: constraining to the full contract would make
 * the derivation depend on `Feature`, which depends on the setting callbacks, which
 * depend on `ScrollingPluginSettings` — a cycle through the type being derived.
 */
export type FeatureSettingsShape = {
    items: readonly { control: { key: string } }[];
};

/**
 * A feature class, structurally.
 *
 * `@core/settings.layout` needs this to check the layout it declares, so it cannot be
 * derived from the layout's own contents without referring to itself.
 */
export type FeatureConstructor = new () => { settings: FeatureSettingsShape };
