"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIslandDialog } from "@/lib/use-island-dialog";
import { essays, islandProjects as projects } from "@/content/portfolio";
import { curios } from "@/lib/workshop-discoveries";
import WorkshopModel from "./WorkshopModel";
import { WorkshopClocks, WorkshopHoops, WorkshopLights, WorkshopSynth } from "./WorkshopRewards";
import styles from "./WorkshopDiscovery.module.css";

export default function WorkshopDiscovery({ selected, onSelect, onFound, onClose, onPoker, onArcade }: {
  selected: string; onSelect: (id:string)=>void; onFound:(id:string)=>void; onClose:()=>void; onPoker:()=>void; onArcade:()=>void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [query, setQuery] = useState("");
  const [glow, setGlow] = useState(false);
  const item = curios.find(object => object.id === selected);
  const [inspected, setInspected] = useState(item);
  const model = item ?? inspected;
  const essay = item?.essay && essays.find(essay => essay.title === item.essay);
  const project = item?.project ? projects.find(project => project.id === item.project) : undefined;
  const hasAction = !!item && item.reward !== "inspect";
  const hasDetails = hasAction || !!essay || !!item?.research || !!project;
  useIslandDialog(dialog, title);
  useLayoutEffect(() => {
    if (!dialog.current?.open) return;
    dialog.current.scrollTop = 0;
    title.current?.focus({ preventScroll: true });
  }, [selected]);
  const select = (id:string) => {
    const next = curios.find(object => object.id === id);
    if (next) setInspected(next);
    onSelect(id); setGlow(false);
  };
  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="discovery-title" data-discovery={selected}
    onCancel={event=>{event.preventDefault();onClose();}}
    onClick={event=>{if(event.target===event.currentTarget)onClose();}}
    onKeyDown={event=>{
      if(event.key!=="Tab")return;
      const nodes=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled)')).filter(node=>node.getClientRects().length>0);
      const first=nodes[0],last=nodes[nodes.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }}>
    <div className={styles.sheet}>
      <header className={styles.header}>
        <h2 id="discovery-title" ref={title} tabIndex={-1}>{item?.name ?? "Objects"}</h2>
        <button type="button" className={styles.close} aria-label="Close discovery" onClick={onClose}>×</button>
      </header>
        <div className={styles.inspection} hidden={!item} data-has-action={hasAction}>
          {model && <WorkshopModel src={model.src} name={model.name} bounds={model.bounds} glow={glow} />}
          {item && hasDetails && <div className={styles.details} key={`details-${item.id}`}>
            {item.reward === "hoops" && <WorkshopHoops />}
            {item.reward === "synth" && <WorkshopSynth />}
            {item.reward === "clocks" && <WorkshopClocks />}
            {item.reward === "lights" && <WorkshopLights />}
            {item.reward === "lightstick" && <section className={styles.reward}><button className={styles.primary} type="button" aria-pressed={glow} aria-label={glow ? "Turn light stick off" : "Turn light stick on"} onClick={()=>setGlow(value=>!value)}>{glow?"Turn off":"Turn on"}</button></section>}
            {item.reward === "poker" && <section className={styles.reward}><button type="button" className={styles.primary} onClick={onPoker}>Play poker</button></section>}
            {essay && <a className={styles.related} data-direct-navigation href={essay.href} target="_blank" rel="noopener noreferrer"><strong>{essay.title}</strong></a>}
            {item.research === "SpaceX" && <a className={styles.related} data-direct-navigation href="https://research.contrary.com/company/spacex" target="_blank" rel="noopener noreferrer"><strong>SpaceX</strong></a>}
            {project?.id === "taipei-run" ? <button type="button" className={styles.primary} onClick={onArcade}>Taipei Run</button> : project && <a className={styles.related} data-direct-navigation href={project.href} target="_blank" rel="noopener noreferrer" onClick={()=>onFound(project.id)}><strong>{project.title}</strong></a>}
          </div>}
        </div>
      {item ? <>
        <nav className={styles.browse} aria-label="Explore more objects"><button type="button" onClick={()=>select("directory")}>All objects</button><button type="button" onClick={()=>select(curios[(curios.indexOf(item)+1)%curios.length].id)} aria-label="Next object">Next</button></nav>
      </> : <>
        <label className={styles.search}><span className="sr-only">Search objects</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search" /></label>
        <div className={styles.index}>
          {projects.filter(project=>project.title.toLowerCase().includes(query.toLowerCase())).map(project=>
            (project.id==="poker-odds" || project.id==="taipei-run") ? <button key={project.id} type="button" onClick={project.id==="poker-odds" ? onPoker : onArcade}><span>{project.title}</span></button> :
            <a key={project.id} href={project.href} data-direct-navigation target="_blank" rel="noopener noreferrer" onClick={()=>onFound(project.id)}><span>{project.title}</span></a>)}
          {curios.filter(object=>object.name.toLowerCase().includes(query.toLowerCase())).map(object=><button key={object.id} data-discovery-choice={object.id} type="button" onClick={()=>select(object.id)}><span>{object.name}</span></button>)}
        </div>
        {!projects.some(p=>p.title.toLowerCase().includes(query.toLowerCase()))&&!curios.some(o=>o.name.toLowerCase().includes(query.toLowerCase()))&&<p role="status">No objects found.</p>}
      </>}
    </div>
  </dialog>,document.body);
}
