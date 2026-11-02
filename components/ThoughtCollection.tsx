"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import thoughts from "@/content/thoughts.json";
import { useIslandDialog } from "@/lib/use-island-dialog";
import styles from "./ThoughtCollection.module.css";

const SAVE_KEY = "carter-thoughts-saved-v1";
const LAST_KEY = "carter-thoughts-last-v1";
const topics = ["All", "Writing", "Attention", "Being human", "Building", "Taipei", "Saved"];
const ids = new Set(thoughts.map(thought => thought.id));
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Taipei" });
const readLast = () => { try { return localStorage.getItem(LAST_KEY); } catch { return null; } };
const readSaved = (): string[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && ids.has(id)))] : [];
  } catch { return []; }
};

export default function ThoughtCollection({ initialId, onClose }: { initialId: string | null; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(() => {
    const id = initialId ?? readLast();
    return id && ids.has(id) ? id : thoughts[0].id;
  });
  const [saved, setSaved] = useState(readSaved);
  const [topic, setTopic] = useState("All");
  const [full, setFull] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "fallback">("idle");
  const [saveNotice, setSaveNotice] = useState("");
  const filtered = thoughts.filter(thought => topic === "All" || (topic === "Saved" ? saved.includes(thought.id) : thought.topic === topic));
  const current = filtered.find(thought => thought.id === selected) ?? filtered[0];
  const index = current ? filtered.indexOf(current) : -1;
  const shareUrl = current ? `${location.origin}/?thought=${current.id}#writing` : "";

  useIslandDialog(dialog, closeButton);
  const choose = (id: string) => {
    setSelected(id); setFull(false); setCopyState("idle"); setSaveNotice("");
    if (scroll.current) scroll.current.scrollTop = 0;
    try { localStorage.setItem(LAST_KEY, id); } catch { /* Reading works without storage. */ }
  };
  const filter = (next: string) => {
    const list = thoughts.filter(thought => next === "All" || (next === "Saved" ? saved.includes(thought.id) : thought.topic === next));
    setTopic(next); choose(list.find(thought => thought.id === current?.id)?.id ?? list[0]?.id ?? thoughts[0].id);
  };
  const save = () => {
    if (!current) return;
    const next = saved.includes(current.id) ? saved.filter(id => id !== current.id) : [...saved, current.id];
    setSaved(next);
    if (topic === "Saved") choose(filtered[index + 1]?.id ?? filtered[index - 1]?.id ?? selected);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); setSaveNotice(""); }
    catch { setSaveNotice("Saved for this visit. Your browser isn’t allowing storage."); }
  };

  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="thoughts-title" data-direct-navigation data-thought-collection
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.desk}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>From the writing desk</p><h2 id="thoughts-title">Loose thoughts.</h2><p className={styles.subtitle}>A selection from <a href="https://x.com/carterkowang/highlights" target="_blank" rel="noopener noreferrer">@carterkowang’s Highlights ↗</a></p></div>
        <button ref={closeButton} className={styles.close} type="button" aria-label="Close thoughts" onClick={onClose} autoFocus>×</button>
      </header>
      <nav className={styles.filters} aria-label="Filter thoughts">
        {topics.map(item => <button key={item} type="button" aria-pressed={topic === item} onClick={() => filter(item)}>{item}{item === "Saved" && saved.length > 0 ? ` · ${saved.length}` : ""}</button>)}
      </nav>
      <div ref={scroll} className={styles.scroll}>
        {current ? <article key={current.id} className={styles.paper} data-thought-id={current.id} data-full={full}>
          <div className={styles.meta}><span>{current.topic}</span><time dateTime={current.date}>{dateFormat.format(new Date(current.date))}</time></div>
          <div className={full ? styles.full : styles.excerpt}>
            {(full ? current.text : current.excerpt).split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
          </div>
          {current.excerpt !== current.text && <button className={styles.read} type="button" aria-expanded={full} onClick={() => { setFull(value => !value); if (scroll.current) scroll.current.scrollTop = 0; }}>{full ? "Back to the excerpt ↑" : "Read the full thought ↓"}</button>}
          {full && current.hasQuotedContext && <p className={styles.context}>Originally shared with a quoted post. <a href={current.source} target="_blank" rel="noopener noreferrer">View the context on X ↗</a></p>}
          {current.related && <a className={styles.related} href={current.related.href} target={current.related.href.startsWith("/") ? undefined : "_blank"} rel={current.related.href.startsWith("/") ? undefined : "noopener noreferrer"}>
            <span>{current.related.kind}</span><strong>{current.related.title} {current.related.href.startsWith("/") ? "→" : "↗"}</strong>
          </a>}
          <footer className={styles.paperFooter}>
            <a href={current.source} target="_blank" rel="noopener noreferrer">Original post ↗</a>
            <div><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setCopyState("copied"); } catch { setCopyState("fallback"); } }}>{copyState === "copied" ? "Link copied" : "Copy link"}</button>
              <button type="button" aria-pressed={saved.includes(current.id)} aria-label={saved.includes(current.id) ? "Unsave thought" : "Save thought"} onClick={save}>
                <svg viewBox="0 0 16 20" width="13" height="16" fill={saved.includes(current.id) ? "currentColor" : "none"} aria-hidden="true"><path d="M2 1h12v17l-6-4-6 4Z" stroke="currentColor" strokeWidth="1.3" /></svg>{saved.includes(current.id) ? "Saved" : "Save"}
              </button></div>
          </footer>
          {copyState === "fallback" && <label className={styles.copy}>Copy this link<input aria-label="Link to this thought" readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} /></label>}
          <span className="sr-only" role="status">{copyState === "copied" ? "Link copied to clipboard." : ""}</span>
          {saveNotice && <p className={styles.context} role="status">{saveNotice}</p>}
        </article> : <div className={styles.empty}><h3>Keep a thought for later.</h3><p>Save the ones that stay with you.<br />They’ll be here when you come back on this device.</p><button type="button" onClick={() => filter("All")}>Browse all thoughts →</button></div>}
      </div>
      <footer className={styles.browse}>
        <button type="button" aria-label="Previous thought" disabled={filtered.length < 2} onClick={() => choose(filtered[(index - 1 + filtered.length) % filtered.length].id)}>← <span>Previous</span></button>
        <div><span className={styles.count} role="status" aria-live="polite">{current ? `${index + 1} of ${filtered.length}` : "No saved thoughts"}</span><button type="button" disabled={filtered.length < 2} onClick={() => choose(filtered[(index + 1 + Math.floor(Math.random() * (filtered.length - 1))) % filtered.length].id)}>Shuffle ↝</button></div>
        <button type="button" aria-label="Next thought" disabled={filtered.length < 2} onClick={() => choose(filtered[(index + 1) % filtered.length].id)}><span>Next</span> →</button>
      </footer>
    </div>
  </dialog>, document.body);
}
