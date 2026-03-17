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
        <path d="M30 100 L135 97 L135 103 L30 106 Z" fill="#1a1a1a" />
        <rect x="34" y="103" width="3" height="50" rx="1" fill="#333" />
        <rect x="130" y="100" width="3.5" height="52" rx="1" fill="#2a2a2a" />

        {/* === Chair === */}
        <path d="M112 68 L116 68 L118 120 L112 120 Z" fill="#333" />
        <path d="M110 68 C108 72, 108 82, 110 88 L116 88 C118 82, 118 72, 116 68 Z" fill="#2a2a2a" />
        <line x1="110" y1="74" x2="116" y2="74" stroke="#3a3a3a" strokeWidth="0.5" />
        <line x1="110" y1="80" x2="116" y2="80" stroke="#3a3a3a" strokeWidth="0.5" />
        <path d="M95 120 L120 120 L122 127 L93 127 Z" fill="#2a2a2a" />
        <path d="M93 125 L122 125 L122 127 L93 127 Z" fill="#333" />
        <rect x="106" y="127" width="4" height="14" rx="1.5" fill="#444" />
        <path d="M95 141 L120 141" stroke="#444" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M97 112 L112 112" stroke="#3a3a3a" strokeWidth="2" strokeLinecap="round" />
        <rect x="95" y="108" width="2.5" height="12" rx="1" fill="#3a3a3a" />
        <circle cx="95" cy="143" r="2.5" fill="#555" />
        <circle cx="120" cy="143" r="2.5" fill="#555" />

        {/* === MacBook === */}
        <path d="M44 94 L95 91 L95 97 L44 100 Z" fill="#666" />
        <path d="M48 56 L92 53 L95 91 L50 94 Z" fill="#1a1a1a" />
        <path d="M51 59 L90 56.5 L92 88 L53 91 Z" fill="#111" />
        <g className="screen-lines">
          <line x1="55" y1="63" x2="70" y2="62" stroke="#ccc" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
          <line x1="55" y1="67" x2="82" y2="66" stroke="#999" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          <line x1="55" y1="71" x2="76" y2="70" stroke="#bbb" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
          <line x1="55" y1="75" x2="66" y2="74.5" stroke="#888" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
          <line x1="55" y1="79" x2="84" y2="78" stroke="#aaa" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
        </g>
        <path d="M51 59 L90 56.5 L92 88 L53 91 Z" fill="white" opacity="0.03" />

        {/* === Person (3/4 back view — slight left cheek/jaw visible) === */}

        {/* Torso (slim) */}
        <path
          d="M90 72 C87 76, 85 84, 86 94 L87 120 L107 120 L108 94 C108 82, 106 72, 100 70 Z"
          fill="#1a1a1a"
        />
        <path d="M92 72 C94 73, 97 73, 99 72" fill="none" stroke="#333" strokeWidth="0.8" />

        {/* Neck (short, between head and torso) */}
        <path d="M90 68 L101 68 L102 72 L89 72 Z" fill="#ddd" />
        {/* Nape center line */}
        <path d="M96 68 L96 71" fill="none" stroke="#ccc" strokeWidth="0.4" />
        {/* Neck side shadow */}
        <path d="M90 68 C89 69, 89 71, 89 72" fill="none" stroke="#c8c8c8" strokeWidth="0.5" />

        {/* Head */}
        <g className="person-head">
          {/* Base head shape (dark — hair covers most of it) */}
          <ellipse cx="96" cy="54" rx="14" ry="14" fill="#333" />

          {/* Left cheek/jaw — small skin area */}
          <path
            d="M82 54 C81 57, 81 61, 83 64 C84 65, 86 66, 88 67
               L88 64 C86 62, 84 59, 83 56 Z"
            fill="#ddd"
          />
          {/* Jawline */}
          <path d="M83 63 C84 65, 86 66, 88 67" fill="none" stroke="#c5c5c5" strokeWidth="0.5" strokeLinecap="round" />

          {/* === Hair — Korean male tapered back cut === */}
          {/* Main hair volume on top (longer, swept right) */}
          <path
            d="M86 48 C85 42, 88 36, 96 34 C104 36, 110 42, 110 48
               C110 52, 109 55, 108 57 C106 54, 102 50, 96 49
               C92 49, 88 50, 86 52 Z"
            fill="#333"
          />
          {/* Top swept layer (direction: left to right) */}
          <path
            d="M86 44 C88 39, 93 36, 98 35 C96 37, 92 39, 88 43 Z"
            fill="#3a3a3a"
          />
          <path
            d="M90 40 C93 37, 98 35, 103 36 C100 38, 96 39, 92 41 Z"
            fill="#3d3d3d"
          />

          {/* Back of head — gradual taper from thick top to thin nape */}
          {/* Upper back (still thick) */}
          <path
            d="M108 57 C109 54, 110 50, 110 48 C110 52, 110 56, 109 59
               C108 61, 107 63, 106 64 L106 60 Z"
            fill="#333"
          />
          {/* Mid back (medium density) */}
          <path
            d="M90 60 C89 58, 88 55, 87 52 C87 54, 87.5 57, 88 59
               L90 62 C91 63, 94 64, 98 64 C102 64, 105 63, 106 61
               L106 64 C104 66, 100 67, 96 67 C92 67, 89 65, 88 63 Z"
            fill="#3a3a3a"
          />
          {/* Lower back (thin, tapered) */}
          <path
            d="M90 63 C89 62, 88 60, 88 59
               C88.5 61, 89 62.5, 90 64 C92 66, 94 67, 97 67
               C100 67, 103 66, 105 64 C106 63, 106 61, 106 60
               C106 62, 105 64, 104 65 C102 66, 99 66.5, 96 66.5
               C93 66.5, 91 65, 90 63 Z"
            fill="#444"
          />
          {/* Nape taper (very short, almost skin) */}
          <path
            d="M91 65 C93 66.5, 95 67, 97 67 C99 67, 101 66.5, 103 65
               C102 66, 99 67, 97 67 C95 67, 93 66, 91 65 Z"
            fill="#555"
          />

          {/* Hair flow lines (swept direction: ← to →) */}
          <path d="M87 46 C90 44, 96 43, 104 44" fill="none" stroke="#3a3a3a" strokeWidth="0.6" />
          <path d="M87 49 C91 47, 97 46, 106 48" fill="none" stroke="#3d3d3d" strokeWidth="0.5" />
          <path d="M88 52 C92 50, 98 49, 107 51" fill="none" stroke="#3a3a3a" strokeWidth="0.5" />
          <path d="M88 55 C93 53, 99 52, 107 54" fill="none" stroke="#444" strokeWidth="0.4" />
          <path d="M89 58 C94 56, 100 56, 106 58" fill="none" stroke="#444" strokeWidth="0.4" />
          <path d="M90 61 C94 60, 100 59, 105 61" fill="none" stroke="#4a4a4a" strokeWidth="0.3" />

          {/* Left side — covers down to jaw line */}
          <path
            d="M86 52 C85 50, 85 47, 86 44 C85.5 46, 84.5 49, 84 52
               C83.5 54, 83 56, 83 58 C83.5 60, 84 62, 85 63
               C84 61, 83.5 58, 84 55 C84.5 53, 85 52, 86 52 Z"
            fill="#3a3a3a"
          />
        </g>

        {/* === Arms & Hands === */}
        {/* Far arm */}
        <path d="M90 78 C87 82, 84 88, 82 92" fill="none" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
        <path d="M82 92 C78 94, 74 95, 70 95" fill="none" stroke="#222" strokeWidth="4.5" strokeLinecap="round" />

        <g className="hand-far">
          <ellipse cx="68" cy="95" rx="3.5" ry="2.2" fill="#ddd" />
          <g className="fingers-far">
            <line x1="65.5" y1="94" x2="64" y2="92.5" stroke="#ddd" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="67" y1="93.5" x2="65.5" y2="91.5" stroke="#ddd" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        </g>

        {/* Near arm */}
        <path d="M92 80 C89 84, 87 90, 85 93" fill="none" stroke="#111" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M85 93 C82 94, 80 95, 78 95" fill="none" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />

        <g className="hand-near">
          <ellipse cx="76.5" cy="94.5" rx="4" ry="2.5" fill="#ddd" />
          <g className="fingers-near">
            <line x1="74" y1="93" x2="72.5" y2="91" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="75.5" y1="92.5" x2="74.5" y2="90.5" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </g>

        {/* === Legs (crossed) === */}
        <path
          d="M90 118 C84 120, 76 122, 72 124 C70 126, 70 130, 74 134 L80 148"
          fill="none" stroke="#333" strokeWidth="5.5" strokeLinecap="round"
        />
        <path d="M76 146 L84 146 L84 150 L74 150 Z" fill="#2a2a2a" />

        <path
          d="M94 118 C88 120, 80 121, 74 120 C70 119, 66 120, 64 124 L60 138"
          fill="none" stroke="#2a2a2a" strokeWidth="6" strokeLinecap="round"
        />
        <path d="M56 136 L64 136 L64 140 L54 140 Z" fill="#1a1a1a" />
        <path d="M54 140 L64 140 L64 141.5 L53 141.5 Z" fill="#333" />
      </svg>
    </div>
  )
}
