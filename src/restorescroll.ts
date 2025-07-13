import {
    MarkdownView,
    FileView,
    WorkspaceLeaf,
    TFile,
    TAbstractFile,
    EditorRange,
    debounce,
} from "obsidian";
import { around } from "monkey-around";

import { default as ScrollingPlugin } from "./main";

interface EphemeralState {
    timestamp: number;
    scroll?: number;
    scrollTop?: number;
    cursor?: EditorRange;
}

export class RestoreScroll {
    private readonly plugin: ScrollingPlugin;

    public storeStateDebounced;

    private ephemeralStates: Record<string, EphemeralState> = {};

    private static readonly STORE_INTERVAL = 50;
    private static readonly FILE_SAVE_INTERVAL = 50;
    private static readonly CACHE_FILE =
        ".obsidian/plugins/obsidian-scrolling/ephemeral-states.json";

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        plugin.registerEvent(plugin.app.vault.on("rename", this.renameFileCallback.bind(this)));
        plugin.registerEvent(plugin.app.vault.on("delete", this.deleteFileCallback.bind(this)));
        plugin.registerEvent(plugin.app.workspace.on("quit", this.saveData.bind(this)));

        this.storeStateDebounced = debounce(
            this.storeState.bind(this),
            RestoreScroll.STORE_INTERVAL,
            false,
        );
        const saveStateDebounced = debounce(
            this.saveData.bind(this),
            RestoreScroll.FILE_SAVE_INTERVAL,
            true,
        );

        const self = this;
        plugin.register(
            around(WorkspaceLeaf.prototype, {
                setViewState(old) {
                    return async function (...args) {
                        saveStateDebounced();
                        const result = await old.apply(this, args);

                        const linkUsed =
                            plugin.app.workspace.containerEl.querySelector("span.is-flashing");
                        const view = plugin.app.workspace.getActiveViewOfType(FileView);
                        if (
                            linkUsed ||
                            !view ||
                            !view.file ||
                            !plugin.settings.restoreScrollEnabled
                        )
                            return result;

                        const ephemeralState = self.ephemeralStates[view.file.path];
                        if (!ephemeralState) return result;
                        const { cursor, scroll, scrollTop } = ephemeralState;

                        const type = view.getViewType();
                        if (
                            view instanceof MarkdownView &&
                            view.getMode() === "source" &&
                            (scroll || (cursor && plugin.settings.restoreScrollCursor))
                        ) {
                            console.log("restore", cursor, scroll)
                            if (cursor && plugin.settings.restoreScrollCursor) {
                                view.setEphemeralState({
                                    cursor: cursor,
                                });

                                view.editor.scrollIntoView(cursor, true);
                            } else {
                                view.setEphemeralState({
                                    scroll: scroll,
                                });
                            }
                        } else if (scrollTop && plugin.settings.restoreScrollAllFiles) {
                            window.requestAnimationFrame(() => {
                                if (type === "markdown") {
                                    const scroller =
                                        view.containerEl.querySelector(".markdown-preview-view");
                                    if (scroller) {
                                        scroller.scrollTop = scrollTop;
                                    }
                                } else if (type === "pdf") {
                                    const scroller =
                                        view.containerEl.querySelector(".pdf-viewer-container");
                                    if (scroller) {
                                        scroller.scrollTop = scrollTop;
                                    }
                                } else if (type === "image") {
                                    const scroller =
                                        view.containerEl.querySelector(
                                            ".image-container",
                                        )?.parentElement;
                                    if (scroller) {
                                        scroller.scrollTop = scrollTop;
                                    }
                                }
                            });
                        }

                        return result;
                    };
                },
            }),
        );
    }

    private async deleteFileCallback(file: TAbstractFile) {
        delete this.ephemeralStates[file.path];
    }

    private async renameFileCallback(file: TAbstractFile, old: string) {
        this.ephemeralStates[file.path] = this.ephemeralStates[old];
        delete this.ephemeralStates[old];
    }

    private async saveData() {
        const data = JSON.stringify(this.ephemeralStates);
        this.plugin.app.vault.adapter.write(RestoreScroll.CACHE_FILE, data);
    }

    // Called on plugin load
    public async loadData() {
        const exists = await this.plugin.app.vault.adapter.exists(RestoreScroll.CACHE_FILE);
        if (exists) {
            const data = await this.plugin.app.vault.adapter.read(RestoreScroll.CACHE_FILE);
            try {
                this.ephemeralStates = JSON.parse(data);
            } catch (e) {
                this.ephemeralStates = {};
            }
        }
    }

    // Invoked on cursor movement and mouse scroll
    private async storeState(file: TFile) {
        if (!this.plugin.settings.restoreScrollEnabled) return;

        const view = this.plugin.app.workspace.getActiveViewOfType(FileView);
        if (
            !view ||
            !view.file ||
            this.plugin.app.workspace.getActiveFile() != view.file ||
            view.file != file
        )
            return;

        let scrollTop;
        const timestamp = Date.now();
        if (view instanceof MarkdownView && view.getMode() == "source") {
            console.log("store s")
            scrollTop = view.editor.getScrollInfo().top;
            const { cursor, scroll } = view.getEphemeralState() as {
                cursor?: EditorRange;
                scroll?: number;
            };

            this.ephemeralStates[view.file.path] = {
                timestamp,
                cursor,
                scroll,
                scrollTop,
            };
        } else if (this.plugin.settings.restoreScrollAllFiles) {
            console.log("store")
            const type = view.getViewType();
            if (type === "markdown") {
                scrollTop = view.containerEl.querySelector(".markdown-preview-view")?.scrollTop;
            } else if (type === "pdf") {
                scrollTop = view.containerEl.querySelector(".pdf-viewer-container")?.scrollTop;
            } else if (type === "image") {
                scrollTop =
                    view.containerEl.querySelector(".image-container")?.parentElement?.scrollTop;
            }

            this.ephemeralStates[view.file.path] = {
                timestamp,
                scrollTop,
            };
        }
    }
}
