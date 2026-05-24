export type FocusUnit =
  | {
      id: string;
      type: 'reading-text';
      blockId: string;
      unitId: string;
      text: string;
      startOffset: number;
      endOffset: number;
    }
  | {
      id: string;
      type: 'block';
      blockId: string;
      unitId: string;
      blockType: 'title' | 'heading' | 'quote' | 'image' | 'embed';
    };

export type AnchorMode = 'free' | 'anchored';

export type ReaderFocusState = {
  activeIndex: number;
  activeUnitId: string;
  anchorMode: AnchorMode;
};
