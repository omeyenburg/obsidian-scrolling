function mean(data: number[]): number {
    return data.reduce((a, b) => a + b, 0) / data.length;
}

/**
 * Tracks the timing of consecutive wheel events in order to find gesture
 * boundaries and to tell deliberately paced mouse wheel input apart from the
 * dense, jittery stream a touchpad produces.
 *
 * `Events` owns an instance and is the only caller of {@link analyzeDelay}.
 * The rolling averages are only meaningful when every wheel event feeds them,
 * in order, which is why they live here rather than in whichever feature
 * happens to consume them. Consumers read the derived values; nothing outside
 * this class may mutate the statistics.
 */
export class ScrollGestureAnalyzer {
    /** Lower bound for the pause that separates two gestures, in ms. */
    private readonly MIN_START_THRESHOLD = 200;
    /** Upper bound for that pause, reached once events arrive slowly. */
    private readonly MAX_START_THRESHOLD = 500;
    /** {@link avgDelay} above this counts as deliberately paced input. */
    private readonly WHEEL_DELAY_THRESHOLD = 10;
    /** {@link avgBatchSize} below this counts as small, mouse-like gestures. */
    private readonly BATCH_SIZE_THRESHOLD = 20;

    /** How many inter-event delays the rolling mean considers. */
    private readonly MAX_DELAY_SAMPLES = 50;
    /** How many completed gesture sizes the rolling mean considers. */
    private readonly MAX_BATCH_SIZE_SAMPLES = 3;

    /** Delays since the current gesture started, oldest first. */
    private delays: number[] = [];
    /** Sizes of gestures completed so far, oldest first. */
    private batchSizes: number[] = [];

    /** Mean delay between wheel events, in ms. */
    private avgDelayValue = 10;
    /** Mean number of wheel events per gesture. */
    private avgBatchSizeValue = 20;

    /** Rolling mean delay between wheel events, in ms. */
    get avgDelay(): number {
        return this.avgDelayValue;
    }

    /** Rolling mean number of wheel events per completed gesture. */
    get avgBatchSize(): number {
        return this.avgBatchSizeValue;
    }

    /** True while events arrive slowly and evenly, as a mouse wheel does. */
    get isSlowPaced(): boolean {
        return this.avgDelayValue > this.WHEEL_DELAY_THRESHOLD;
    }

    /** True while gestures are short, as a mouse wheel's are. */
    get hasSmallGestures(): boolean {
        return this.avgBatchSizeValue < this.BATCH_SIZE_THRESHOLD;
    }

    /**
     * Records one wheel event and reports whether it opens a new gesture.
     * Longer pauses between scrolls are more likely to signal a new batch.
     * @param deltaTime Milliseconds since the previous wheel event.
     * @returns True if this event starts a new scroll gesture.
     */
    public analyzeDelay(deltaTime: number): boolean {
        const isStart = this.getIsStart(deltaTime);
        if (isStart) {
            this.batchSizes.push(this.delays.length);
            if (this.batchSizes.length > this.MAX_BATCH_SIZE_SAMPLES) {
                this.batchSizes.shift();
            }
            this.avgBatchSizeValue = mean(this.batchSizes);

            this.delays = [];
            this.avgDelayValue = this.WHEEL_DELAY_THRESHOLD;
            return true;
        }

        // Store delay
        this.delays.push(deltaTime);
        if (this.delays.length > this.MAX_DELAY_SAMPLES) {
            this.delays.shift(); // drop oldest
        }

        this.avgDelayValue = mean(this.delays);
        return false;
    }

    private getIsStart(deltaTime: number): boolean {
        const threshold = Math.min(
            this.MIN_START_THRESHOLD + this.avgDelayValue,
            this.MAX_START_THRESHOLD,
        );

        return deltaTime > threshold;
    }
}
