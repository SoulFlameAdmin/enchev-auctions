import "server-only";

/* This is a launch gate, not a substitute for legal review.
 * Legal identity and policy approval must be configured for the dedicated E&A operator.
 * Never infer corporate details from the trading brand.
 */
export const ENCHEV_LEGAL_VERSION="2026-11-07-v1";

function value(key:string){return (process.env[key]||"").trim();}
export function enchevLegalStatus(){
 const entityName=value("ENCHEV_LEGAL_ENTITY_NAME");
 const registrationNumber=value("ENCHEV_LEGAL_REGISTRATION_NUMBER");
 const registeredAddress=value("ENCHEV_LEGAL_REGISTERED_ADDRESS");
 const contactEmail=value("ENCHEV_LEGAL_CONTACT_EMAIL");
 const approved=process.env.ENCHEV_LEGAL_POLICIES_APPROVED==="true"
   && value("ENCHEV_LEGAL_REVIEWED_VERSION")===ENCHEV_LEGAL_VERSION
   && Boolean(entityName&&registrationNumber&&registeredAddress
       && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail));
 return {approved,entityName,registrationNumber,registeredAddress,contactEmail,
   version:ENCHEV_LEGAL_VERSION};
}
