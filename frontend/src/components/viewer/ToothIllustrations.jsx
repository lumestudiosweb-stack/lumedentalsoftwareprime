/* ──────────────────────────────────────────────────────────────────────
   ToothIllustrations — detailed inline SVG renderings of:
     • 5 disease-progression stages (Enamel → Tooth Loss)
     • 8 treatment options (Filling → No Treatment)

   Aiming for the polished medical-illustration look in the Dentaverse
   reference: anatomical molar silhouette with cusps + gum line + roots,
   realistic decay coloring (brown stains, dark cavitation, exposed
   pulp, bone destruction), and material-specific shading for each
   treatment (silver-amalgam reflectivity, ceramic translucency, metal
   crown polish, implant titanium thread).

   All purely SVG (zero asset weight, scales crisply at any size).
─────────────────────────────────────────────────────────────────────── */

const TOOTH_VB = '0 0 96 110';

// ── Reusable shared paths ─────────────────────────────────────────────
const TOOTH_OUTLINE =
  'M 20 18 C 18 8, 30 4, 38 8 ' +     // upper-left cusp
  'C 42 5, 50 5, 54 8 ' +              // middle cusp valley
  'C 62 4, 74 8, 72 18 ' +             // upper-right cusp
  'L 70 32 ' +
  'C 70 42, 65 70, 56 78 ' +           // right side down to root
  'L 56 88 C 56 92, 50 92, 48 88 ' +   // mesial root tip
  'L 46 78 C 38 70, 22 42, 22 32 Z';   // back up the left side

const GUM_PATH =
  'M 8 80 C 10 76, 18 75, 30 78 ' +
  'C 38 81, 56 81, 64 78 ' +
  'C 78 75, 86 76, 88 80 ' +
  'L 88 105 L 8 105 Z';

const ROOT_LEFT_TIP  = { x: 36, y: 102 };
const ROOT_RIGHT_TIP = { x: 60, y: 102 };

/* ──────────────────────────────────────────────────────────────────────
   DISEASE PROGRESSION (5 stages)
─────────────────────────────────────────────────────────────────────── */

export function StageEnamelDecay({ size = 64 }) {
  return (
    <svg viewBox={TOOTH_VB} width={size} height={size * (110/96)} fill="none">
      <defs>
        <radialGradient id="s1-enamel" cx="0.5" cy="0.3" r="0.6">
          <stop offset="0%"  stopColor="#fff8e8" />
          <stop offset="60%" stopColor="#f3e2bf" />
          <stop offset="100%" stopColor="#cda674" />
        </radialGradient>
        <linearGradient id="s1-gum" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b85564" />
          <stop offset="100%" stopColor="#7a2d3c" />
        </linearGradient>
      </defs>
      <path d={TOOTH_OUTLINE} fill="url(#s1-enamel)" stroke="rgba(0,0,0,0.35)" strokeWidth="0.5" />
      {/* Cusp highlights */}
      <path d="M 24 14 Q 30 10 36 13 L 34 22 Z" fill="rgba(255,255,255,0.20)" />
      <path d="M 56 14 Q 62 10 68 14 L 66 22 Z" fill="rgba(255,255,255,0.20)" />
      {/* Early demineralization — chalky white spot in the central groove */}
      <ellipse cx="46" cy="26" rx="6" ry="3" fill="rgba(245,235,215,0.85)" />
      {/* Small brown beginning of decay */}
      <ellipse cx="46" cy="26" rx="3" ry="1.5" fill="rgba(120,75,30,0.85)" />
      <path d={GUM_PATH} fill="url(#s1-gum)" />
    </svg>
  );
}

export function StageDentinInvolvement({ size = 64 }) {
  return (
    <svg viewBox={TOOTH_VB} width={size} height={size * (110/96)} fill="none">
      <defs>
        <radialGradient id="s2-enamel" cx="0.5" cy="0.3" r="0.6">
          <stop offset="0%"  stopColor="#f4dfb6" />
          <stop offset="60%" stopColor="#d8b075" />
          <stop offset="100%" stopColor="#a8753c" />
        </radialGradient>
        <radialGradient id="s2-cavity" cx="0.5" cy="0.4" r="0.55">
          <stop offset="0%"  stopColor="#1a0700" />
          <stop offset="50%" stopColor="#3a1a08" />
          <stop offset="100%" stopColor="#5a2a10" />
        </radialGradient>
        <linearGradient id="s2-gum" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b85564" />
          <stop offset="100%" stopColor="#7a2d3c" />
        </linearGradient>
      </defs>
      <path d={TOOTH_OUTLINE} fill="url(#s2-enamel)" stroke="rgba(0,0,0,0.35)" strokeWidth="0.5" />
      <path d="M 24 14 Q 30 10 36 13 L 34 22 Z" fill="rgba(255,255,255,0.15)" />
      <path d="M 56 14 Q 62 10 68 14 L 66 22 Z" fill="rgba(255,255,255,0.15)" />
      {/* Visible cavity — central pit with brown decay */}
      <ellipse cx="46" cy="28" rx="9" ry="6" fill="url(#s2-cavity)" />
      <ellipse cx="46" cy="28" rx="4" ry="2.5" fill="rgba(0,0,0,0.95)" />
      {/* Branching fissure lines */}
      <path d="M 46 22 L 44 18 M 46 22 L 49 17 M 46 34 L 43 40 M 46 34 L 49 40"
        stroke="rgba(20,8,2,0.7)" strokeWidth="1.2" strokeLinecap="round" />
      <path d={GUM_PATH} fill="url(#s2-gum)" />
    </svg>
  );
}

export function StagePulpExposure({ size = 64 }) {
  return (
    <svg viewBox={TOOTH_VB} width={size} height={size * (110/96)} fill="none">
      <defs>
        <radialGradient id="s3-enamel" cx="0.5" cy="0.3" r="0.6">
          <stop offset="0%"  stopColor="#dbb178" />
          <stop offset="60%" stopColor="#a07028" />
          <stop offset="100%" stopColor="#623515" />
        </radialGradient>
        <radialGradient id="s3-pulp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%"  stopColor="#ff1c1c" />
          <stop offset="40%" stopColor="#a8131a" />
          <stop offset="100%" stopColor="#3a0608" />
        </radialGradient>
        <linearGradient id="s3-gum" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b85564" />
          <stop offset="100%" stopColor="#7a2d3c" />
        </linearGradient>
      </defs>
      <path d={TOOTH_OUTLINE} fill="url(#s3-enamel)" stroke="rgba(0,0,0,0.35)" strokeWidth="0.5" />
      {/* Deep cavity penetrating to pulp */}
      <ellipse cx="46" cy="30" rx="12" ry="9" fill="rgba(0,0,0,0.95)" />
      {/* Pulp chamber exposed — red glow */}
      <ellipse cx="46" cy="42" rx="6" ry="9" fill="url(#s3-pulp)" />
      <ellipse cx="46" cy="38" rx="3.5" ry="5" fill="rgba(255,40,40,0.85)" />
      {/* Decay tracking down */}
      <path d="M 44 50 L 42 65 M 48 50 L 50 65"
        stroke="rgba(120,15,5,0.8)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d={GUM_PATH} fill="url(#s3-gum)" />
    </svg>
  );
}

export function StagePeriapicalInfection({ size = 64 }) {
  return (
    <svg viewBox={TOOTH_VB} width={size} height={size * (110/96)} fill="none">
      <defs>
        <radialGradient id="s4-enamel" cx="0.5" cy="0.3" r="0.6">
          <stop offset="0%"  stopColor="#a87830" />
          <stop offset="60%" stopColor="#6a4218" />
          <stop offset="100%" stopColor="#3a1f08" />
        </radialGradient>
        <radialGradient id="s4-abscess" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%"  stopColor="#c8141a" />
          <stop offset="60%" stopColor="#7a0612" />
          <stop offset="100%" stopColor="#2a0408" />
        </radialGradient>
        <linearGradient id="s4-gum" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9a4555" />
          <stop offset="100%" stopColor="#5a1d2c" />
        </linearGradient>
      </defs>
      <path d={TOOTH_OUTLINE} fill="url(#s4-enamel)" stroke="rgba(0,0,0,0.4)" strokeWidth="0.5" />
      {/* Full cavity destruction */}
      <ellipse cx="46" cy="32" rx="14" ry="10" fill="rgba(0,0,0,0.98)" />
      <path d="M 36 50 L 38 75 M 46 52 L 46 80 M 56 50 L 54 75"
        stroke="rgba(0,0,0,0.85)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d={GUM_PATH} fill="url(#s4-gum)" />
      {/* Periapical abscesses at root tips */}
      <ellipse cx={ROOT_LEFT_TIP.x} cy={ROOT_LEFT_TIP.y - 2} rx="7" ry="5" fill="url(#s4-abscess)" />
      <ellipse cx={ROOT_RIGHT_TIP.x} cy={ROOT_RIGHT_TIP.y - 2} rx="7" ry="5" fill="url(#s4-abscess)" />
      {/* Bone destruction dots */}
      <circle cx="28" cy="98" r="1.4" fill="rgba(50,15,10,0.7)" />
      <circle cx="68" cy="98" r="1.4" fill="rgba(50,15,10,0.7)" />
      <circle cx="42" cy="105" r="1.2" fill="rgba(50,15,10,0.7)" />
    </svg>
  );
}

export function StageToothLoss({ size = 64 }) {
  return (
    <svg viewBox={TOOTH_VB} width={size} height={size * (110/96)} fill="none">
      <defs>
        <linearGradient id="s5-gum" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9a4555" />
          <stop offset="100%" stopColor="#5a1d2c" />
        </linearGradient>
      </defs>
      {/* Dashed silhouette of the missing tooth */}
      <path d={TOOTH_OUTLINE} fill="none"
        stroke="rgba(200,205,220,0.55)" strokeWidth="0.9" strokeDasharray="3 2.5" />
      <path d={GUM_PATH} fill="url(#s5-gum)" />
      {/* Empty socket darker hole in the gum */}
      <ellipse cx="46" cy="80" rx="13" ry="5" fill="rgba(40,15,20,0.85)" />
      <ellipse cx="46" cy="80" rx="9" ry="3" fill="rgba(15,5,8,0.9)" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   TREATMENT OPTIONS (8 tiles)
─────────────────────────────────────────────────────────────────────── */

function HealthyToothBase({ glow = 'rgba(255,255,255,0.20)' }) {
  return (
    <>
      <defs>
        <radialGradient id="t-enamel" cx="0.5" cy="0.3" r="0.6">
          <stop offset="0%"  stopColor="#fffaf0" />
          <stop offset="60%" stopColor="#f0dfb8" />
          <stop offset="100%" stopColor="#c69e60" />
        </radialGradient>
        <linearGradient id="t-gum" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b85564" />
          <stop offset="100%" stopColor="#7a2d3c" />
        </linearGradient>
      </defs>
      <path d={TOOTH_OUTLINE} fill="url(#t-enamel)" stroke="rgba(0,0,0,0.35)" strokeWidth="0.5" />
      <path d="M 24 14 Q 30 10 36 13 L 34 22 Z" fill={glow} />
      <path d="M 56 14 Q 62 10 68 14 L 66 22 Z" fill={glow} />
      <path d={GUM_PATH} fill="url(#t-gum)" />
    </>
  );
}

export function TreatmentFilling({ size = 64 }) {
  return (
    <svg viewBox={TOOTH_VB} width={size} height={size * (110/96)} fill="none">
      <HealthyToothBase />
      <defs>
        <linearGradient id="amalgam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#e8e8ef" />
          <stop offset="40%" stopColor="#9aa0ad" />
          <stop offset="100%" stopColor="#3a3e48" />
        </linearGradient>
      </defs>
      {/* Silver-amalgam filling in the central groove */}
      <ellipse cx="46" cy="26" rx="11" ry="6" fill="url(#amalgam)" stroke="rgba(0,0,0,0.4)" strokeWidth="0.4" />
      <ellipse cx="42" cy="23" rx="3" ry="1.5" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}

export function TreatmentInlay({ size = 64 }) {
  return (
    <svg viewBox={TOOTH_VB} width={size} height={size * (110/96)} fill="none">
      <HealthyToothBase />
      <defs>
        <linearGradient id="ceramic-inlay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#fffaf0" />
          <stop offset="60%" stopColor="#e8d6b0" />
          <stop offset="100%" stopColor="#b58f5f" />
        </linearGradient>
      </defs>
      {/* Tooth-coloured ceramic inlay covering one cusp */}
      <path d="M 38 14 L 56 14 L 60 22 L 50 30 L 38 26 Z"
        fill="url(#ceramic-inlay)" stroke="rgba(120,90,50,0.6)" strokeWidth="0.5" />
      <path d="M 40 16 L 50 16 L 50 18 L 42 18 Z" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}

export function TreatmentCrown({ size = 64 }) {
  return (
    <svg viewBox={TOOTH_VB} width={size} height={size * (110/96)} fill="none">
      <defs>
        <radialGradient id="crown-ceramic" cx="0.5" cy="0.25" r="0.65">
          <stop offset="0%"  stopColor="#ffffff" />
          <stop offset="50%" stopColor="#f3eddf" />
          <stop offset="100%" stopColor="#a08760" />
        </radialGradient>
        <linearGradient id="crown-gum" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b85564" />
          <stop offset="100%" stopColor="#7a2d3c" />
        </linearGradient>
      </defs>
      {/* Crown cap — slightly larger, glossy ceramic */}
      <path d={TOOTH_OUTLINE} fill="url(#crown-ceramic)" stroke="rgba(80,60,30,0.55)" strokeWidth="0.6" />
      {/* Specular highlights */}
      <path d="M 24 14 Q 30 9 38 12 L 36 26 Q 30 22 26 24 Z" fill="rgba(255,255,255,0.50)" />
      <path d="M 56 14 Q 62 9 70 14 L 66 26 Q 62 22 58 24 Z" fill="rgba(255,255,255,0.35)" />
      <ellipse cx="46" cy="22" rx="6" ry="2" fill="rgba(255,255,255,0.40)" />
      {/* Subtle crown margin line at the gum */}
      <path d="M 22 70 Q 46 76 70 70" stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" fill="none" />
      <path d={GUM_PATH} fill="url(#crown-gum)" />
    </svg>
  );
}

export function TreatmentRootCanal({ size = 64 }) {
  return (
    <svg viewBox={TOOTH_VB} width={size} height={size * (110/96)} fill="none">
      <HealthyToothBase glow="rgba(255,255,255,0.15)" />
      <defs>
        <linearGradient id="gutta" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#e87435" />
          <stop offset="100%" stopColor="#7a3008" />
        </linearGradient>
      </defs>
      {/* Access opening on the chewing surface */}
      <ellipse cx="46" cy="20" rx="5" ry="2.5" fill="#1a0a04" />
      {/* Gutta-percha filled root canals (visible through dentin) */}
      <path d="M 44 24 L 40 72 L 38 80 L 36 82 L 38 78 L 44 28 Z" fill="url(#gutta)" />
      <path d="M 48 24 L 52 72 L 54 80 L 56 82 L 54 78 L 48 28 Z" fill="url(#gutta)" />
      {/* Subtle crown placed on top of an RCT'd tooth */}
      <path d="M 22 11 Q 46 6 70 11 L 68 18 L 24 18 Z"
        fill="rgba(255,253,240,0.85)" stroke="rgba(80,60,30,0.5)" strokeWidth="0.4" />
    </svg>
  );
}

export function TreatmentExtraction({ size = 64 }) {
  return (
    <svg viewBox={TOOTH_VB} width={size} height={size * (110/96)} fill="none">
      <defs>
        <linearGradient id="ext-gum" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9a4555" />
          <stop offset="100%" stopColor="#5a1d2c" />
        </linearGradient>
      </defs>
      {/* Tooth shown but dashed and lifted, with an arrow up */}
      <path d={TOOTH_OUTLINE} transform="translate(0 -6)"
        fill="rgba(245,235,210,0.85)" stroke="rgba(0,0,0,0.5)" strokeWidth="0.5"
        strokeDasharray="2 1.5" />
      {/* Up arrow */}
      <path d="M 46 4 L 40 14 L 44 14 L 44 28 L 48 28 L 48 14 L 52 14 Z"
        fill="rgba(60,170,140,0.95)" stroke="rgba(0,0,0,0.4)" strokeWidth="0.3" />
      <path d={GUM_PATH} fill="url(#ext-gum)" />
      {/* Empty socket */}
      <ellipse cx="46" cy="80" rx="11" ry="4" fill="rgba(40,15,20,0.85)" />
    </svg>
  );
}

export function TreatmentImplant({ size = 64 }) {
  return (
    <svg viewBox={TOOTH_VB} width={size} height={size * (110/96)} fill="none">
      <defs>
        <radialGradient id="imp-crown" cx="0.5" cy="0.25" r="0.65">
          <stop offset="0%"  stopColor="#ffffff" />
          <stop offset="50%" stopColor="#f3eddf" />
          <stop offset="100%" stopColor="#a08760" />
        </radialGradient>
        <linearGradient id="imp-screw" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#d8dde6" />
          <stop offset="50%" stopColor="#8a9098" />
          <stop offset="100%" stopColor="#3a4048" />
        </linearGradient>
        <linearGradient id="imp-abut" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#d0d4dc" />
          <stop offset="100%" stopColor="#6a6e78" />
        </linearGradient>
        <linearGradient id="imp-gum" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b85564" />
          <stop offset="100%" stopColor="#7a2d3c" />
        </linearGradient>
      </defs>
      {/* Ceramic crown on top */}
      <path d={'M 22 10 C 22 6, 30 4, 38 6 ' +
                'C 42 4, 50 4, 54 6 ' +
                'C 62 4, 70 6, 70 10 ' +
                'L 68 36 L 24 36 Z'}
        fill="url(#imp-crown)" stroke="rgba(80,60,30,0.55)" strokeWidth="0.5" />
      <path d="M 26 12 Q 36 8 46 11 L 44 22 Q 36 18 28 22 Z" fill="rgba(255,255,255,0.45)" />
      {/* Abutment — short titanium cylinder */}
      <rect x="40" y="36" width="12" height="6" fill="url(#imp-abut)" stroke="rgba(0,0,0,0.4)" strokeWidth="0.3" />
      {/* Gum */}
      <path d={GUM_PATH} fill="url(#imp-gum)" />
      {/* Implant screw threads (visible through gum like an X-ray hint) */}
      <path d={'M 38 50 L 54 50 L 52 58 L 40 58 Z ' +
                'M 38 60 L 54 60 L 52 68 L 40 68 Z ' +
                'M 39 70 L 53 70 L 51 78 L 41 78 Z ' +
                'M 40 80 L 52 80 L 50 88 L 42 88 Z'}
        fill="url(#imp-screw)" stroke="rgba(0,0,0,0.35)" strokeWidth="0.3" />
      <path d="M 44 90 L 48 90 L 46 100 Z" fill="url(#imp-screw)" />
    </svg>
  );
}

export function TreatmentVeneer({ size = 64 }) {
  return (
    <svg viewBox={TOOTH_VB} width={size} height={size * (110/96)} fill="none">
      <HealthyToothBase />
      <defs>
        <linearGradient id="veneer-shell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f6efdd" />
        </linearGradient>
      </defs>
      {/* Veneer shell — thin white facing covering the facial surface */}
      <path d={'M 26 12 C 26 8, 34 6, 40 8 ' +
                'C 44 6, 50 6, 54 8 ' +
                'C 60 6, 68 8, 68 12 ' +
                'L 64 26 L 30 26 Z'}
        fill="url(#veneer-shell)"
        stroke="rgba(160,140,90,0.4)" strokeWidth="0.4" />
      {/* Highlight sheen */}
      <path d="M 30 12 Q 46 8 60 12 L 58 18 Q 46 14 32 18 Z" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}
