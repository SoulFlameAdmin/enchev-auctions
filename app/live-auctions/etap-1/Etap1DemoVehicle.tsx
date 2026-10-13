"use client";

/** Illustrated test vehicle, deliberately not a photo or a verified real lot. */
export default function Etap1DemoVehicle({view}:{view:string}) {
  const v=view.toUpperCase();
  const wheel=(x:number,y:number,r:number)=>(
    <g key={x+"-"+y}>
      <circle cx={x} cy={y} r={r} fill="#060f0c" stroke="#1b3430" strokeWidth="5"/>
      <circle cx={x} cy={y} r={r*.68} fill="#526c63" stroke="#e6f2ee" strokeWidth="8"/>
      <circle cx={x} cy={y} r={r*.27} fill="#a6c8ba"/>
    </g>
  );
  return <svg viewBox="0 0 680 430" role="img" aria-label={v+" illustrated demo vehicle view — not a real listing photograph"}>
    <defs>
      <linearGradient id="ev9-vpaint" x1="0" y1="0" x2=".83" y2="1">
        <stop stopColor="#f6faf8"/><stop offset=".42" stopColor="#aac2b9"/><stop offset="1" stopColor="#3a6459"/>
      </linearGradient>
      <linearGradient id="ev9-vglass" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#193b36"/><stop offset=".85" stopColor="#071815"/>
      </linearGradient>
      <linearGradient id="ev9-vbg" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#174638"/><stop offset=".7" stopColor="#081b15"/><stop offset="1" stopColor="#040b09"/>
      </linearGradient>
      <linearGradient id="ev9-spotlight"><stop stopColor="#4defc0" stopOpacity=".33"/><stop offset="1" stopColor="#4defc0" stopOpacity="0"/></linearGradient>
    </defs>
    <rect width="680" height="430" fill="url(#ev9-vbg)"/>
    <ellipse cx="345" cy="196" rx="295" ry="205" fill="url(#ev9-spotlight)"/>
    <path d="M0 343 Q335 318 680 343L680 430H0Z" fill="#06110e"/>
    <path d="M0 370L680 370" stroke="#356e56" strokeOpacity=".65"/>
    <g strokeLinecap="round" strokeLinejoin="round">
      {v==="SIDE"&&<>
        <ellipse cx="347" cy="340" rx="257" ry="22" fill="#010504" opacity=".7"/>
        <path d="M82 271Q103 233 226 212L271 148Q288 128 330 130L455 134Q474 134 505 170L549 210Q604 224 612 272L607 305H91Z" fill="url(#ev9-vpaint)" stroke="#d5ebe3" strokeWidth="4"/>
        <path d="M262 207L302 152Q314 142 336 142L453 150Q462 151 472 169L500 207Z" fill="url(#ev9-vglass)" stroke="#b3d3c5" strokeWidth="4"/>
        <path d="M392 143L397 210" stroke="#c5ded3" strokeWidth="4"/>
        <path d="M114 270L168 270" stroke="#d6fff0" strokeWidth="9"/>
        <path d="M543 274L595 274" stroke="#f35349" strokeWidth="8"/>
        <path d="M179 254Q338 237 521 256" stroke="#fafffd" strokeOpacity=".7" strokeWidth="3" fill="none"/>
        {wheel(210,310,59)}{wheel(504,310,59)}
      </>}
      {v==="FRONT"&&<>
        <ellipse cx="338" cy="349" rx="228" ry="24" fill="#010504" opacity=".7"/>
        <path d="M153 258Q158 207 196 187L242 135Q254 120 308 119H377Q433 121 444 138L482 188Q517 207 523 257L521 319H150Z" fill="url(#ev9-vpaint)" stroke="#d5eae3" strokeWidth="4"/>
        <path d="M242 190L264 142Q270 133 316 132H376Q421 132 426 146L449 191Z" fill="url(#ev9-vglass)" stroke="#b8d4c9" strokeWidth="4"/>
        <path d="M153 262Q340 251 523 262L515 321H155Z" fill="#d8e6df" stroke="#b9d4ca" strokeWidth="2"/>
        <path d="M199 261L269 265Q274 267 265 287L195 291Z" fill="#081712" stroke="#64ffd1" strokeWidth="3"/>
        <path d="M410 265L479 261L484 291L415 287Z" fill="#081712" stroke="#64ffd1" strokeWidth="3"/>
        <rect x="270" y="273" width="139" height="37" rx="10" fill="#102621" stroke="#7ebba6" strokeWidth="3"/>
        <path d="M270 292H409" stroke="#f54842" strokeWidth="3"/>
        <rect x="302" y="315" width="77" height="22" rx="5" fill="#0c251b"/><text x="340" y="331" fontSize="11" fontWeight="900" textAnchor="middle" fill="#84f7d3">GTI · DEMO</text>
        <path d="M160 322L220 337M516 322L460 337" stroke="#233a31" strokeWidth="10"/>
      </>}
      {v==="REAR"&&<>
        <ellipse cx="339" cy="348" rx="232" ry="22" fill="#010504" opacity=".75"/>
        <path d="M151 247Q166 189 214 177L245 133Q265 119 327 119H390Q429 120 451 143L482 183Q513 208 524 253L511 322H158Z" fill="url(#ev9-vpaint)" stroke="#d5eae3" strokeWidth="4"/>
        <path d="M229 202L260 148Q275 137 313 137H395Q415 138 433 162L459 202Z" fill="url(#ev9-vglass)" stroke="#b8d4c9" strokeWidth="4"/>
        <path d="M181 253L257 265L245 284L175 277Z" fill="#d82c2e" stroke="#ff9380" strokeWidth="3"/>
        <path d="M499 253L425 265L439 284L505 277Z" fill="#d82c2e" stroke="#ff9380" strokeWidth="3"/>
        <path d="M268 282Q341 288 412 282" stroke="#adcec2" strokeWidth="4" fill="none"/>
        <rect x="288" y="287" width="101" height="26" rx="5" fill="#0b261e" stroke="#6de6b9" strokeWidth="2"/>
        <text x="339" y="305" fontSize="11" fontWeight="900" textAnchor="middle" fill="#8dffd7">ENCHEV</text>
        <path d="M185 330H492" stroke="#243b34" strokeWidth="11"/>
      </>}
      {v==="INTERIOR"&&<>
        <path d="M113 305Q125 185 193 155Q332 118 484 155Q560 180 565 303L565 347H112Z" fill="#102c26" stroke="#739785" strokeWidth="7"/>
        <path d="M153 202Q343 130 524 204L525 253Q356 228 154 255Z" fill="url(#ev9-vglass)" stroke="#597a6f" strokeWidth="3"/>
        <rect x="258" y="256" width="188" height="72" rx="14" fill="#080e0c" stroke="#406758" strokeWidth="4"/>
        <rect x="310" y="263" width="101" height="47" rx="7" fill="#144c3a" stroke="#00deb1" strokeWidth="2"/>
        <path d="M323 282H391M343 293H381" stroke="#00deb1" strokeWidth="4"/>
        <circle cx="205" cy="273" r="77" fill="#060d0b" stroke="#354d45" strokeWidth="17"/>
        <circle cx="205" cy="273" r="49" fill="none" stroke="#7ca99c" strokeWidth="9"/>
        <circle cx="205" cy="273" r="19" fill="#162e25" stroke="#00deb1" strokeWidth="2"/>
        <path d="M205 258V228M191 282L169 304M220 282L244 304" stroke="#87bba7" strokeWidth="8"/>
        <rect x="456" y="289" width="66" height="40" rx="7" fill="#13271f" stroke="#4f7362" strokeWidth="3"/>
      </>}
      {v==="DETAIL"&&<>
        <ellipse cx="339" cy="347" rx="200" ry="15" fill="#010504" opacity=".75"/>
        <circle cx="338" cy="236" r="145" fill="#050b09" stroke="#2e5a49" strokeWidth="16"/>
        <circle cx="338" cy="236" r="117" fill="#273e35" stroke="#bdcfc6" strokeWidth="11"/>
        {Array.from({length:8},(_,i)=>(
          <g key={i} transform={`rotate(${i*45} 338 236)`}>
            <path d="M338 138L350 190L338 209L326 190Z" fill="#dfeae5" stroke="#5c8a76" strokeWidth="3"/>
          </g>
        ))}
        <circle cx="338" cy="236" r="51" fill="#0c2b21" stroke="#8dd7b7" strokeWidth="9"/>
        <circle cx="338" cy="236" r="26" fill="#0c3b2b"/><text x="338" y="242" fill="#00deb1" fontSize="13" fontWeight="900" textAnchor="middle">GTI</text>
        <path d="M164 111L245 80M500 112L430 82" stroke="#00deb1" strokeOpacity=".45" strokeWidth="4"/>
      </>}
    </g>
    <text x="26" y="45" fill="#b4f9e1" fontSize="16" fontWeight="900">ENCHEV AUCTIONS</text>
    <text x="26" y="70" fill="#8fc7b4" fontSize="12">{v} · CONCEPT ILLUSTRATION</text>
    <text x="26" y="398" fill="#5f8e7b" fontSize="12">TEST VEHICLE · NOT A REAL LISTING</text>
  </svg>;
}
