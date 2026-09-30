// The opening and closing views show all three islands in tab order. Their
// placement lives in IslandHome.module.css (per breakpoint); the transport
// reads the Work island's laid-out box to aim the first zoom.
export const overviewOrder = ["work", "writing", "projects"] as const;

// Which way each island's hover annotation opens (compass corner), so the
// three prompts don't all appear in the same spot relative to the cursor.
export const tipSide = { work: "ne", writing: "sw", projects: "nw" } as const;
