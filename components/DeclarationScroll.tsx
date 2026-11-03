"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import { useIslandDialog } from "@/lib/use-island-dialog";
import declaration from "@/content/declaration.json";
import styles from "./DeclarationScroll.module.css";

export default function DeclarationScroll({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useIslandDialog(dialog, title);

  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="declaration-title" data-declaration
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button,a[href]"));
      // Keep every control reachable even when Safari skips links in its Tab order.
      const current = document.activeElement === title.current ? 0 : controls.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey ? (current <= 0 ? controls.length - 1 : current - 1) : (current + 1) % controls.length;
      event.preventDefault();
      controls[next]?.focus();
    }}>
    <div className={styles.scroll}>
      <button type="button" className={styles.close} aria-label="Close Declaration" onClick={onClose}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
      <div className={styles.paper} data-declaration-paper>
        <article className={styles.document} aria-label="Declaration of Independence transcript">
          <header className={styles.heading}>
            <p className={styles.date}>In Congress, <span>July 4, 1776.</span></p>
            <h2 id="declaration-title" ref={title} tabIndex={-1} aria-label="Declaration of Independence">
              The unanimous Declaration
              <small>of the thirteen united</small>
              States of America
            </h2>
          </header>
          <div className={styles.text} data-declaration-text>
            {declaration.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
          <section className={styles.signers} aria-label="Signers">
            <p className={styles.hancock}>John Hancock</p>
            <div className={styles.signatures}>
              {declaration.signers.map(group => <section key={group.state} aria-label={group.state}>
                <h3>{group.state}</h3>
                {group.names.filter(name => name !== "John Hancock").map(name => <p key={name}>{name}</p>)}
              </section>)}
            </div>
          </section>
          <footer className={styles.source}>
            <a href={declaration.source} data-direct-navigation target="_blank" rel="noopener noreferrer">National Archives transcript</a>
            <a href={declaration.original} data-direct-navigation target="_blank" rel="noopener noreferrer">View original</a>
          </footer>
        </article>
      </div>
    </div>
  </dialog>, document.body);
}
