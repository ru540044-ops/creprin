import { useEffect, useState } from 'react';
import { ev } from '../crime/events';

/** A decision put to you in the street: the situation in a line or two, and the things you can do about it. */
export default function ChoicePanel() {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 150); return () => clearInterval(id); }, []);
  const C = ev.choice; if (!C) return null;
  return (
    <div className="overlay choiceWrap" role="dialog" aria-label={C.title}>
      <div className="choiceBox">
        <h3>{C.title}{C.who && <small>{C.who}</small>}</h3>
        <p>{C.text}</p>
        <div className="choiceOpts">{C.options.map((o) => <button type="button" key={o.label} onClick={() => o.pick()}>{o.label}{o.sub && <small>{o.sub}</small>}</button>)}</div>
      </div>
    </div>
  );
}
