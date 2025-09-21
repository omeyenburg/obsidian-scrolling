import { Platform, Editor, MarkdownView } from "obsidian";

import type { default as ScrollingPlugin } from "./main";
import { clamp } from "./utility";

export class ImageZoom {
    private readonly plugin: ScrollingPlugin;

    private zoomedImages: Set<HTMLElement> = new Set();

    private startDragX = 0;
    private startDragY = 0;
    private startTranslateX = 0;
    private startTranslateY = 0;
    private currentDragTarget: HTMLElement | null = null;

    private readonly SMALL_ZOOM_FACTOR = 1.07;
    private readonly LARGE_ZOOM_FACTOR = 1.2;

    private readonly MIN_SCALE = 1;
    private readonly MAX_SCALE = 100;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;
        this.updateStyles();
        plugin.register(this.unload.bind(this));
    }

    /*
     * Unload image zoom module.
     */
    private unload() {
        this.resetFile();
        document.body.classList.remove("scrolling-image-zoom-enabled");
    }

    /**
     * Apply or remove custom image styles based on current setting.
     */
    public updateStyles(): void {
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
    public viewUpdateHandler(editor: Editor, isEdit: boolean): void {
        if (!isEdit) return;
        if (Platform.isMobile) return;
        this.resetFile(editor);
    }

    /**
     * On markdown container resize.
     * After resize cropping breaks.
     * Will reset zoom.
     */
    public resizeHandler(): void {
        if (Platform.isMobile) return;
        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;
        this.resetFile(view.editor);
    }

    /**
     * Reset the zoom of all registered images.
     */
    private resetFile(editor?: Editor): void {
        document.removeEventListener("mousemove", this.pointerMoveHandler);
        document.removeEventListener("mouseup", this.pointerUpHandler);

        if (!editor) {
            if (!this.zoomedImages) return;
            this.zoomedImages.forEach((target: HTMLElement) => this.resetImage(target));
            this.zoomedImages.clear();
            return;
        }

        editor.cm.requestMeasure({
            key: "reset-image-zoom",
            read: (_view) => {},
            write: (_measure, _view) => {
                if (!this.zoomedImages) return;
                this.zoomedImages.forEach((target: HTMLElement) => this.resetImage(target));
                this.zoomedImages.clear();
            },
        });
    }

    /**
     * Reset the zoom and stored data of the specified image.
     */
    private resetImage = (target: HTMLElement) => {
        target.style.cursor = "";
        target.style.transform = "";

        target.parentElement.style.clipPath = "";

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

        target.removeEventListener("dblclick", this.doubleClickHandler);
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

        const prevScale = Number.parseFloat(target.dataset.scale) || this.MIN_SCALE;
        const prevTranslateX = Number.parseFloat(target.dataset.translateX) || 0;
        const prevTranslateY = Number.parseFloat(target.dataset.translateY) || 0;

        const mouseX = event.clientX - viewportLeft;
        const mouseY = event.clientY - viewportTop;

        const zoomFactor = this.getZoomFactor(event.deltaY);
        const scale = clamp(prevScale * zoomFactor, this.MIN_SCALE, this.MAX_SCALE);

        const translateX = mouseX - (mouseX - prevTranslateX) * (scale / prevScale);
        const translateY = mouseY - (mouseY - prevTranslateY) * (scale / prevScale);

        const {clampedTranslateX, clampedTranslateY} = this.clampTranslation(target, scale, translateX, translateY);

        target.style.transform = `translate(${clampedTranslateX}px, ${clampedTranslateY}px) scale(${scale})`;
        target.dataset.translateX = clampedTranslateX.toString();
        target.dataset.translateY = clampedTranslateY.toString();
        target.dataset.scale = scale.toString();

        if (scale > this.MIN_SCALE) {
            target.style.cursor = "grab";
        } else {
            target.style.cursor = "";
        }

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

        target.addEventListener("dblclick", this.doubleClickHandler, { passive: true });
        target.addEventListener("mousedown", this.pointerDownHandler);

        return true;
    }

    /*
     * Calculates zoom factor based on mouse/touchpad scroll speed and direction.
     * Returns factor > 1 for zooming in and factor < 1 for zooming out.
     */
    private getZoomFactor(deltaY: number): number {
        if (Math.abs(deltaY) < 100) {
            if (deltaY > 0) {
                return 1 / this.SMALL_ZOOM_FACTOR;
            }

            return this.SMALL_ZOOM_FACTOR;
        } else {
            if (deltaY > 0) {
                return 1 / this.LARGE_ZOOM_FACTOR;
            }

            return this.LARGE_ZOOM_FACTOR;
        }
    }

    /**
     * Reset image zoom on double click.
     */
    private doubleClickHandler = (event: MouseEvent) => {
        this.resetImage(event.target as HTMLElement);
    }

    /**
     * Initialize image dragging with mouse pointer.
     * Attaches pointer up and move handlers to document.
     */
    private pointerDownHandler = (event: MouseEvent) => {
        if (event.button !== 0) return;

        const target = event.target as HTMLElement;
        if (!target || target.localName !== "img") return;

        if ((Number(target.dataset.scale) || this.MIN_SCALE) <= this.MIN_SCALE) return;

        this.currentDragTarget = target;
        this.startDragX = event.clientX;
        this.startDragY = event.clientY;
        this.startTranslateX = Number.parseFloat(target.dataset.translateX) || 0;
        this.startTranslateY = Number.parseFloat(target.dataset.translateY) || 0;

        event.preventDefault();

        document.addEventListener("mousemove", this.pointerMoveHandler);
        document.addEventListener("mouseup", this.pointerUpHandler);
    };

    /**
     * Handle image dragging to shift image.
     */
    private pointerMoveHandler = (event: MouseEvent) => {
        if (!this.currentDragTarget) return;
        const target = this.currentDragTarget;

        const deltaX = event.clientX - this.startDragX;
        const deltaY = event.clientY - this.startDragY;

        let translateX = this.startTranslateX + deltaX;
        let translateY = this.startTranslateY + deltaY;

        const scale = Number.parseFloat(target.dataset.scale) || 1;

        const {clampedTranslateX, clampedTranslateY} = this.clampTranslation(target, scale, translateX, translateY);

        target.style.transform = `translate(${clampedTranslateX}px, ${clampedTranslateY}px) scale(${scale})`;
        target.dataset.translateX = clampedTranslateX.toString();
        target.dataset.translateY = clampedTranslateY.toString();
    };

    /**
     * Stop image dragging and detach handler.
     */
    private pointerUpHandler = () => {
        this.currentDragTarget = null;
        document.removeEventListener("mousemove", this.pointerMoveHandler);
        document.removeEventListener("mouseup", this.pointerUpHandler);
    };

    private clampTranslation(target: HTMLElement, scale: number, translateX: number, translateY: number) {
        const viewportLeft = Number(target.dataset.viewportLeft);
        const viewportTop = Number(target.dataset.viewportTop);
        const viewportRight = Number(target.dataset.viewportRight);
        const viewportBottom = Number(target.dataset.viewportBottom);
        const viewportWidth = Number(target.dataset.viewportWidth);
        const viewportHeight = Number(target.dataset.viewportHeight);

        const postLeft = viewportLeft + translateX;
        const postTop = viewportTop + translateY;
        const postRight = postLeft + viewportWidth * scale;
        const postBottom = postTop + viewportHeight * scale;

        if (translateX > 0) translateX = 0;
        if (translateY > 0) translateY = 0;
        if (postRight < viewportRight) translateX += viewportRight - postRight;
        if (postBottom < viewportBottom) translateY += viewportBottom - postBottom;

        return {clampedTranslateX: translateX, clampedTranslateY: translateY}
    }
}
