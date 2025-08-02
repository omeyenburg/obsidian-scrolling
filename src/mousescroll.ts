import { Platform } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

function easeOut(t: number): number {
    return 1 - (1 - t) ** 2;
}

function mean(data: number[]): number {
    return data.reduce((a, b) => a + b, 0) / data.length;
}

function isScrolledToTop(el: HTMLElement): boolean {
    return el.scrollTop == 0;
}

function isScrolledToBottom(el: HTMLElement): boolean {
    return Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
}

export class MouseScroll {
    private readonly plugin: ScrollingPlugin;

    private lastScrollElement: HTMLElement;

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

    private lastEventTime = 0;
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
    private static readonly TOUCHPAD_GRACE_PERIOD = 50;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;
    }

    public leafChangeHandler() {
        // Reset velocity on file change
        this.touchpadVelocity = 0;
        window.cancelAnimationFrame(this.mouseAnimationFrame);
    }

    public wheelHandler(event: WheelEvent) {
        if (Platform.isMobile) return;
        if (!this.plugin.settings.mouseEnabled) return;
        if (!event.deltaY) return;

        let el: HTMLElement | null = event.target as HTMLElement;

        const now = performance.now();
        const isStart = this.analyzeDelay(now);
        this.lastEventTime = now;

        // Attempt to use cached scroller
        if (!isStart && this.lastScrollElement) {
            if (this.isWithinScrollContext(el)) {
                if (
                    (event.deltaY < 0 && !isScrolledToTop(this.lastScrollElement)) ||
                    (event.deltaY > 0 && !isScrolledToBottom(this.lastScrollElement))
                ) {
                    this.applyCustomScroll(event, this.lastScrollElement, now, isStart);
                    return;
                }
            }
        }

        // Traverse DOM to find actual scrollable element
        while (el && el != document.body) {
            const { overflowY } = getComputedStyle(el);
            if (
                (overflowY === "auto" || overflowY === "scroll") &&
                el.scrollHeight > el.clientHeight
            ) {
                // Handle nested scroll containers
                if (isStart) {
                    if (event.deltaY < 0 && isScrolledToTop(el)) {
                        el = el.parentElement;
                        continue;
                    }
                    if (event.deltaY > 0 && isScrolledToBottom(el)) {
                        el = el.parentElement;
                        continue;
                    }
                }

                this.applyCustomScroll(event, el, now, isStart);
                return;
            }

            el = el.parentElement;
        }
    }

    private isWithinScrollContext(el: HTMLElement): boolean {
        return el === this.lastScrollElement || this.lastScrollElement.contains(el);
    }

    private applyCustomScroll(event: WheelEvent, el: HTMLElement, now: number, isStart: boolean) {
        const delta = event.deltaMode == event.DOM_DELTA_LINE ? event.deltaY * 20 : event.deltaY;

        if (this.plugin.settings.touchpadEnabled && this.isTouchpad(now, isStart, event)) {
            this.startTouchpadScroll(el, delta);
        } else {
            this.startMouseScroll(el, delta);
        }

        this.lastScrollElement = el;
        event.preventDefault();
    }

    // Really good approximation of the default scrolling in Obsidian.
    // Defaults: smoothness=150, speed=1
    private startMouseScroll(el: HTMLElement, delta: number): void {
        if (!el) return;
        window.cancelAnimationFrame(this.mouseAnimationFrame);

        const smoothness = this.plugin.settings.mouseSmoothness * 2;
        const speed = this.plugin.settings.mouseSpeed / 50;
        const invert = this.plugin.settings.mouseInvert ? -1 : 1;

        const change = delta * speed * invert;

        const startTime = performance.now();
        if (this.mouseTarget && this.mouseLastUse && startTime - this.mouseLastUse < smoothness) {
            el.scrollTop = this.mouseTarget;
        }
        this.mouseLastUse = startTime;

        let start = el.scrollTop;
        this.mouseTarget = start + change;

        // this.mouseAnimationFrame = window.requestAnimationFrame(() =>
        this.animateMouseScroll(el, start, startTime, smoothness, change);
        // );
    }

    private animateMouseScroll(
        el: HTMLElement,
        start: number,
        startTime: number,
        smoothness: number,
        change: number,
    ) {
        const now = performance.now();
        let t = Math.min(1, (now - startTime) / smoothness);
        t = easeOut(t);

        el.scrollTop = start + change * t;

        if (t < 1) {
            this.mouseAnimationFrame = window.requestAnimationFrame(() =>
                this.animateMouseScroll(el, start, startTime, smoothness, change),
            );
        } else {
            el.scrollTop = start + change;
            this.mouseAnimationFrame = 0;
        }
    }

    // Similar to touchpad scrolling in obsidian.
    // Defaults: smoothness=0.75, speed=0.25, frictionThreshold=20
    private startTouchpadScroll(el: HTMLElement, change: number): void {
        const smoothness = this.plugin.settings.touchpadSmoothness / 100;
        const speed = this.plugin.settings.touchpadSpeed / 200 / 16.6667;
        const frictionThreshold = this.plugin.settings.touchpadFrictionThreshold;
        const invert = this.plugin.settings.mouseInvert ? -1 : 1;

        if (this.touchpadVelocity * change < 0) {
            this.touchpadScrolling = false;
        }

        this.touchpadVelocity += change * speed * invert;

        this.touchpadFriction =
            Math.min(1, (Math.abs(change) / frictionThreshold) ** 3) * smoothness;

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

    private isTouchpad(now: number, isStart: boolean, event: WheelEvent): boolean {
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

        let mouseScore = this.getIntensity(event.deltaY);

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

    private analyzeDelay(now: number): boolean {
        if (this.lastEventTime != 0) {
            const delay = now - this.lastEventTime;

            // detect start of scroll
            const isStart = delay > MouseScroll.START_SCROLL_THRESHOLD;
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
            this.delays.push(delay);
            if (this.delays.length > MouseScroll.MAX_DELAY_SAMPLES) {
                this.delays.shift(); // drop oldest
            }

            this.avgDelay = mean(this.delays);
            return isStart;
        } else {
            this.avgDelay = MouseScroll.WHEEL_DELAY_THRESHOLD;
            return true;
        }
    }

    private getIntensity(delta: number): number {
        const now = performance.now();

        if (this.lastEventTime != 0) {
            const interval = now - this.lastEventTime;

            if (interval < MouseScroll.MAX_INTENSITY_INTERVAL && this.intervalSum !== null) {
                // modified EWMA (exponential weighted moving average)
                this.intervalSum =
                    this.intervalSum * (1 - MouseScroll.INTENSITY_SMOOTHING) +
                    interval * MouseScroll.INTENSITY_SMOOTHING * Math.pow(delta, 2);
            } else {
                this.intervalSum = Math.pow(delta, 2);
            }
        } else {
            this.intervalSum = Math.pow(delta, 2);
        }

        // Normalize (approx.)
        const intensity = Math.log2(this.intervalSum) / 20;
        return intensity;
    }
}
