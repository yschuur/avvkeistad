import { cache } from 'react';
import { supabase } from './supabase/server';
export type FunctionDefinition={id:string;title:string;points:number};
export type FunctionCatalog={available:boolean;groups:FunctionDefinition[];error:string|null};
export const getFunctionCatalog=cache(async(seasonId:string|null):Promise<FunctionCatalog>=>{
 const db=await supabase();
 const {data,error}=await db.from('function_groups').select('id,title,points').eq('season_id',seasonId??'00000000-0000-0000-0000-000000000000').order('title');
 if(error) return {available:false,groups:[],error:['42P01','PGRST205'].includes(error.code)?'Voer migratie 009_function_groups.sql uit om functies en functiegroepen te beheren.':'Functiegroepen konden niet worden geladen. Probeer de pagina opnieuw te openen.'};
 return {available:true,groups:(data??[]) as FunctionDefinition[],error:null};
});
