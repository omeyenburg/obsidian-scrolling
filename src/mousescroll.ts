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

    private touchpadLastUse = -Infinity;
    private touchpadFriction = 0;
    private touchpadVelocity = 0;
    private touchpadLastAnimation = 0;
    private touchpadScrolling = false;
    private touchpadAnimationFrame = 0;
    private mouseLastUse = 0;
    private mouseTarget: number;
    private mouseAnimationFrame: number;
    private readonly MAX_FRICTION = 0.98;
    private readonly MIN_VELOCITY = 0.01;
    private readonly TOUCHPAD_GRACE_PERIOD = 50;

    private readonly MIN_START_TRESHOLD = 200;
    private readonly MAX_START_TRESHOLD = 500;

    private intervalSum: number | null = null;
    private readonly MAX_INTENSITY_INTERVAL = 600;
    private readonly INTENSITY_SMOOTHING = 0.3;

    private delays: number[] = [];
    private avgDelay = 10;
    private readonly WHEEL_DELAY_THRESHOLD = 10;
    private readonly MAX_DELAY_SAMPLES = 50;

    private batchSizes: number[] = [];
    private avgBatchSize = 20;
    private readonly BATCH_SIZE_THRESHOLD = 20;
    private readonly MAX_BATCH_SIZE_SAMPLES = 3;

    private currentEl: HTMLElement | null = null;
    private readonly DEFAULT_FRAME_TIME = 16.67;

    private readonly IS_MAC_OS: boolean;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;
        this.IS_MAC_OS = window.navigator.userAgent.includes("Mac OS");

        plugin.register(() => {
            window.cancelAnimationFrame(this.mouseAnimationFrame);
            window.cancelAnimationFrame(this.touchpadAnimationFrame);
        });
    }

    // Reset velocity on file change
    public leafChangeHandler() {
        this.touchpadVelocity = 0;
        window.cancelAnimationFrame(this.mouseAnimationFrame);
    }

    public wheelHandler(
        event: WheelEvent,
        el: HTMLElement,
        now: number,
        deltaTime: number,
        isStart: boolean,
    ) {
        if (Platform.isMobile) return;

        if (this.plugin.settings.scrollMode === "native") {
            this.applyNativeScroll(event, el);
        } else if (this.plugin.settings.scrollMode === "simulated") {
            this.applySimulatedScroll(event, el, now, deltaTime, isStart);
        }
    }

    private applyNativeScroll(event: WheelEvent, el: HTMLElement) {
        const increasePercent = event.altKey
            ? this.plugin.settings.nativeAltMultiplier
            : this.plugin.settings.nativeScrollMultiplier;

        if (this.plugin.settings.nativeScrollInstant) {
            event.preventDefault()
            el.scrollBy({
                top: event.deltaY * increasePercent,
                behavior: "instant",
            });
        }
        else {
            el.scrollBy(null, event.deltaY * (increasePercent - 1));
        }
    }

    private applySimulatedScroll(
        event: WheelEvent,
        el: HTMLElement,
        now: number,
        deltaTime: number,
        isStart: boolean,
    ) {
        // Approximate line height as 16px.
        const deltaY = event.deltaMode == event.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;

        if (
            this.plugin.settings.simulatedTouchpadEnabled &&
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

        const smoothness = this.plugin.settings.simulatedMouseSmoothness * 2;
        const speed = this.plugin.settings.simulatedMouseSpeed / 50;
        const invert = this.plugin.settings.simulatedMouseInvert ? -1 : 1;

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
        if (el !== this.currentEl) {
            window.cancelAnimationFrame(this.touchpadAnimationFrame);
            window.requestAnimationFrame(
                this.decoupledTouchpadScroll.bind(
                    this,
                    this.currentEl,
                    this.touchpadVelocity,
                    this.touchpadFriction,
                ),
            );

            this.currentEl = el;
            this.touchpadScrolling = false;
            this.touchpadVelocity = 0;
            this.touchpadLastAnimation = 0;
        }

        const smoothness = this.plugin.settings.simulatedTouchpadSmoothness / 100;
        const speed = this.plugin.settings.simulatedTouchpadSpeed / 200 / this.DEFAULT_FRAME_TIME;
        const frictionThreshold = this.plugin.settings.simulatedTouchpadFrictionThreshold;
        const invert = this.plugin.settings.simulatedMouseInvert ? -1 : 1;

        this.touchpadVelocity += deltaY * speed * invert;

        this.touchpadFriction =
            Math.min(1, (Math.abs(deltaY) / frictionThreshold) ** 3) * smoothness;

        if (!this.touchpadScrolling || Math.abs(this.touchpadVelocity) < this.MIN_VELOCITY) {
            this.touchpadScrolling = true;
            this.animateTouchpadScroll(el);
        }
    }

    private animateTouchpadScroll(el: HTMLElement) {
        if (Math.abs(this.touchpadVelocity) > this.MIN_VELOCITY) {
            const now = performance.now();
            const deltaTime = Math.max(8, Math.min(now - this.touchpadLastAnimation, 60));
            this.touchpadLastAnimation = now;

            const dest = el.scrollTop + this.touchpadVelocity * deltaTime;
            el.scrollTop = dest;

            this.touchpadVelocity *= this.touchpadFriction;
            this.touchpadFriction = Math.max(
                0,
                Math.min(this.MAX_FRICTION, this.touchpadFriction + 0.05),
            );

            this.touchpadAnimationFrame = window.requestAnimationFrame(() =>
                this.animateTouchpadScroll(el),
            );
        } else {
            this.touchpadScrolling = false;
            this.touchpadVelocity = 0;
            this.touchpadLastAnimation = 0;
            this.touchpadAnimationFrame = 0;
        }
    }

    private decoupledTouchpadScroll(el: HTMLElement, velocity: number, friction: number) {
        if (Math.abs(velocity) > this.MIN_VELOCITY) {
            el.scrollTop = el.scrollTop + velocity * this.DEFAULT_FRAME_TIME;
            velocity *= friction;
            friction = Math.max(0, Math.min(this.MAX_FRICTION, friction + 0.05));
            window.setTimeout(
                () => this.decoupledTouchpadScroll(el, velocity, friction),
                this.DEFAULT_FRAME_TIME,
            );
        }
    }

    private isTouchpad(
        event: WheelEvent & { wheelDeltaY?: number },
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
        if (now - this.touchpadLastUse < this.TOUCHPAD_GRACE_PERIOD) {
            this.touchpadLastUse = now;
            return true;
        }

        let mouseScore = this.getIntensity(deltaTime, event.deltaY);

        if (isStart) {
            mouseScore += 0.1;
        } else if (this.avgDelay > this.WHEEL_DELAY_THRESHOLD) {
            mouseScore += 0.2;
        }

        if (this.avgBatchSize < this.BATCH_SIZE_THRESHOLD) {
            mouseScore += 0.1;
        }

        // Common mouse deltas
        if (event.wheelDeltaY) {
            if (event.wheelDeltaY % 120 === 0 || event.wheelDeltaY % 164 === 0) {
                mouseScore += 0.7;
            }
        }

        if (this.IS_MAC_OS) {
            mouseScore -= 0.1;

            // On MacOS touchpad seems to report integer values for some reason
            if (event.deltaY % 1 != 0 && Math.abs(event.deltaY) > 5) {
                mouseScore += 0.3;
            }
        }

        // Wheel deltas over 100
        mouseScore += Math.max(0, Math.abs(event.deltaY / 200) - 0.5);

        if (mouseScore < 1.2) {
            if (mouseScore < 0.7) this.touchpadLastUse = now;
            return true;
        }

        return false;
    }

    private getIsStart(deltaTime: number): boolean {
        const threshold = Math.min(
            this.MIN_START_TRESHOLD + this.avgDelay,
            this.MAX_START_TRESHOLD,
        );

        return deltaTime > threshold;
    }

    public analyzeDelay(deltaTime: number): boolean {
        const isStart = this.getIsStart(deltaTime);
        if (isStart) {
            this.batchSizes.push(this.delays.length);
            if (this.batchSizes.length > this.MAX_BATCH_SIZE_SAMPLES) {
                this.batchSizes.shift();
            }
            this.avgBatchSize = mean(this.batchSizes);

            this.delays = [];
            this.avgDelay = this.WHEEL_DELAY_THRESHOLD;
            return true;
        }

        // Store delay
        this.delays.push(deltaTime);
        if (this.delays.length > this.MAX_DELAY_SAMPLES) {
            this.delays.shift(); // drop oldest
        }

        this.avgDelay = mean(this.delays);
        return isStart;
    }

    private getIntensity(deltaTime: number, deltaY: number): number {
        if (deltaTime < this.MAX_INTENSITY_INTERVAL && this.intervalSum !== null) {
            // modified EWMA (exponential weighted moving average)
            this.intervalSum =
                this.intervalSum * (1 - this.INTENSITY_SMOOTHING) +
                deltaTime * this.INTENSITY_SMOOTHING * Math.max(Math.pow(deltaY, 2));
        } else {
            this.intervalSum = Math.max(Math.pow(deltaY, 2), 1);
        }

        // Normalize (approx.)
        const intensity = Math.log2(this.intervalSum) / 20;
        return intensity;
    }
}
