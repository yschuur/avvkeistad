export default function Loading() {
  return <div className="page-loading" role="status" aria-live="polite" aria-busy="true">
    <div className="loading-topline"/>
    <div className="loading-content"><div className="loading-label"><span className="loading-spinner"/>Pagina laden…</div>
      <div className="skeleton skeleton-heading"/><div className="skeleton skeleton-description"/>
      <div className="skeleton skeleton-hero"/><div className="loading-cards">{[0,1,2].map(n=><div key={n} className="skeleton skeleton-card"/>)}</div>
    </div>
  </div>;
}
