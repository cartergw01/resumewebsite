export type EssayPreview = { title: string; subtitle: string; date: string; href: string };

function wrap(text: string, length: number) {
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines.length - 1;
    if (last < 0 || lines[last].length + word.length + 1 > length) lines.push(word);
    else lines[last] += ` ${word}`;
  }
  return lines;
}

// The same typeset page appears in the book, in flight, and in the archive.
export default function EssayLeaf({ essay }: { essay: EssayPreview }) {
  const title = wrap(essay.title, 15);
  return <>
    <rect width="320" height="400" fill="#ecdfc6" />
    <path d="M0 0h10v400H0Z" fill="#65503a" opacity="0.08" />
    <g fill="#392f26" fontFamily="var(--font-display), Georgia, serif">
      <text x="32" y="43" fontSize="15" fontStyle="italic">flying Arrows</text>
      <text x="32" y="78" fontSize="9" letterSpacing="1.1" fontFamily="Arial, sans-serif">{essay.date.toUpperCase()}</text>
      <text fontSize="34" fontWeight="600" letterSpacing="-1.1">
        {title.map((line, index) => <tspan key={line} x="30" y={126 + index * 39}>{line}</tspan>)}
      </text>
      <path d={`M32 ${148 + title.length * 39}h30`} stroke="#8b7154" strokeWidth="1" />
      <text fontSize="13" fontFamily="Georgia, serif">
        {wrap(essay.subtitle, 35).map((line, index) => <tspan key={line} x="32" y={175 + title.length * 39 + index * 19}>{line}</tspan>)}
      </text>
      <text x="32" y="368" fontSize="11" fontStyle="italic">Carter Wang</text>
    </g>
  </>;
}
