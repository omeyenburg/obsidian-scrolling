import { Platform } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

function easeOut(t: number): number {
    return 1 - (1 - t) ** 2;
}

function mean(data: number[]): number {
    return data.reduce((a, b) => a + b, 0) / data.length;
}

export class MouseScroll {
    private readonly plugin: ScrollingPlugin;

    private touchpadLastUse = 0;
    private touchpadFriction = 0;
    private touchpadVelocity = 0;
    private touchpadLastAnimation = 0;
    private touchpadScrolling = false;
    private mouseLastUse = 0;
    private mouseTarget: number;
    private mouseAnimationFrame: number;
    private static readonly MAX_FRICTION = 0.98;
    private static readonly MIN_VELOCITY = 0.1;
    private static readonly TOUCHPAD_GRACE_PERIOD = 50;

    private static readonly START_SCROLL_THRESHOLD = 300;

    private intervalSum: number | null = null;
    private static readonly MAX_INTENSITY_INTERVAL = 600;
    private static readonly INTENSITY_SMOOTHING = 0.3;

    private delays: number[] = [];
    private avgDelay = MouseScroll.WHEEL_DELAY_THRESHOLD;
    private static readonly WHEEL_DELAY_THRESHOLD = 10;
    private static readonly MAX_DELAY_SAMPLES = 50;

    private batchSizes: number[] = [];
    private avgBatchSize = MouseScroll.BATCH_SIZE_THRESHOLD;
    private static readonly BATCH_SIZE_THRESHOLD = 20;
    private static readonly MAX_BATCH_SIZE_SAMPLES = 3;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;
    }

    // Reset velocity on file change
    public leafChangeHandler() {
        this.touchpadVelocity = 0;
        window.cancelAnimationFrame(this.mouseAnimationFrame);
    }

    public applyCustomScroll(
        event: WheelEvent,
        el: HTMLElement,
        now: number,
        deltaTime: number,
        isStart: boolean,
    ) {
        if (Platform.isMobile || !this.plugin.settings.mouseEnabled) return;

        const deltaY = event.deltaMode == event.DOM_DELTA_LINE ? event.deltaY * 20 : event.deltaY;

        if (
            this.plugin.settings.touchpadEnabled &&
            this.isTouchpad(event, now, deltaTime, isStart)
        ) {
            this.startTouchpadScroll(el, deltaY);
        } else {
            this.startMouseScroll(el, deltaY);
        }

        event.preventDefault();
    }

    // Really good approximation of the default scrolling in Obsidian.
    // Defaults: smoothness=150, speed=1
    private startMouseScroll(el: HTMLElement, deltaY: number): void {
        if (!el) return;
        window.cancelAnimationFrame(this.mouseAnimationFrame);

        const smoothness = this.plugin.settings.mouseSmoothness * 2;
        const speed = this.plugin.settings.mouseSpeed / 50;
        const invert = this.plugin.settings.mouseInvert ? -1 : 1;

        const startTime = performance.now();
        if (this.mouseTarget && this.mouseLastUse && startTime - this.mouseLastUse < smoothness) {
            el.scrollTop = this.mouseTarget;
        }
        this.mouseLastUse = startTime;

        const start = el.scrollTop;
        const changeY = deltaY * speed * invert;
        this.mouseTarget = start + changeY;

        // this.mouseAnimationFrame = window.requestAnimationFrame(() =>
        this.animateMouseScroll(el, start, startTime, smoothness, changeY);
        // );
    }

    private animateMouseScroll(
        el: HTMLElement,
        start: number,
        startTime: number,
        smoothness: number,
        changeY: number,
    ) {
        const now = performance.now();
        let t = Math.min(1, (now - startTime) / smoothness);
        t = easeOut(t);

        el.scrollTop = start + changeY * t;

        if (t < 1) {
            this.mouseAnimationFrame = window.requestAnimationFrame(() =>
                this.animateMouseScroll(el, start, startTime, smoothness, changeY),
            );
        } else {
            el.scrollTop = start + changeY;
            this.mouseAnimationFrame = 0;
        }
    }

    // Similar to touchpad scrolling in obsidian.
    // Defaults: smoothness=0.75, speed=0.25, frictionThreshold=20
    private startTouchpadScroll(el: HTMLElement, deltaY: number): void {
        const smoothness = this.plugin.settings.touchpadSmoothness / 100;
        const speed = this.plugin.settings.touchpadSpeed / 200 / 16.6667;
        const frictionThreshold = this.plugin.settings.touchpadFrictionThreshold;
        const invert = this.plugin.settings.mouseInvert ? -1 : 1;

        if (this.touchpadVelocity * deltaY < 0) {
            this.touchpadScrolling = false;
        }

        this.touchpadVelocity += deltaY * speed * invert;

        this.touchpadFriction =
            Math.min(1, (Math.abs(deltaY) / frictionThreshold) ** 3) * smoothness;

        this.touchpadFriction = 0.8;

        if (!this.touchpadScrolling) {
            this.touchpadScrolling = true;
            this.animateTouchpadScroll(el);
        }
    }

    private animateTouchpadScroll(el: HTMLElement) {
        if (Math.abs(this.touchpadVelocity) > MouseScroll.MIN_VELOCITY) {
            const now = performance.now();
            let deltaTime = now - this.touchpadLastAnimation;
            this.touchpadLastAnimation = now;
            if (deltaTime > 100) deltaTime = 16;

            el.scrollTop += this.touchpadVelocity * deltaTime;

            this.touchpadVelocity *= this.touchpadFriction;
            this.touchpadFriction = Math.max(
                0,
                Math.min(MouseScroll.MAX_FRICTION, this.touchpadFriction + 0.05),
            );
            window.requestAnimationFrame(() => this.animateTouchpadScroll(el));
        } else {
            this.touchpadScrolling = false;
            this.touchpadVelocity = 0;
            this.touchpadLastAnimation = 0;
        }
    }

    private isTouchpad(
        event: WheelEvent,
        now: number,
        deltaTime: number,
        isStart: boolean,
    ): boolean {
        if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
            this.touchpadLastUse = 0;
            return false;
        }

        // Movement on both axes
        if (event.deltaX !== 0 && event.deltaY !== 0) {
            this.touchpadLastUse = now;
            return true;
        }

        // Grace period
        if (now - this.touchpadLastUse < MouseScroll.TOUCHPAD_GRACE_PERIOD) {
            this.touchpadLastUse = now;
            return true;
        }

        let mouseScore = this.getIntensity(deltaTime, event.deltaY);

        if (isStart) {
            mouseScore += 0.1;
        } else if (this.avgDelay > MouseScroll.WHEEL_DELAY_THRESHOLD) {
            mouseScore += 0.2;
        }

        if (this.avgBatchSize < MouseScroll.BATCH_SIZE_THRESHOLD) {
            mouseScore += 0.1;
        }

        // Common mouse delta
        if (event.deltaY % 120 == 0) {
            mouseScore += 0.3;
        }

        // Wheel deltas over 100
        mouseScore += Math.max(0, Math.abs(event.deltaY / 200) - 0.5);

        if (mouseScore < 1.1) {
            if (mouseScore < 0.7) this.touchpadLastUse = now;
            return true;
        }

        return false;
    }

    public analyzeDelay(deltaTime: number): boolean {
        // Detect start of scroll
        const isStart = deltaTime > MouseScroll.START_SCROLL_THRESHOLD;
        if (isStart) {
            this.batchSizes.push(this.delays.length);
            if (this.batchSizes.length > MouseScroll.MAX_BATCH_SIZE_SAMPLES) {
                this.batchSizes.shift();
            }
            this.avgBatchSize = mean(this.batchSizes);

            this.delays = [];
            this.avgDelay = MouseScroll.WHEEL_DELAY_THRESHOLD;
            return true;
        }

        // Store delay
        this.delays.push(deltaTime);
        if (this.delays.length > MouseScroll.MAX_DELAY_SAMPLES) {
            this.delays.shift(); // drop oldest
        }

        this.avgDelay = mean(this.delays);
        return isStart;
    }

    private getIntensity(deltaTime: number, deltaY: number): number {
        if (deltaTime < MouseScroll.MAX_INTENSITY_INTERVAL && this.intervalSum !== null) {
            // modified EWMA (exponential weighted moving average)
            this.intervalSum =
                this.intervalSum * (1 - MouseScroll.INTENSITY_SMOOTHING) +
                deltaTime * MouseScroll.INTENSITY_SMOOTHING * Math.pow(deltaY, 2);
        } else {
            this.intervalSum = Math.pow(deltaY, 2);
        }

        // Normalize (approx.)
        const intensity = Math.log2(this.intervalSum) / 20;
        return intensity;
    }
}
