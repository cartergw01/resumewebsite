"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { darkStillReady, lightsOn, ROOM_LIGHTS_EVENT, ROOM_LIGHTS_INTENT, setLights } from "@/lib/room-lights";
import styles from "./WorkshopDiscovery.module.css";

export function WorkshopSynth() {
  const audio = useRef<AudioContext | null>(null);
  const [sound, setSound] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => () => { void audio.current?.close(); }, []);
  const play = (name: string, hz: number) => {
    setNote(name);
    if (!sound || !audio.current) return;
    const context = audio.current;
    void context.resume().then(() => {
      if (context.state === "closed") return;
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = "sine"; oscillator.frequency.value = hz;
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(.12, context.currentTime + .015);
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .6);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + .65);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }).catch(() => setError(true));
  };
  return <section className={styles.reward} aria-label="Four-note synth">
    <div className={styles.rewardTitle}><h3>Play a little.</h3><button type="button" aria-pressed={sound} onClick={() => {
      try { audio.current ??= new AudioContext(); void audio.current.resume().catch(() => setError(true)); setSound(value => !value); }
      catch { setError(true); }
    }}>{sound ? "Sound on" : "Enable sound"}</button></div>
    <div className={styles.keys}>{[["C",261.63],["D",293.66],["E",329.63],["G",392]].map(([name,hz]) =>
      <button type="button" key={name} data-played={note === name} onClick={() => play(String(name), Number(hz))}>{name}</button>)}</div>
    <p role="status">{error ? "Audio is unavailable in this browser." : note ? `${note}${sound ? " ♪" : " · sound is off"}` : "Four notes. Your melody."}</p>
  </section>;
}

export function WorkshopHoops() {
  const [power, setPower] = useState(50);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const target = [64, 38, 77, 52, 29][round % 5];
  const made = result === "Swish. Two points.";
  return <section className={styles.reward} aria-label="Free throw challenge">
    <div className={styles.rewardTitle}><h3>Take a shot.</h3><span>{score} points · {round} {round === 1 ? "shot" : "shots"}</span></div>
    <label htmlFor="shot-power">Power <strong>{power}%</strong></label>
    <div className={styles.shotMeter} style={{ "--target": `${target}%`, "--power": `${power}%` } as CSSProperties}>
      <span className={styles.sweetSpot} /><span className={styles.powerMark} />
    </div>
    <input id="shot-power" aria-label="Shot power" type="range" min="0" max="100" value={power} onChange={e => { setPower(Number(e.target.value)); setResult(null); }} />
    <p>Aim for the gold mark, then shoot.</p>
    <button className={styles.primary} type="button" onClick={() => {
      const hit = Math.abs(power - target) <= 5;
      if (hit) setScore(value => value + 2);
      setResult(hit ? "Swish. Two points." : power < target ? "A little short. Add some power." : "Too strong. A softer touch.");
      setRound(value => value + 1);
    }}>Shoot</button>
    <p role="status" data-made={made}>{result ?? "Your first shot is ready."}</p>
  </section>;
}

export function WorkshopClocks() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  return <section className={styles.reward} aria-label="World clocks"><h3>Same moment. Three cities.</h3>
    <dl className={styles.clocks}>{[["Taipei","Asia/Taipei"],["San Francisco","America/Los_Angeles"],["New York","America/New_York"]].map(([name,zone]) =>
      <div key={zone}><dt>{name}</dt><dd>{new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(now)}</dd></div>)}</dl>
  </section>;
}

export function WorkshopLights() {
  const [on, setOn] = useState(() => lightsOn("projects"));
  const [busy, setBusy] = useState(false);
  useEffect(() => { const sync = () => setOn(lightsOn("projects")); window.addEventListener(ROOM_LIGHTS_EVENT,sync); return () => window.removeEventListener(ROOM_LIGHTS_EVENT,sync); }, []);
  return <section className={styles.reward}><h3>Set the room’s mood.</h3>
    <button type="button" className={styles.primary} disabled={busy} aria-pressed={on} onClick={async () => {
      if (on) { setBusy(true); window.dispatchEvent(new CustomEvent(ROOM_LIGHTS_INTENT,{detail:"projects"})); await darkStillReady("projects"); setBusy(false); }
      setLights("projects", !on);
    }}>{busy ? "Readying the lights…" : on ? "Turn workshop lights off" : "Turn workshop lights on"}</button>
    <p role="status">{on ? "The workshop is lit." : "Moonlight. Close this view to look around."}</p>
  </section>;
}
