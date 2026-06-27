interface Window {
  ExpoSnack?: {
    initialize?: () => void;
    embed?: (element: HTMLElement) => void;
  };
}
