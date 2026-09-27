import type { AnyFeatureConstructor } from "@core/settings.layout";
import { settingsLayout } from "@core/settings.layout";
import type { FeatureSettingsShape, ValueOf } from "@core/settings.schema";

type InstanceOf<C> = C extends new () => infer I ? I : never;

type UnionToIntersection<U> = (U extends unknown ? (arg: U) => void : never) extends (
    arg: infer I,
) => void
    ? I
    : never;

type MergeFeatures<F extends readonly AnyFeatureConstructor[]> = UnionToIntersection<
    SettingObject<InstanceOf<F[number]>>
>;

/**
 * The flat, fully typed settings object, derived from the features the settings
 * layout names. Every key is declared exactly once.
 */
export type ScrollingPluginSettings = MergeFeatures<
    (typeof settingsLayout)[number]["features"][number][]
>;

type SettingItem = { control: { key: string } };

type ItemsOf<T> = T extends { items: readonly (infer I)[] } ? I : never;

type SettingObjectItem<S> = S extends SettingItem
    ? {
          [K in S["control"]["key"]]: ValueOf<S["control"]>;
      }
    : never;

type SettingObject<F extends { settings: FeatureSettingsShape }> = UnionToIntersection<
    SettingObjectItem<ItemsOf<F["settings"]>>
>;
