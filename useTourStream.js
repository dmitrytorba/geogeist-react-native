import { useCallback, useEffect, useRef, useState } from 'react';
import { startTourStream } from './tourStream';

// React state around startTourStream. Callbacks are read through a ref so
// `start` and `cancel` stay stable across renders.
// options: onReply(text), onMoveMap(payload), onKeyRequired(), onSuccess()
export default function useTourStream(options) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const streamRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState(null);

  const cancel = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.abort();
      streamRef.current = null;
    }
  }, []);

  const start = useCallback(
    ({ url, headers, body }) => {
      setError(null);
      setLoading(true);
      setStreaming(false);
      setStreamText('');
      cancel();

      const reset = () => {
        setLoading(false);
        setStreaming(false);
        setStreamText('');
      };

      const stream = startTourStream({
        url,
        headers,
        body,
        handlers: {
          onToken: (data) => {
            setLoading(false);
            setStreaming(true);
            setStreamText((prev) => prev + data);
          },
          onReply: (text) => {
            reset();
            optionsRef.current.onReply?.(text);
          },
          onMoveMap: (payload) => optionsRef.current.onMoveMap?.(payload),
          onEnd: () => {
            reset();
            streamRef.current = null;
          },
          onFailure: ({ keyRequired }) => {
            if (keyRequired) {
              optionsRef.current.onKeyRequired?.();
              setError('Add your OpenAI API key to continue.');
            } else {
              setError('Tour backend returned an error.');
            }
          },
          onSuccess: () => optionsRef.current.onSuccess?.(),
          onNetworkError: () => {
            if (streamRef.current === stream) streamRef.current = null;
            setError('Couldn’t reach the tour backend. Check backend URL/auth and try again.');
            reset();
          },
        },
      });
      streamRef.current = stream;
    },
    [cancel]
  );

  useEffect(() => cancel, [cancel]);

  return { loading, setLoading, streaming, streamText, error, setError, start, cancel };
}
