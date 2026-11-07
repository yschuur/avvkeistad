import { z } from 'zod';

export const NEVOBO_PROGRAM_URL = 'https://api.nevobo.nl/export/vereniging/CKL7S2R/programma.rss';
export const matchStatus = z.enum(['scheduled','played','cancelled','postponed','missing']);
export const importedMatch = z.object({
  external_id:z.string().min(1).max(500),
  home_team:z.string().min(1).max(200),away_team:z.string().min(1).max(200),
  starts_at:z.iso.datetime({offset:true}).nullable(),
  location:z.string().max(500),level:z.string().max(200),
  address:z.string().max(500).nullable(),city:z.string().max(200).nullable(),court:z.string().max(100).nullable(),
  match_code:z.string().max(200).nullable(),source_url:z.url().nullable(),
  source_description:z.string().max(20000),source_details:z.record(z.string(),z.unknown()),
  status:matchStatus,is_home:z.boolean().nullable(),
});
export type ImportedMatch=z.infer<typeof importedMatch>;
export type MatchStatus=z.infer<typeof matchStatus>;
export type FeedSnapshot={matches:ImportedMatch[];publishedAt:string|null;complete:boolean};
export type Notification={id:string;title:string;body:string;created_at:string;read_at:string|null;match_id:string|null};
export const statusLabels:Record<MatchStatus,string>={scheduled:'Gepland',played:'Gespeeld',cancelled:'Afgelast',postponed:'Uitgesteld',missing:'Status niet bevestigd'};
export function canRegisterForMatch(match:{status?:string;cancelled?:boolean;starts_at:string|null},now=new Date()) {
  return !match.cancelled && (match.status ?? 'scheduled')==='scheduled' && Boolean(match.starts_at && new Date(match.starts_at)>now);
}
