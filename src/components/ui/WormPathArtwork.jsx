import React from 'react';

/** Solid illustrations for the two WORM entry choices. */
export default function WormPathArtwork({ levels = false }) {
  return <svg className="worm-path-illustration" viewBox="0 0 160 150" aria-hidden="true" focusable="false">
    {levels ? <>
      <path d="M12 134V96H55V60H98V24H145V134Z" fill="currentColor" />
      <path d="M12 96H55V106H12ZM55 60H98V70H55ZM98 24H145V34H98Z" fill="#fff" opacity=".45" />
      <path d="M47 106H55V134H47ZM90 70H98V134H90ZM137 34H145V134H137Z" fill="#245634" opacity=".28" />
      <circle cx="33" cy="115" r="11" fill="#245634" />
      <path d="m28 115 4 4 7-8" fill="none" stroke="#fff5cf" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="76" cy="83" r="11" fill="#245634" />
      <path d="m71 83 4 4 7-8" fill="none" stroke="#fff5cf" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m122 3 6 12 14 2-10 10 2 14-12-7-13 7 3-14-10-10 14-2Z" fill="#f4d35e" stroke="#705920" strokeWidth="2.5" strokeLinejoin="round" />
    </> : <>
      <rect x="9" y="17" width="142" height="119" rx="18" fill="currentColor" opacity=".15" />
      <path d="M17 118C59 139 24 66 68 78S97 122 120 92C144 60 91 42 123 30" fill="none" stroke="#245634" strokeWidth="30" strokeLinecap="round" />
      <path d="M17 114C59 135 24 62 68 74S97 118 120 88C144 56 91 38 123 26" fill="none" stroke="currentColor" strokeWidth="25" strokeLinecap="round" />
      <path d="M24 111C43 108 36 74 53 72M77 79C91 85 95 102 107 99" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="127" cy="28" rx="22" ry="20" fill="currentColor" />
      <ellipse cx="128" cy="22" rx="6" ry="8" fill="#fffdf2" /><ellipse cx="141" cy="25" rx="5" ry="7" fill="#fffdf2" />
      <circle cx="130" cy="23" r="3" fill="#1c3123" /><circle cx="143" cy="26" r="2.5" fill="#1c3123" />
      <path d="M129 37q6 5 12-1" fill="none" stroke="#245634" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="29" cy="35" r="10" fill="#f4d35e" /><circle cx="61" cy="27" r="6" fill="#f4d35e" />
      <path d="M27 29h4v12h-4Z" fill="#fff8d1" />
    </>}
  </svg>;
}
