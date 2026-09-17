"use client";

import "./inventory-d14.css";

type InventoryErrorProps={error:Error&{digest?:string};reset:()=>void};

export default function InventoryError({error,reset}:InventoryErrorProps){
  return <main className="inv18RouteState" data-design-state-task="D18" data-ui-state="error">
    <section className="inv18ErrorState" role="alert" aria-labelledby="inventory-error-title">
      <span className="inv18ErrorEyebrow">ENCHEV INVENTORY</span>
      <h1 id="inventory-error-title">Не успяхме да заредим инвентара</h1>
      <p>Опитай отново. Ако проблемът остане, отвори инвентара наново или се свържи с поддръжката.</p>
      {error.digest&&<small>Код за справка: {error.digest}</small>}
      <div className="inv18ErrorActions"><button type="button" onClick={reset}>Опитай отново</button><a href="/inventory">Отвори инвентара</a><a href="/support">Поддръжка</a></div>
    </section>
  </main>
}
