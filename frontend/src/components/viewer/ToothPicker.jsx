/**
 * ToothPicker — FDI dental chart.
 *
 * Renders all 32 permanent teeth in the standard FDI quadrant layout:
 *
 *      18 17 16 15 14 13 12 11 │ 21 22 23 24 25 26 27 28      ← upper
 *      ─────────────────────────────────────────────────
 *      48 47 46 45 44 43 42 41 │ 31 32 33 34 35 36 37 38      ← lower
 *
 * Clicking any tooth fires `onPick(fdi)` and the picked tooth lights up.
 * Each tooth is drawn as a small SVG that varies by morphology
 * (molar / premolar / canine / incisor) so the chart actually looks
 * like a real dentition rather than identical squares.
 */
export default function ToothPicker({ value, onPick, highlightTeeth = [] }) {
  const upperRight = [18, 17, 16, 15, 14, 13, 12, 11];
  const upperLeft  = [21, 22, 23, 24, 25, 26, 27, 28];
  const lowerLeft  = [31, 32, 33, 34, 35, 36, 37, 38];
  const lowerRight = [48, 47, 46, 45, 44, 43, 42, 41];

  return (
    <div className="bg-surface-1 border border-white/5 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] text-gray-500 uppercase tracking-wider">FDI Tooth Chart</h3>
        {value && (
          <button
            onClick={() => onPick(null)}
            className="text-[10px] text-gray-500 hover:text-white transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Upper arch */}
      <div className="flex items-end justify-center gap-[2px] mb-1">
        {upperRight.map((fdi) => (
          <ToothBtn
            key={fdi}
            fdi={fdi}
            arch="upper"
            selected={value === fdi}
            highlighted={highlightTeeth.includes(fdi)}
            onClick={() => onPick(fdi)}
          />
        ))}
        <div className="w-[3px] h-7 bg-white/10 mx-[2px]" />
        {upperLeft.map((fdi) => (
          <ToothBtn
            key={fdi}
            fdi={fdi}
            arch="upper"
            selected={value === fdi}
            highlighted={highlightTeeth.includes(fdi)}
            onClick={() => onPick(fdi)}
          />
        ))}
      </div>

      <div className="h-px bg-white/10 my-1" />

      {/* Lower arch */}
      <div className="flex items-start justify-center gap-[2px] mt-1">
        {lowerRight.map((fdi) => (
          <ToothBtn
            key={fdi}
            fdi={fdi}
            arch="lower"
            selected={value === fdi}
            highlighted={highlightTeeth.includes(fdi)}
            onClick={() => onPick(fdi)}
          />
        ))}
        <div className="w-[3px] h-7 bg-white/10 mx-[2px]" />
        {lowerLeft.map((fdi) => (
          <ToothBtn
            key={fdi}
            fdi={fdi}
            arch="lower"
            selected={value === fdi}
            highlighted={highlightTeeth.includes(fdi)}
            onClick={() => onPick(fdi)}
          />
        ))}
      </div>

      {/* Quadrant labels */}
      <div className="flex justify-between text-[8px] text-gray-600 mt-2 px-1">
        <span>Patient&apos;s Right</span>
        <span>Patient&apos;s Left</span>
      </div>

      {value && (
        <div className="mt-3 pt-3 border-t border-white/5 text-[11px]">
          <div className="text-gray-500">Selected:</div>
          <div className="text-white font-semibold mt-0.5">
            #{value} — {toothName(value)}
          </div>
        </div>
      )}
    </div>
  );
}

function ToothBtn({ fdi, arch, selected, highlighted, onClick }) {
  const pos = fdi % 10;
  const type = pos >= 6 ? 'molar' : pos >= 4 ? 'premolar' : pos === 3 ? 'canine' : 'incisor';

  // Width scales with morphology
  const w = type === 'molar' ? 22 : type === 'premolar' ? 18 : type === 'canine' ? 14 : 12;
  const h = 28;

  const fill = selected
    ? '#3b82f6'
    : highlighted
    ? '#fbbf24'
    : '#e8e0d0';
  const stroke = selected ? '#1d4ed8' : highlighted ? '#d97706' : '#888';
  const textColor = selected || highlighted ? '#fff' : '#3a3a3a';

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center transition focus:outline-none"
      title={`Tooth #${fdi} (${toothName(fdi)})`}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {arch === 'upper' ? (
          <ToothShape type={type} w={w} h={h} fill={fill} stroke={stroke} flip={false} />
        ) : (
          <ToothShape type={type} w={w} h={h} fill={fill} stroke={stroke} flip={true} />
        )}
        <text
          x={w / 2}
          y={h / 2 + 3}
          textAnchor="middle"
          fontSize="7"
          fontWeight="600"
          fill={textColor}
          style={{ pointerEvents: 'none' }}
        >
          {fdi}
        </text>
      </svg>
    </button>
  );
}

function ToothShape({ type, w, h, fill, stroke, flip }) {
  // Draw a stylized crown silhouette (occlusal/incisal up, root down for upper).
  // For lower teeth we flip vertically so cusps point up at the chart.
  const sf = flip ? -1 : 1;
  const ty = flip ? h : 0;

  let d;
  if (type === 'molar') {
    d = `M2,${4} Q${w / 2},${0} ${w - 2},${4}
         L${w - 1},${h * 0.7}
         Q${w / 2},${h - 2} 1,${h * 0.7} Z`;
  } else if (type === 'premolar') {
    d = `M2,${5} Q${w / 2},${1} ${w - 2},${5}
         L${w - 1},${h * 0.7}
         Q${w / 2},${h - 2} 1,${h * 0.7} Z`;
  } else if (type === 'canine') {
    d = `M2,${7} Q${w / 2},${0} ${w - 2},${7}
         L${w - 1},${h * 0.75}
         Q${w / 2},${h - 1} 1,${h * 0.75} Z`;
  } else {
    // incisor — flat edge
    d = `M1,${5} L${w - 1},${5}
         L${w - 1},${h * 0.75}
         Q${w / 2},${h - 2} 1,${h * 0.75} Z`;
  }

  return (
    <path
      d={d}
      fill={fill}
      stroke={stroke}
      strokeWidth="1"
      transform={`translate(0,${ty}) scale(1,${sf})`}
    />
  );
}

export function toothName(fdi) {
  const pos = fdi % 10;
  const arch = fdi < 30 ? 'Upper' : 'Lower';
  const side = [1, 2, 3, 4, 5, 6, 7, 8].includes(Math.floor(fdi / 10)) ? '' : '';
  void side;
  const sideName = [1, 4].includes(Math.floor(fdi / 10)) ? 'Right' : 'Left';

  const names = {
    1: 'Central Incisor',
    2: 'Lateral Incisor',
    3: 'Canine',
    4: '1st Premolar',
    5: '2nd Premolar',
    6: '1st Molar',
    7: '2nd Molar',
    8: '3rd Molar',
  };
  return `${arch} ${sideName} ${names[pos] || ''}`.trim();
}
