interface Window {
  ExpoSnack?: {
    append?: (element: HTMLElement) => void;
    initialize?: () => void;
    remove?: (element: HTMLElement) => void;
  };
}
