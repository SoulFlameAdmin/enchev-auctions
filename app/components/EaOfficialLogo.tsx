export default function EaOfficialLogo({className="",alt="E&A East and West Auctioneers Group"}:{className?:string;alt?:string}) {
  return <span className={`eaOfficialLogo ${className}`} role="img" aria-label={alt}>
    <img className="eaOfficialLogoOnDark" src="/brand/ea-official-dark.svg" alt="" aria-hidden="true" />
    <img className="eaOfficialLogoOnLight" src="/brand/ea-official-light.svg" alt="" aria-hidden="true" />
  </span>;
}
