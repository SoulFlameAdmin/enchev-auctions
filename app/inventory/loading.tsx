import "./inventory-d14.css";

const skeletons=Array.from({length:4},(_,index)=>index);

export default function InventoryLoading(){
  return <main className="inv18RouteState" data-design-state-task="D18" data-ui-state="loading">
    <section className="inv18StatePanel" aria-busy="true" aria-live="polite" aria-label="Зареждане на инвентара">
      <div className="inv18StateIntro"><span>ENCHEV MARKETPLACE</span><h1>Зареждаме автомобилите</h1><p>Подготвяме актуалните лотове и състояния на търга.</p></div>
      <div className="inv18SkeletonGrid" aria-hidden="true">{skeletons.map(index=><article className="inv18SkeletonCard" key={index}><div className="inv18SkeletonMedia"/><div className="inv18SkeletonBody"><i/><b/><span/><span/><em/></div></article>)}</div>
    </section>
  </main>
}
