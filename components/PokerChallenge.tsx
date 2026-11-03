"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIslandDialog } from "@/lib/use-island-dialog";
import styles from "./PokerChallenge.module.css";

const rounds = [
  { pot: 80, call: 20, hand: ["A♠", "J♠"], options: ["10%", "20%", "25%", "40%"], answer: "20%" },
  { pot: 150, call: 50, hand: ["K♥", "Q♥"], options: ["20%", "25%", "33.3%", "50%"], answer: "25%" },
  { pot: 100, call: 50, hand: ["9♣", "9♦"], options: ["25%", "33.3%", "40%", "50%"], answer: "33.3%" },
  { pot: 60, call: 40, hand: ["A♦", "K♣"], options: ["20%", "25%", "40%", "66.7%"], answer: "40%" },
];

export default function PokerChallenge({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const question = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const [round, setRound] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const current = rounds[round];

  useIslandDialog(dialog, closeButton);

  const answer = (value: string) => {
    if (selected !== null) return;
    setSelected(value);
    if (value === current.answer) setScore(value => value + 1);
    // Disabling the selected answer otherwise drops focus onto the body.
    requestAnimationFrame(() => feedback.current?.focus());
  };
  const next = () => {
    if (round === rounds.length - 1) setFinished(true);
    else { setRound(value => value + 1); setSelected(null); }
    requestAnimationFrame(() => question.current?.focus());
  };

  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="poker-title"
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const focusable = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.content}>
      <header className={styles.header}>
        <p>Poker Odds</p>
        <button ref={closeButton} type="button" className={styles.close} onClick={onClose} aria-label="Close poker challenge">×</button>
      </header>
      {finished ? <>
        <h2 ref={question} tabIndex={-1} id="poker-title">{score} of {rounds.length} correct.</h2>
        <button className={styles.next} type="button" onClick={() => {
          setRound(0); setSelected(null); setScore(0); setFinished(false);
          requestAnimationFrame(() => question.current?.focus());
        }}>Play again</button>
      </> : <>
        <p className={styles.progress}>Hand {round + 1} of {rounds.length}</p>
        <div className={styles.hand} aria-label={`Your hand: ${current.hand.join(", ")}`}>
          {current.hand.map(card => <span key={card} className={styles.card} data-red={/[♥♦]/.test(card)} aria-hidden="true">{card}</span>)}
        </div>
        <h2 ref={question} tabIndex={-1} id="poker-title">How often do you need to win?</h2>
        <dl className={styles.stakes}>
          <div><dt>Pot</dt><dd>{current.pot}<span> chips</span></dd></div>
          <div><dt>Call</dt><dd>{current.call}<span> chips</span></dd></div>
        </dl>
        <p className={styles.assumption}>No more bets or fees.</p>
        <div className={styles.answers} role="group" aria-label="Choose the minimum break-even equity">
          {current.options.map(option => <button key={option} type="button" disabled={selected !== null}
            data-correct={selected !== null && option === current.answer} data-wrong={selected === option && option !== current.answer}
            onClick={() => answer(option)}>{option}</button>)}
        </div>
        <div ref={feedback} className={styles.feedback} role="status" aria-live="polite" tabIndex={-1}>
          {selected !== null && <><strong>{selected === current.answer ? "Correct." : `The answer is ${current.answer}.`}</strong>
            <span>{current.call} ÷ ({current.pot} + {current.call}) = {current.answer}.</span></>}
        </div>
        {selected !== null && <button type="button" className={styles.next} onClick={next}>{round === rounds.length - 1 ? "Results" : "Next"}</button>}
      </>}
      <footer className={styles.footer} data-direct-navigation>
        <a href="https://poker-odds-app-pink.vercel.app/" target="_blank" rel="noopener noreferrer" aria-label="Open poker calculator">Calculator</a>
      </footer>
    </div>
  </dialog>, document.body);
}
