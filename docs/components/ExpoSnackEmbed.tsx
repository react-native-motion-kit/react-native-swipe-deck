import { useEffect, useRef } from 'react';

const SNACK_EMBED_SCRIPT_SRC = 'https://snack.expo.dev/embed.js';

let snackEmbedScriptPromise: Promise<void> | undefined;

type Props = {
  snackId: string;
  platform?: 'web' | 'ios' | 'android';
  preview?: boolean;
  height?: number | `${number}px`;
};

function loadSnackEmbedScript() {
  if (window.ExpoSnack) {
    return Promise.resolve();
  }

  if (snackEmbedScriptPromise) {
    return snackEmbedScriptPromise;
  }

  snackEmbedScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${SNACK_EMBED_SCRIPT_SRC}"]`,
    );
    const script = existingScript ?? document.createElement('script');

    const handleLoad = () => resolve();
    const handleError = () => {
      snackEmbedScriptPromise = undefined;
      reject(new Error('Failed to load Expo Snack embed script.'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    if (!existingScript) {
      script.src = SNACK_EMBED_SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return snackEmbedScriptPromise;
}

export function ExpoSnackEmbed({
  snackId,
  platform = 'web',
  preview = true,
  height = '505px',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    let isDisposed = false;

    const initializeEmbed = async () => {
      await loadSnackEmbedScript();

      if (isDisposed || !container) {
        return;
      }

      window.ExpoSnack?.remove?.(container);
      window.ExpoSnack?.append?.(container);
    };

    initializeEmbed().catch((error) => {
      console.error('Failed to initialize Expo Snack embed:', error);
    });

    return () => {
      isDisposed = true;

      if (container) {
        window.ExpoSnack?.remove?.(container);
      }
    };
  }, [platform, preview, snackId]);

  return (
    <div
      ref={containerRef}
      data-snack-id={snackId}
      data-snack-platform={platform}
      data-snack-preview={preview}
      data-snack-theme="dark"
      style={{
        overflow: 'hidden',
        border: '1px solid #282c34',
        borderRadius: '8px',
        height,
        width: '100%',
      }}
    />
  );
}
