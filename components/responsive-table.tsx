import type { TdHTMLAttributes } from 'react';
export function TableCell({label,children,...props}:TdHTMLAttributes<HTMLTableCellElement>&{label:string}) {
 return <td role="cell" {...props}><span className="mobile-cell-label" aria-hidden="true">{label==='Scheidsrechtersniveau'?'Fluitniveau':label}</span>{children}</td>;
}
