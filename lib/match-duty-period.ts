import { z } from 'zod';
export const matchDutyPeriodSchema=z.object({season:z.uuid(),from:z.iso.date(),until:z.iso.date()}).refine(v=>v.until>=v.from,{message:'De einddatum moet op of na de begindatum liggen.'});
export type MatchDutyPeriodState={error?:string;counts?:{created:number;existing:number;excluded:number;unknown:number;unavailable:number}};
