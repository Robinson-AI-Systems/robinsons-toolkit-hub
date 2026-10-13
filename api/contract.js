// RTC 1 not yet claimed; owner consent and tool doors still incomplete.
export default function handler(req,res) { if(req.method!=='GET') return res.status(405).json({error:'method_not_allowed'}); return res.status(200).json({rtc:0,server:'robinsons-toolkit-hub',prefix:'hub',status:'foundation_only'}); }
