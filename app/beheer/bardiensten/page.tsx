import ServicePage from '@/components/management/service-page';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {return <ServicePage kind="bar" title="Bardiensten" path="/beheer/bardiensten" searchParams={searchParams}/>;}
