export default function WorkingPerson() {
  return (
    <div className="working-person">
      <svg
        viewBox="0 0 180 170"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Floor shadow */}
        <ellipse cx="90" cy="162" rx="65" ry="5" fill="rgba(0,0,0,0.07)" />

        {/* === Desk (side view - angled) === */}
        {/* Far desk leg */}
        <rect x="38" y="100" width="3" height="52" rx="1" fill="#333" />
        {/* Near desk leg */}
        <rect x="128" y="100" width="3.5" height="54" rx="1" fill="#2a2a2a" />
        {/* Desk surface (trapezoid for perspective) */}
        <path d="M34 98 L132 96 L132 102 L34 104 Z" fill="#1a1a1a" />

        {/* === Chair (side view) === */}
        {/* Chair back - slightly angled */}
        <path d="M108 72 L112 72 L114 128 L108 128 Z" fill="#2a2a2a" />
        {/* Chair backrest curve */}
        <path d="M106 70 L114 70 L114 76 L106 76 Z" rx="2" fill="#222" />
        {/* Chair seat */}
        <path d="M88 126 L118 126 L120 131 L86 131 Z" fill="#2a2a2a" />
        {/* Chair base/stem */}
        <rect x="101" y="131" width="4" height="16" rx="1" fill="#333" />
        {/* Chair wheel base */}
        <path d="M88 147 L118 149 " stroke="#444" strokeWidth="3" strokeLinecap="round" />
        {/* Wheels */}
        <circle cx="88" cy="149" r="3" fill="#555" />
        <circle cx="118" cy="151" r="3" fill="#555" />

        {/* === MacBook (side view - screen angled toward person) === */}
        {/* Laptop base on desk */}
        <path d="M48 92 L92 90 L92 96 L48 98 Z" fill="#555" />
        {/* Laptop screen (angled, seen from side) */}
        <path d="M54 58 L90 56 L92 90 L56 92 Z" fill="#1a1a1a" />
        {/* Screen display */}
        <path d="M57 61 L88 59 L89 87 L58 89 Z" fill="#0f172a" />
        {/* Screen content lines */}
        <g className="screen-lines">
          <line x1="60" y1="65" x2="74" y2="64.5" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          <line x1="60" y1="69" x2="82" y2="68" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <line x1="60" y1="73" x2="78" y2="72.2" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <line x1="60" y1="77" x2="70" y2="76.5" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <line x1="60" y1="81" x2="84" y2="80" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        </g>
        {/* Screen glow */}
        <path d="M57 61 L88 59 L89 87 L58 89 Z" fill="#38bdf8" opacity="0.06" />

        {/* === Person (right side view - facing left toward screen) === */}
        {/* Head (profile facing left) */}
        <g className="person-head">
          {/* Head shape - profile */}
          <path
            d="M98 52 C92 48, 84 50, 82 56 C80 62, 82 68, 86 70 L90 72 C94 72, 98 68, 100 64 C102 58, 102 54, 98 52 Z"
            fill="#e8c4a0"
          />
          {/* Hair (side view) */}
          <path
            d="M98 50 C94 44, 86 44, 82 48 C80 50, 80 54, 82 56 C84 52, 88 48, 94 48 C96 48, 98 50, 98 52 Z"
            fill="#1a1a1a"
          />
          {/* Ear */}
          <ellipse cx="99" cy="60" rx="2.5" ry="3.5" fill="#d4a88a" />
          {/* Nose (profile) */}
          <path d="M82 60 L79 63 L82 64" fill="none" stroke="#d4a88a" strokeWidth="1" strokeLinecap="round" />
          {/* Mouth hint */}
          <path d="M82 67 L85 68" fill="none" stroke="#c4956a" strokeWidth="0.8" strokeLinecap="round" />
        </g>

        {/* Neck */}
        <path d="M92 70 L96 70 L98 78 L90 78 Z" fill="#e8c4a0" />

        {/* Torso (side view - leaning slightly forward) */}
        <path
          d="M86 78 C82 82, 80 90, 82 100 L84 126 L108 126 L110 100 C110 88, 106 78, 100 76 Z"
          fill="#1a1a1a"
        />

        {/* === Arms & Hands (typing - key animation) === */}
        {/* Upper arm */}
        <path
          d="M86 82 C82 86, 78 92, 76 96"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Left hand (far hand on keyboard) */}
        <g className="hand-far">
          <path
            d="M62 96 L66 94 L68 96 L64 98 Z"
            fill="#e8c4a0"
          />
          {/* Fingers tapping */}
          <g className="fingers-far">
            <line x1="62" y1="96" x2="60" y2="94" stroke="#e8c4a0" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="64" y1="95" x2="62" y2="92" stroke="#e8c4a0" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </g>

        {/* Forearm to keyboard */}
        <path
          d="M76 96 C72 96, 68 96, 66 96"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Near hand (closer to viewer) */}
        <g className="hand-near">
          <path
            d="M76 94 L80 92 L82 94 L78 96 Z"
            fill="#e8c4a0"
          />
          {/* Fingers tapping */}
          <g className="fingers-near">
            <line x1="78" y1="93" x2="76" y2="90" stroke="#e8c4a0" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="80" y1="92" x2="79" y2="89" stroke="#e8c4a0" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        </g>

        {/* Near arm */}
        <path
          d="M88 84 C84 88, 82 92, 80 94"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="6.5"
          strokeLinecap="round"
        />

        {/* === Legs (side view, seated) === */}
        {/* Thigh */}
        <path d="M86 124 L68 126 L68 132 L86 130 Z" fill="#2a2a2a" />
        {/* Shin going down */}
        <path d="M66 126 L64 150 L70 150 L70 132 Z" fill="#2a2a2a" />
        {/* Shoe */}
        <path d="M58 148 L70 148 L70 154 L56 154 Z" rx="2" fill="#1a1a1a" />

        {/* Small plant on desk */}
        <g>
          <rect x="40" y="86" width="6" height="8" rx="1.5" fill="#d4a574" />
          <circle cx="43" cy="83" r="5" fill="#22c55e" opacity="0.6" />
          <circle cx="40" cy="81" r="3.5" fill="#16a34a" opacity="0.5" />
          <circle cx="46" cy="80" r="3" fill="#15803d" opacity="0.4" />
        </g>
      </svg>
    </div>
  )
}
