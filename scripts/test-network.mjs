// Explicit test-process preloader. Never imported by application code.
// Redirects only the known external RSS/mail APIs to the isolated local fixture
// server so integration tests cannot read the live RSS or send actual emails.
const base=new URL(process.env.AVV_TEST_NETWORK_URL ?? '');
if(base.protocol!=='http:' || !['127.0.0.1','localhost'].includes(base.hostname)) throw new Error('A local fixture server is required.');
const actualFetch=globalThis.fetch;
globalThis.fetch=(input,options)=>{
 const url=input instanceof Request?input.url:String(input);
 if(url==='https://api.nevobo.nl/export/vereniging/CKL7S2R/programma.rss') return actualFetch(new URL('/fixture-nevobo.rss',base),options);
 if(url==='https://api.resend.com/emails') return actualFetch(new URL('/fixture-resend',base),options);
 return actualFetch(input,options);
};
