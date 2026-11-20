import { fromZonedTime,formatInTimeZone } from 'date-fns-tz';
export function dutyDayWindow(day:string) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('Ongeldige dag');
 const start=fromZonedTime(day+'T00:00:00','Europe/Amsterdam');
 if(!Number.isFinite(start.getTime())||formatInTimeZone(start,'Europe/Amsterdam','yyyy-MM-dd')!==day)throw new Error('Ongeldige dag');
 const next=new Date(day+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
 return {start:start.toISOString(),end:fromZonedTime(next.toISOString().slice(0,10)+'T00:00:00','Europe/Amsterdam').toISOString()};
}
