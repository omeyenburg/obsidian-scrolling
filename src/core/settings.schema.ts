import type { SettingControl as NativeSettingControl } from "obsidian";

/**
 * The `this` available inside `visible`, `disabled` and `onChange` callbacks: the
 * feature instance that owns the definition, bound at translation time.
 *
 * Declared `any` on purpose. `ScrollingPluginSettings` is derived from the very
 * definitions these callbacks appear in, so naming the settings object here would be
 * a circular type; and the callbacks also reach feature-private members
 * (`this.setup()`), which the schema cannot name either. Declaring it explicitly
 * keeps `noImplicitThis` on without weakening anything that was previously checked.
 *
 * The write path, by contrast, *is* fully typed: see `SettingsStore.set`.
 */
export type SettingOwner = any;

export type BoolPredicate = boolean | ((this: SettingOwner) => boolean);

/**
 * Parses a raw text field into the value that gets stored.
 * Returning `null` rejects the edit and leaves the stored value untouched.
 */
export type ControlParse = (this: SettingOwner, raw: string) => number | null;

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
    displayFormat?: (this: SettingOwner, value: number) => string;
    /**
     * Native controls declare `disabled` without a `this` type, which would leave
     * `this` inside the callback unresolvable. Re-declared here to bind the owner;
     * `OwnedControl` strips the native one so only this signature applies.
     */
    disabled?: BoolPredicate;
}

/** Distributes over the control union, re-declaring `disabled` to bind `this`. */
type OwnedControl<C> = C extends unknown ? Omit<C, "disabled"> & { disabled?: BoolPredicate } : never;

export type SettingControl<K extends string = string> = OwnedControl<
    NativeSettingControl<K> & ControlExtras
>;

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
    /** Evaluated on each render with `this` bound to the owning feature. */
    visible?: BoolPredicate;
    /** Runs after the value is written and persisted, with `this` bound to the owner. */
    onChange?: (this: SettingOwner, value: ValueOf<C>) => void;
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

export function bindPredicate(
    predicate: BoolPredicate | undefined,
    owner: SettingOwner,
): (() => boolean) | undefined {
    if (predicate === undefined) {
        return undefined;
    }

    if (typeof predicate === "boolean") {
        return () => predicate;
    }

    return () => predicate.call(owner);
}

/** Every item of a feature, whether declared as loose items or inside groups. */
export function itemsOf(settings: FeatureSettingsDefinition): readonly SettingItem[] {
    return [...(settings.items ?? []), ...(settings.groups?.flatMap((g) => g.items) ?? [])];
}
