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

        {/* Neck */}
        <path d="M94 64 L98 64 L99 72 L93 72 Z" fill="#ddd" />

        {/* Head */}
        <g className="person-head">
          {/* Base head shape */}
          <ellipse cx="96" cy="54" rx="13" ry="14" fill="#ddd" />

          {/* Left cheek/jaw visible — face skin peeking out */}
          <path
            d="M83 50 C82 54, 82 58, 83 62 C84 65, 86 67, 89 68
               L89 64 C87 62, 85 58, 84 54 C84 52, 83.5 51, 83 50 Z"
            fill="#ddd"
          />
          {/* Jawline shadow (subtle definition) */}
          <path
            d="M84 62 C85 64, 87 66, 89 67"
            fill="none" stroke="#c5c5c5" strokeWidth="0.6" strokeLinecap="round"
          />
          {/* Cheekbone hint */}
          <path
            d="M84 56 C85 57, 86 58, 87 58"
            fill="none" stroke="#d0d0d0" strokeWidth="0.5" strokeLinecap="round"
          />

          {/* Hair — back/top coverage, left side face exposed */}
          {/* Main hair mass — covers top and right side */}
          <path
            d="M87 48 C86 42, 88 36, 96 34 C106 36, 110 42, 109 50
               C109 56, 108 62, 106 66 C104 68, 100 70, 96 70
               C94 70, 92 69, 90 67 C89 65, 88 60, 87 56 Z"
            fill="#333"
          />
          {/* Top crown — lighter brown/dark tone for male hair feel */}
          <path
            d="M89 38 C91 35, 95 33, 100 34 C105 35, 108 38, 109 42
               C107 39, 103 36, 98 35 C94 35, 91 36, 89 38 Z"
            fill="#3a3a3a"
          />

          {/* Wolf cut layers — textured, shorter on top */}
          <path d="M90 36 C92 34, 96 33, 100 34 C97 35, 93 35, 90 37 Z" fill="#444" />
          {/* Right side layers (away from viewer, longer) */}
          <path
            d="M109 48 C110 54, 110 60, 109 65 C108 67, 107 69, 106 70
               C107 68, 108 64, 108.5 58 C109 53, 109 50, 108.5 48 Z"
            fill="#3a3a3a"
          />
          {/* Hair texture lines */}
          <path d="M96 36 C96 42, 96 50, 96 58" fill="none" stroke="#3a3a3a" strokeWidth="0.5" />
          <path d="M100 37 C101 43, 102 51, 102 59" fill="none" stroke="#3a3a3a" strokeWidth="0.4" />

          {/* Left side — hair stops above ear, revealing face */}
          <path
            d="M87 48 C86 44, 87 40, 89 38
               C88 42, 87 46, 87 50 C87 53, 87.5 56, 88 58
               C87.5 56, 87 53, 87 50 Z"
            fill="#3a3a3a"
          />
          {/* Sideburn / short hair near left ear */}
          <path
            d="M87 54 C86.5 56, 86.5 58, 87 60 C87.5 58, 87.5 56, 87 54.5 Z"
            fill="#444"
          />

          {/* Nape wisps (wolf cut back) */}
          <path d="M92 68 C91 71, 91 73, 92 73.5 C92.5 72, 92 70, 92 69 Z" fill="#333" />
          <path d="M100 68 C101 71, 101 73, 100 73.5 C99.5 72, 100 70, 100 69 Z" fill="#333" />
          <path d="M104 66 C105 69, 106 71, 105 72 C104 71, 104 69, 103.5 67 Z" fill="#333" />

          {/* Left ear (visible since hair is short on this side) */}
          <ellipse cx="86" cy="56" rx="2" ry="3" fill="#ccc" />
          <ellipse cx="86" cy="56" rx="1.2" ry="2" fill="#c0c0c0" />
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
