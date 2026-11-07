export default function Loading() {
  return <div className="page-loading" role="status" aria-live="polite" aria-busy="true"><div className="loading-content"><div className="loading-label"><span className="loading-spinner" aria-hidden="true"/>Pagina laden…</div><div className="skeleton skeleton-heading"/>{[0,1,2,3].map(n=><div key={n} className="skeleton skeleton-row"/>)}</div></div>;
}
