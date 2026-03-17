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
        <ellipse cx="90" cy="162" rx="60" ry="4" fill="rgba(0,0,0,0.06)" />

        {/* === Desk === */}
        {/* Desk surface (slight perspective) */}
        <path d="M30 100 L135 97 L135 103 L30 106 Z" fill="#1a1a1a" />
        {/* Far desk leg */}
        <rect x="34" y="103" width="3" height="50" rx="1" fill="#333" />
        {/* Near desk leg */}
        <rect x="130" y="100" width="3.5" height="52" rx="1" fill="#2a2a2a" />

        {/* === Chair (proper office chair, side view) === */}
        {/* Chair back frame */}
        <path d="M112 68 L116 68 L118 120 L112 120 Z" fill="#333" />
        {/* Chair backrest (curved mesh) */}
        <path
          d="M110 68 C108 72, 108 82, 110 88 L116 88 C118 82, 118 72, 116 68 Z"
          fill="#2a2a2a"
        />
        {/* Backrest horizontal lines (mesh detail) */}
        <line x1="110" y1="74" x2="116" y2="74" stroke="#3a3a3a" strokeWidth="0.5" />
        <line x1="110" y1="80" x2="116" y2="80" stroke="#3a3a3a" strokeWidth="0.5" />
        {/* Chair seat cushion */}
        <path d="M92 120 L120 120 L122 127 L90 127 Z" fill="#2a2a2a" rx="2" />
        {/* Seat front edge highlight */}
        <path d="M90 125 L122 125 L122 127 L90 127 Z" fill="#333" />
        {/* Chair stem */}
        <rect x="104" y="127" width="4" height="14" rx="1.5" fill="#444" />
        {/* Chair base (5-star base, side view shows 2 arms) */}
        <path d="M92 141 L120 141" stroke="#444" strokeWidth="2.5" strokeLinecap="round" />
        {/* Armrest */}
        <path d="M94 112 L112 112" stroke="#3a3a3a" strokeWidth="2" strokeLinecap="round" />
        <rect x="92" y="108" width="2.5" height="12" rx="1" fill="#3a3a3a" />
        {/* Caster wheels */}
        <circle cx="92" cy="143" r="2.5" fill="#555" />
        <circle cx="120" cy="143" r="2.5" fill="#555" />

        {/* === MacBook (side view) === */}
        {/* Laptop base */}
        <path d="M44 94 L95 91 L95 97 L44 100 Z" fill="#666" />
        {/* Laptop screen */}
        <path d="M48 56 L92 53 L95 91 L50 94 Z" fill="#1a1a1a" />
        {/* Screen bezel inner */}
        <path d="M51 59 L90 56.5 L92 88 L53 91 Z" fill="#111" />
        {/* Screen content */}
        <g className="screen-lines">
          <line x1="55" y1="63" x2="70" y2="62" stroke="#ccc" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
          <line x1="55" y1="67" x2="82" y2="66" stroke="#999" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          <line x1="55" y1="71" x2="76" y2="70" stroke="#bbb" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
          <line x1="55" y1="75" x2="66" y2="74.5" stroke="#888" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
          <line x1="55" y1="79" x2="84" y2="78" stroke="#aaa" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
        </g>
        {/* Screen glow */}
        <path d="M51 59 L90 56.5 L92 88 L53 91 Z" fill="white" opacity="0.03" />

        {/* === Person (right side view, facing left) === */}

        {/* Head (profile) */}
        <g className="person-head">
          {/* Head shape */}
          <path
            d="M100 46 C94 42, 86 44, 83 50 C81 56, 82 62, 86 65 L90 67 C94 67, 98 63, 100 58 C102 52, 102 48, 100 46 Z"
            fill="#ddd"
          />
          {/* Hair — longer, below ears */}
          <path
            d="M101 44 C97 38, 88 37, 83 42 C80 45, 79 50, 80 54
               C81 50, 83 44, 90 42 C95 41, 99 43, 101 46 Z"
            fill="#1a1a1a"
          />
          {/* Side hair hanging down past ear */}
          <path
            d="M99 46 C101 50, 102 56, 101 62 C100 64, 99 65, 98 64
               C99 60, 100 54, 99 48 Z"
            fill="#222"
          />
          {/* Back hair */}
          <path
            d="M100 44 C102 48, 103 54, 102 60 L101 62 C102 56, 102 48, 100 44 Z"
            fill="#1a1a1a"
          />
          {/* Ear (partially hidden by hair) */}
          <ellipse cx="98" cy="55" rx="2" ry="3" fill="#ccc" />
          {/* Nose (profile) */}
          <path d="M83 53 L80 56 L83 57" fill="none" stroke="#bbb" strokeWidth="0.8" strokeLinecap="round" />
          {/* Jaw line */}
          <path d="M86 65 L90 67" fill="none" stroke="#c5c5c5" strokeWidth="0.5" />
        </g>

        {/* Neck */}
        <path d="M93 64 L97 64 L99 72 L91 72 Z" fill="#ddd" />

        {/* Torso (hoodie/shirt, side view) */}
        <path
          d="M87 72 C83 76, 81 84, 82 94 L84 120 L110 120 L112 94 C112 82, 108 72, 102 70 Z"
          fill="#1a1a1a"
        />
        {/* Hoodie/collar detail */}
        <path d="M90 72 C92 74, 96 74, 98 72" fill="none" stroke="#333" strokeWidth="1" />

        {/* === Arms & Hands (typing) === */}
        {/* Upper arm (shoulder to elbow) */}
        <path
          d="M87 78 C83 82, 80 88, 78 92"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Forearm to keyboard */}
        <path
          d="M78 92 C74 94, 70 95, 66 95"
          fill="none"
          stroke="#222"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Far hand on keyboard */}
        <g className="hand-far">
          <ellipse cx="64" cy="95" rx="4" ry="2.5" fill="#ddd" />
          <g className="fingers-far">
            <line x1="61" y1="94" x2="59" y2="92" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="63" y1="93.5" x2="61" y2="91" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </g>

        {/* Near arm (closer to viewer, slightly thicker) */}
        <path
          d="M89 80 C85 84, 83 90, 81 93"
          fill="none"
          stroke="#111"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <path
          d="M81 93 C78 94, 76 95, 74 95"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="5.5"
          strokeLinecap="round"
        />

        {/* Near hand */}
        <g className="hand-near">
          <ellipse cx="73" cy="94.5" rx="4.5" ry="2.8" fill="#ddd" />
          <g className="fingers-near">
            <line x1="70" y1="93" x2="68" y2="90.5" stroke="#ddd" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="72" y1="92.5" x2="71" y2="90" stroke="#ddd" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        </g>

        {/* === Legs (seated, side view) === */}
        {/* Thigh */}
        <path d="M86 118 L68 120 L68 126 L86 124 Z" fill="#2a2a2a" />
        {/* Shin */}
        <path d="M66 120 L64 146 L70 146 L70 126 Z" fill="#2a2a2a" />
        {/* Shoe */}
        <path d="M58 144 L70 144 L70 149 L56 149 Z" fill="#1a1a1a" rx="1" />
        {/* Shoe sole */}
        <path d="M56 149 L70 149 L70 151 L55 151 Z" fill="#333" />
      </svg>
    </div>
  )
}
