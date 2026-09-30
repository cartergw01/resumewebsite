// The opening and closing views show all three islands in tab order. Their
// placement lives in IslandHome.module.css (per breakpoint); the transport
// reads the Work island's laid-out box to aim the first zoom.
export const overviewOrder = ["work", "writing", "projects"] as const;
