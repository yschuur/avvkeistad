import { adminHelp, type AdminHelpSection } from '@/lib/admin-help';

export function AdminHelp({topic}:{topic:keyof typeof adminHelp}) {
 const sections:readonly AdminHelpSection[]=adminHelp[topic];
 return <div className="admin-help">{sections.map(section=>{
  const items=section.items.map(item=><li key={item}>{item}</li>);
  return <section key={section.title}><h3>{section.title}</h3>{section.steps?<ol>{items}</ol>:<ul>{items}</ul>}</section>;
 })}</div>;
}
