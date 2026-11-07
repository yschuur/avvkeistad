import { timingSafeEqual } from 'node:crypto';
export function isCronAuthorized(authorization:string|null,secret=process.env.CRON_SECRET):boolean {
 if(!secret || secret.length<32 || !authorization?.startsWith('Bearer ')) return false;
 const expected=Buffer.from(secret),actual=Buffer.from(authorization.slice(7));
 return expected.length===actual.length && timingSafeEqual(expected,actual);
}
