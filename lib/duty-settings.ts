import { cache } from 'react';
import { supabase } from './supabase/server';
export const getDutySettings=cache(async()=>{
 const db=await supabase();
 const {data,error}=await db.from('duty_settings').select('referee_points').eq('id',true).maybeSingle();
 const points=Number(data?.referee_points);
 return {available:!error&&Boolean(data)&&Number.isFinite(points)&&points>0,refereePoints:!error&&data&&Number.isFinite(points)&&points>0?points:null};
});
