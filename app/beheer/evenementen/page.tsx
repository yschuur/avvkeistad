import ServicePage from '@/components/management/service-page';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {return <ServicePage kind="event" title="Evenementen" path="/beheer/evenementen" searchParams={searchParams}/>;}
