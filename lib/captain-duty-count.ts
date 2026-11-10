import { cache } from 'react';
import { supabase } from './supabase/server';
export const getCaptainDutyCount=cache(async():Promise<number|null>=>{
 const db=await supabase(),{data,error}=await db.rpc('captain_team_duty_count');
 return !error&&Number.isSafeInteger(data)&&data>=0?data:null;
});
