import type { AnchorMode, FocusUnit, ReaderFocusState } from '../shared/article-schema.js';

export type FocusChangeHandler = (unit: FocusUnit, index: number) => void;

export class FocusEngine {
  private activeIndex = 0;
  private anchorMode: AnchorMode = 'free';

  constructor(
    private readonly units: FocusUnit[],
    private readonly onChange: FocusChangeHandler
  ) {}

  get index(): number {
    return this.activeIndex;
  }

  get activeUnit(): FocusUnit | null {
    return this.units[this.activeIndex] ?? null;
  }

  get state(): ReaderFocusState | null {
    const activeUnit = this.activeUnit;
    if (!activeUnit) {
      return null;
    }

    return {
      activeIndex: this.activeIndex,
      activeUnitId: activeUnit.unitId,
      anchorMode: this.anchorMode
    };
  }

  setAnchorMode(anchorMode: AnchorMode): void {
    this.anchorMode = anchorMode;
  }

  alignActiveToViewport(options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'center' }): void {
    void options;
  }

  start(index = 0): void {
    this.setIndex(index);
  }

  next(): void {
    this.setIndex(this.activeIndex + 1);
  }

  previous(): void {
    this.setIndex(this.activeIndex - 1);
  }

  first(): void {
    this.setIndex(0);
  }

  last(): void {
    this.setIndex(this.units.length - 1);
  }

  setIndex(index: number): void {
    if (this.units.length === 0) {
      return;
    }

    const nextIndex = Math.min(this.units.length - 1, Math.max(0, index));
    this.activeIndex = nextIndex;
    this.onChange(this.units[nextIndex], nextIndex);
  }
}
