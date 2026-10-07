"use client";

import "./inventory-d14.css";

type InventoryErrorProps={error:Error&{digest?:string};reset:()=>void};

export default function InventoryError({error,reset}:InventoryErrorProps){
  return <main className="inv18RouteState" data-design-state-task="D18" data-ui-state="error">
    <section className="inv18ErrorState" role="alert" aria-labelledby="inventory-error-title">
      <span className="inv18ErrorEyebrow">ENCHEV INVENTORY</span>
      <h1 id="inventory-error-title">We couldn't load the inventory</h1>
      <p>Try again. If the problem persists, reopen the inventory or contact support.</p>
      {error.digest&&<small>Reference code: {error.digest}</small>}
      <div className="inv18ErrorActions"><button type="button" onClick={reset}>Try again</button><a href="/inventory">Open inventory</a><a href="/support">Support</a></div>
    </section>
  </main>
}
