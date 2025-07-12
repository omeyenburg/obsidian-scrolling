import { MarkdownView, WorkspaceLeaf, TAbstractFile, EditorRange } from "obsidian";
import { around } from "monkey-around";

import { default as ScrollingPlugin } from "./main";

interface EphemeralState {
    timestamp: number;
    scroll?: number;
    cursor?: EditorRange;
}

export class RestoreScroll {
    private readonly plugin: ScrollingPlugin;

    private emphemeralStates: Record<string, EphemeralState> = {};
    private emphemeralStatesSaved = true;

    private static readonly CACHE_FILE =
        ".obsidian/plugins/obsidian-scrolling/emphemeral-states.json";

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        plugin.registerEvent(plugin.app.vault.on("rename", this.renameFileCallback.bind(this)));
        plugin.registerEvent(plugin.app.vault.on("delete", this.deleteFileCallback.bind(this)));
        plugin.registerEvent(plugin.app.workspace.on("quit", this.saveData.bind(this)));

        const self = this;
        plugin.register(
            around(WorkspaceLeaf.prototype, {
                setViewState(old) {
                    return async function (...args) {
                        self.saveData();

                        const result = await old.apply(this, args);

                        const linkUsed = plugin.app.workspace.containerEl.querySelector('span.is-flashing');
                        const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
                        if (linkUsed || !view || !view.file || !plugin.settings.restoreScrollEnabled) return result;

                        const emphemeralState = self.emphemeralStates[view.file.path];
                        if (!emphemeralState) return result;

                        const { cursor, scroll } = emphemeralState;

                        if (plugin.settings.restoreScrollMode === "cursor") {
                            if (cursor) {
                                view.setEphemeralState({
                                    cursor: cursor,
                                });

                                view.editor.scrollIntoView(cursor, true);
                            }
                        } else {
                            view.setEphemeralState({
                                scroll: scroll,
                            });
                        }

                        return result;
                    };
                },
            }),
        );
    }

    private async deleteFileCallback(file: TAbstractFile) {
        delete this.emphemeralStates[file.path];
    }

    private async renameFileCallback(file: TAbstractFile, old: string) {
        this.emphemeralStates[file.path] = this.emphemeralStates[old];
        delete this.emphemeralStates[old];
    }

    private async saveData() {
        if (this.emphemeralStatesSaved) return;
        this.emphemeralStatesSaved = true;

        const data = JSON.stringify(this.emphemeralStates);
        this.plugin.app.vault.adapter.write(RestoreScroll.CACHE_FILE, data);
    }

    // Called on plugin load
    public async loadData() {
        const exists = await this.plugin.app.vault.adapter.exists(RestoreScroll.CACHE_FILE);
        if (exists) {
            const data = await this.plugin.app.vault.adapter.read(RestoreScroll.CACHE_FILE);
            this.emphemeralStates = JSON.parse(data);
        }
    }

    // Invoked on cursor movement and mouse scroll
    public storeState() {
        if (!this.plugin.settings.restoreScrollEnabled) return;

        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || !view.file) return;

        if (this.plugin.app.workspace.activeEditor?.file != view.file) return;

        const timestamp = Date.now();
        const { cursor, scroll } = view.getEphemeralState() as {
            cursor?: EditorRange;
            scroll?: number;
        };

        this.emphemeralStatesSaved = false;
        this.emphemeralStates[view.file.path] = {
            timestamp,
            cursor,
            scroll,
        };
    }
}
