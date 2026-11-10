import ServicePage from '@/components/management/service-page';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {return <ServicePage kind="other" title="Overige diensten" path="/beheer/overige-diensten" searchParams={searchParams}/>;}
