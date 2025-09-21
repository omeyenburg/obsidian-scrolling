import { Platform, Editor, MarkdownView } from "obsidian";

import type { default as ScrollingPlugin } from "./main";
import { clamp } from "./utility";

export class ImageZoom {
    private readonly plugin: ScrollingPlugin;

    private zoomedImages: Set<HTMLElement> = new Set();

    private readonly SMALL_ZOOM_FACTOR = 1.07;
    private readonly LARGE_ZOOM_FACTOR = 1.2;

    private readonly MIN_SCALE = 1;
    private readonly MAX_SCALE = 100;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        this.updateStyles();

        plugin.register(() => document.body.classList.remove("scrolling-image-zoom-enabled"));
    }

    /**
     * Apply or remove custom image styles based on current setting.
     */
    public updateStyles() {
        if (this.plugin.settings.imageZoomEnabled) {
            document.body.classList.add("scrolling-image-zoom-enabled");
        } else {
            document.body.classList.remove("scrolling-image-zoom-enabled");
        }
    }

    /**
     * On view update.
     * When editing the line with an image, cropping breaks.
     * Will reset zoom.
     */
    public viewUpdateHandler(editor: Editor, isEdit: boolean) {
        if (!isEdit) return;
        if (Platform.isMobile) return;
        this.resetZoom(editor);
    }

    /**
     * On markdown container resize.
     * After resize cropping breaks.
     * Will reset zoom.
     */
    public resizeHandler() {
        if (Platform.isMobile) return;
        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;
        this.resetZoom(view.editor);
    }

    /**
     * Reset the zoom of all registered images.
     */
    private resetZoom(editor: Editor) {
        editor.cm.requestMeasure({
            key: "reset-image-zoom",
            read: (_view) => {},
            write: (_measure, _view) => {
                if (!this.zoomedImages) return;
                this.zoomedImages.forEach((target: HTMLElement) => {
                    target.style.transform = "";
                    target.dataset.zoomData = "";
                    target.dataset.scale = "";
                    target.dataset.translateX = "";
                    target.dataset.translateY = "";
                    target.dataset.viewportLeft = "";
                    target.dataset.viewportTop = "";
                    target.dataset.viewportRight = "";
                    target.dataset.viewportBottom = "";
                    target.dataset.viewportWidth = "";
                    target.dataset.viewportHeight = "";
                    target.parentElement.style.clipPath = "";
                });
                this.zoomedImages.clear();
            },
        });
    }

    /**
     * On wheel event. Desktop only.
     * While hovering over an image, this will zoom if the zoom guesture is used or the user scrolles while pressing ctrl.
     * Returns true if the wheel event is handled successfully.
     */
    public wheelHandler(event: WheelEvent): boolean {
        if (!this.plugin.settings.imageZoomEnabled) return false;

        const target = event.target as HTMLElement;
        if (target.localName !== "img") return false;

        // Touchpad zoom gesture can be detected when wheel event with ctrlKey set to true.
        if (!event.ctrlKey || event.shiftKey) return false;

        if (target.dataset.zoomData !== "true") {
            const supportedView = this.initializeImage(target);
            if (!supportedView) return;
        }

        const viewportTop = Number(target.dataset.viewportTop);
        const viewportLeft = Number(target.dataset.viewportLeft);
        const viewportRight = Number(target.dataset.viewportRight);
        const viewportBottom = Number(target.dataset.viewportBottom);
        const viewportWidth = Number(target.dataset.viewportWidth);
        const viewportHeight = Number(target.dataset.viewportHeight);

        const prevScale = Number.parseFloat(target.dataset.scale) || this.MIN_SCALE;
        const prevTranslateX = Number.parseFloat(target.dataset.translateX) || 0;
        const prevTranslateY = Number.parseFloat(target.dataset.translateY) || 0;

        const mouseX = event.clientX - viewportLeft;
        const mouseY = event.clientY - viewportTop;

        const zoomFactor = this.getZoomFactor(event.deltaY);
        const scale = clamp(prevScale * zoomFactor, this.MIN_SCALE, this.MAX_SCALE);

        let translateX = mouseX - (mouseX - prevTranslateX) * (scale / prevScale);
        let translateY = mouseY - (mouseY - prevTranslateY) * (scale / prevScale);

        const postLeft = viewportLeft + translateX;
        const postTop = viewportTop + translateY;
        const postRight = postLeft + viewportWidth * scale;
        const postBottom = postTop + viewportHeight * scale;

        // Clamp translation
        if (translateX > 0) translateX = 0;
        if (translateY > 0) translateY = 0;
        if (postRight < viewportRight) translateX += viewportRight - postRight;
        if (postBottom < viewportBottom) translateY += viewportBottom - postBottom;

        target.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

        target.dataset.scale = scale.toString();
        target.dataset.translateX = translateX.toString();
        target.dataset.translateY = translateY.toString();

        event.preventDefault();

        return true;
    }

    /**
     * Store initial dimensions of image.
     * Change clippath or height to parent Element based on view type.
     * Returns whether view is supported for image zooming.
     */
    private initializeImage(target: HTMLElement): boolean {
        if (!target.parentElement) return false;

        const imageRect = target.getBoundingClientRect();
        const parentRect = target.parentElement.getBoundingClientRect();

        const view = this.plugin.app.workspace.getActiveFileView();
        const viewType = view.getViewType();
        if (viewType === "markdown") {
            if (target.parentElement.previousElementSibling?.localName === "div") {
                // Single image on one line
                target.parentElement.style.clipPath = `inset(0 ${parentRect.width - imageRect.width}px ${parentRect.bottom - imageRect.bottom}px 0)`;
            } else {
                // Inline image with text before
                target.parentElement.style.clipPath = `inset(-${imageRect.height - parentRect.height + parentRect.bottom - imageRect.bottom}px 0 ${parentRect.bottom - imageRect.bottom}px 0)`;
            }
        } else if (viewType === "image") {
            target.parentElement.style.height = "100%";
        } else return false;

        target.dataset.zoomData = "true";
        target.dataset.viewportLeft = imageRect.left.toString();
        target.dataset.viewportTop = imageRect.top.toString();
        target.dataset.viewportRight = imageRect.right.toString();
        target.dataset.viewportBottom = imageRect.bottom.toString();
        target.dataset.viewportWidth = imageRect.width.toString();
        target.dataset.viewportHeight = imageRect.height.toString();

        this.zoomedImages.add(target);

        return true
    }

    /*
     * Calculates zoom factor based on mouse/touchpad scroll speed and direction.
     * Returns factor > 1 for zooming in and factor < 1 for zooming out.
     */
    private getZoomFactor(deltaY: number): number {
        if (Math.abs(deltaY) < 100) {
            if (deltaY > 0) {
                return 1 / this.SMALL_ZOOM_FACTOR;;
            }

            return this.SMALL_ZOOM_FACTOR;
        } else {
            if (deltaY > 0) {
                return 1 / this.LARGE_ZOOM_FACTOR;;
            }

            return this.LARGE_ZOOM_FACTOR;
        }
    }
}
