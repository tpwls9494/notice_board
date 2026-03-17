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

        {/* === Person (back/side view — seeing mostly the back of head) === */}

        {/* Torso (slimmer) */}
        <path
          d="M90 72 C87 76, 85 84, 86 94 L87 120 L107 120 L108 94 C108 82, 106 72, 100 70 Z"
          fill="#1a1a1a"
        />
        {/* Collar/neckline hint */}
        <path d="M92 72 C94 73, 97 73, 99 72" fill="none" stroke="#333" strokeWidth="0.8" />

        {/* Neck (slim) */}
        <path d="M94 64 L98 64 L99 72 L93 72 Z" fill="#ddd" />

        {/* Head — back of head view, almost entirely hair */}
        <g className="person-head">
          {/* Base head shape (barely visible under hair) */}
          <ellipse cx="96" cy="54" rx="13" ry="14" fill="#ddd" />

          {/* Hair — full back-of-head coverage */}
          {/* Main hair mass covering the whole back of head */}
          <path
            d="M83 50 C82 42, 86 36, 96 34 C106 36, 110 42, 109 50
               C109 56, 108 62, 106 66 C104 68, 100 70, 96 70
               C92 70, 88 68, 86 66 C84 62, 83 56, 83 50 Z"
            fill="#1a1a1a"
          />
          {/* Wolf cut top layers — choppy texture on crown */}
          <path
            d="M88 38 C90 35, 94 33, 98 34 C96 36, 92 37, 89 39 Z"
            fill="#222"
          />
          <path
            d="M100 34 C103 35, 106 38, 107 42 C105 40, 102 37, 100 35 Z"
            fill="#222"
          />
          {/* Wolf cut — left side layers (viewer's right, longer pieces) */}
          <path
            d="M83 48 C82 54, 82 60, 83 66 C84 68, 85 70, 86 71
               C85 69, 84 64, 83.5 58 C83 54, 83 50, 83.5 48 Z"
            fill="#222"
          />
          {/* Wolf cut — right side layers (viewer's left, tapered) */}
          <path
            d="M109 48 C110 54, 110 60, 109 66 C108 68, 107 70, 106 71
               C107 69, 108 64, 108.5 58 C109 54, 109 50, 108.5 48 Z"
            fill="#222"
          />
          {/* Hair parting/texture lines on back of head */}
          <path d="M96 36 C96 42, 96 50, 96 58" fill="none" stroke="#222" strokeWidth="0.6" />
          <path d="M92 38 C91 44, 90 52, 90 60" fill="none" stroke="#222" strokeWidth="0.4" />
          <path d="M100 38 C101 44, 102 52, 102 60" fill="none" stroke="#222" strokeWidth="0.4" />

          {/* Wispy ends at nape — wolf cut signature */}
          <path
            d="M88 66 C87 69, 86 72, 87 73 C88 72, 88 70, 88.5 67 Z"
            fill="#1a1a1a"
          />
          <path
            d="M104 66 C105 69, 106 72, 105 73 C104 72, 104 70, 103.5 67 Z"
            fill="#1a1a1a"
          />
          <path
            d="M92 68 C91 71, 91 73, 92 74 C92.5 73, 92 71, 92 69 Z"
            fill="#1a1a1a"
          />
          <path
            d="M100 68 C101 71, 101 73, 100 74 C99.5 73, 100 71, 100 69 Z"
            fill="#1a1a1a"
          />

          {/* Tiny ear peek on right side (just barely visible) */}
          <ellipse cx="109" cy="54" rx="1.5" ry="2.5" fill="#ccc" />
        </g>

        {/* === Arms & Hands (typing) === */}
        {/* Far arm */}
        <path d="M90 78 C87 82, 84 88, 82 92" fill="none" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
        <path d="M82 92 C78 94, 74 95, 70 95" fill="none" stroke="#222" strokeWidth="4.5" strokeLinecap="round" />

        {/* Far hand + fingers */}
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

        {/* Near hand + fingers */}
        <g className="hand-near">
          <ellipse cx="76.5" cy="94.5" rx="4" ry="2.5" fill="#ddd" />
          <g className="fingers-near">
            <line x1="74" y1="93" x2="72.5" y2="91" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="75.5" y1="92.5" x2="74.5" y2="90.5" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </g>

        {/* === Legs (crossed, side view) === */}
        {/* Back leg */}
        <path
          d="M90 118 C84 120, 76 122, 72 124 C70 126, 70 130, 74 134 L80 148"
          fill="none"
          stroke="#333"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        <path d="M76 146 L84 146 L84 150 L74 150 Z" fill="#2a2a2a" />

        {/* Front leg (crossed on top) */}
        <path
          d="M94 118 C88 120, 80 121, 74 120 C70 119, 66 120, 64 124 L60 138"
          fill="none"
          stroke="#2a2a2a"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path d="M56 136 L64 136 L64 140 L54 140 Z" fill="#1a1a1a" />
        <path d="M54 140 L64 140 L64 141.5 L53 141.5 Z" fill="#333" />
      </svg>
    </div>
  )
}
