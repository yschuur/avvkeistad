import Link from 'next/link';
import { pageNumbers } from '@/lib/planning';
export function PageNavigation({current,pages,label='Pagina',name}:{current:number;pages:{label:string;href:string}[];label?:string;name:string}) {
 if(pages.length<2)return null;
 const target=new URL(pages[current-1].href,'https://local.invalid'),query=[...target.searchParams],key=target.pathname==='/beheer/planning'?'month':'page';
 const numbers=pageNumbers(current,pages.length);
 return <nav className="pagination" aria-label={name}>
 {current>1&&<Link prefetch={false} className="button secondary" href={pages[current-2].href}>Vorige</Link>}
 <div className="pagination-numbers">{numbers.map((p,i)=><span key={p}>{i>0&&p>numbers[i-1]+1&&<span className="pagination-gap" aria-hidden="true">…</span>}<Link prefetch={false} className={`button secondary ${p===current?'selected':''}`} href={pages[p-1].href} aria-current={p===current?'page':undefined} title={pages[p-1].label} aria-label={`${label} ${p}: ${pages[p-1].label}`}>{p}</Link></span>)}</div>
 <span>{label} {current} van {pages.length}</span>
 {current<pages.length&&<Link prefetch={false} className="button secondary" href={pages[current].href}>Volgende</Link>}
 <form key={pages[current-1].href} method="get" action={target.pathname} className="pagination-jump">{query.filter(([k])=>k!==key&&(key!=='month'||(k!=='duty'&&k!=='day'))).map(([k,v])=><input type="hidden" name={k} value={v} key={k}/>)}<div className="pagination-choice"><label htmlFor={`pagination-${key}`}>Kies {label.toLowerCase()}</label><select id={`pagination-${key}`} name={key} defaultValue={target.searchParams.get(key)??String(current)}>{pages.map((p,i)=><option key={p.href} value={new URL(p.href,'https://local.invalid').searchParams.get(key)??String(i+1)}>{p.label}</option>)}</select></div><button className="button secondary" type="submit">Ga</button></form>
 </nav>;
}
