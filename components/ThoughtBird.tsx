"use client";

import type { Ref } from "react";
import { FOLDED_WING, wingPath } from "@/lib/bird-flight";

const foldedWing = wingPath(FOLDED_WING);

export function BirdBranch() {
  return <>
    <path d="m-33 42 36 17 46-2m-33 2-9-9" fill="none" stroke="#63513c" strokeWidth="3.5" strokeLinecap="round" />
    <path d="m-32 41 36 17 44-2" fill="none" stroke="#a28c68" strokeWidth=".8" strokeLinecap="round" />
  </>;
}

export function BirdBody({ className, wingClassName, farWingClassName, legsRef, nearWingRef, farWingRef }: {
  className?: string; wingClassName?: string; farWingClassName?: string;
  legsRef?: Ref<SVGPathElement>; nearWingRef?: Ref<SVGPathElement>; farWingRef?: Ref<SVGPathElement>;
}) {
  return <g className={className}>
    <path ref={legsRef} d="m37 47-1 10m8-10 1 11m-13-1 8 1m1 0 8 1" stroke="#b39a70" strokeWidth="1.8" strokeLinecap="round" />
    <path ref={farWingRef} className={farWingClassName} d={foldedWing} fill="#2a78a8" />
    <path d="m48 36 21-10-7 15 9-2-17 13Z" fill="#3184b6" />
    <path d="M22 21c-1-8 5-14 12-14 8 0 13 5 14 13 9 4 15 12 12 20-3 10-15 14-25 10-9-3-14-13-13-22Z" fill="#55b3e0" />
    <path d="M25 31c1 12 9 20 19 20 7 0 13-3 16-8-12 5-24-1-28-14Z" fill="#298ac0" />
    <path ref={nearWingRef} className={wingClassName} d={foldedWing} fill="#378fc4" stroke="#73c7e9" strokeWidth=".8" />
    <path d="m22 23-11 3 11 4Z" fill="#d8ae70" />
    <path d="M27 13c4-3 9-3 12-1" fill="none" stroke="#9bd8ed" strokeWidth="2" strokeLinecap="round" />
    <circle cx="28" cy="20" r="2" fill="#102a3c" /><circle cx="27.5" cy="19.5" r=".65" fill="#f1f9f7" />
  </g>;
}
