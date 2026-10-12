import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Retain the outgoing route briefly, so sections do not abruptly disappear on tab changes. */
export function AnimatedScreen({ screen, children }: { screen: string; children: ReactNode }) {
  const latest = useRef(children);
  latest.current = children;
  const [displayed, setDisplayed] = useState(() => ({ screen, content: children }));
  const [exiting, setExiting] = useState(false);

  useLayoutEffect(() => {
    if (screen === displayed.screen) {
      setExiting(false);
      return;
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setDisplayed({ screen, content: latest.current });
      setExiting(false);
      return;
    }
    setExiting(true);
    const timeout = window.setTimeout(() => {
      setDisplayed({ screen, content: latest.current });
      setExiting(false);
    }, 155);
    return () => window.clearTimeout(timeout);
  }, [screen, displayed.screen]);

  return <div className="animated-route-stage">
    <div key={displayed.screen} className={`animated-route${exiting ? ' is-exiting' : ''}`}>
      {displayed.screen === screen ? children : displayed.content}
    </div>
  </div>;
}
