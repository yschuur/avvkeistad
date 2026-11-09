import MatchesPage from '@/components/matches-page';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {return <MatchesPage searchParams={searchParams} management/>;}
