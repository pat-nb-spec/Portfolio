import crypto from 'node:crypto';

function stripHtml(s=''){
  return String(s).replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
}
function decodeXml(s=''){return String(s).replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function idFor(parts){return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0,24);}
function extractTicker(text=''){
  const patterns=[/(?:ticker|symbol)\s*[:\-]\s*\$?([A-Z][A-Z0-9.\-]{0,7})\b/i,/\$([A-Z]{1,6})\b/,/\(([A-Z]{1,6})\)(?=\s|$)/];
  for(const re of patterns){const m=String(text).match(re);if(m)return m[1].toUpperCase();}
  return '';
}
function extractRating(text=''){
  const m=String(text).match(/\b(Strong Buy|Buy|Hold|Sell|Strong Sell|Rating Upgrade|Rating Downgrade|Upgrade|Downgrade)\b/i);
  return m?m[1].replace(/\b\w/g,x=>x.toUpperCase()):'';
}
function extractPriceTarget(text=''){
  const m=String(text).match(/(?:price target|\bPT\b)\s*(?:of|[:=])?\s*\$?([0-9]+(?:\.[0-9]+)?)/i);
  return m?Number(m[1]):null;
}
function classify(text=''){
  const s=String(text);
  if(/Analyst'?s Pick/i.test(s))return 'ANALYST_PICK';
  if(/Editor'?s Pick/i.test(s))return 'EDITORS_PICK';
  if(/Strong Buy/i.test(s))return 'STRONG_BUY_RESEARCH';
  if(/Upgrade|Rating Upgrade/i.test(s))return 'RATING_UPGRADE';
  if(/Downgrade|Rating Downgrade/i.test(s))return 'RATING_DOWNGRADE';
  if(/Alpha Picks?/i.test(s))return 'PUBLIC_ALPHA_PICKS_MENTION';
  return 'RESEARCH_ARTICLE';
}
function parseDateLoose(v=''){
  const d=new Date(v); return Number.isNaN(d.getTime())?new Date().toISOString():d.toISOString();
}
function scoreIdea({type,rating,title,summary}){
  let score=50; const t=`${title} ${summary}`;
  if(type==='ANALYST_PICK')score+=18;
  if(type==='EDITORS_PICK')score+=12;
  if(type==='STRONG_BUY_RESEARCH'||/Strong Buy/i.test(rating))score+=20;
  if(type==='RATING_UPGRADE')score+=12;
  if(type==='RATING_DOWNGRADE')score-=12;
  if(/price target|upside|catalyst/i.test(t))score+=6;
  if(/risk|overvalued|sell|warning/i.test(t))score-=5;
  return Math.max(0,Math.min(100,score));
}
function parseRss(xml,sourceLabel,sourceUrl){
  const blocks=[...(xml.match(/<item[\s\S]*?<\/item>/gi)||[]),...(xml.match(/<entry[\s\S]*?<\/entry>/gi)||[])]; const out=[];
  for(const block of blocks.slice(0,120)){
    const pick=(tag)=>decodeXml(((block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'))||[])[1]||'')).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    const title=pick('title'); const summary=pick('description')||pick('summary')||pick('content'); const published=pick('pubDate')||pick('published')||pick('updated');
    const href=((block.match(/<link[^>]+href=["']([^"']+)["']/i)||[])[1]||pick('link')).trim();
    if(!title)continue;
    const publisher=pick('source'); const combined=`${title} ${summary} ${publisher}`; const ticker=extractTicker(combined); const rating=extractRating(combined); const type=classify(combined); const priceTarget=extractPriceTarget(combined);
    const item={id:idFor([sourceLabel,title,href]),ticker,title,publisher:publisher||'Seeking Alpha',publishedAt:parseDateLoose(published),rating,type,priceTarget,source:sourceLabel,sourceUrl:href,summary:stripHtml(summary||title).slice(0,800),access:'PUBLIC',officialAlphaPick:false,status:ticker?'PARSED':'NEEDS_REVIEW'};
    item.ideaScore=scoreIdea({...item,title,summary:item.summary});
    out.push(item);
  }
  return out;
}
async function fetchText(url,timeoutMs=7000){
  const c=new AbortController(); const t=setTimeout(()=>c.abort(),timeoutMs);
  try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':'Mozilla/5.0 PortfolioPulseAI/2.2'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text();}finally{clearTimeout(t);}
}
function googleNewsRss(query){return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;}

export async function fetchSeekingAlphaPublicResearch(){
  const urls=[];
  const custom=(process.env.SEEKING_ALPHA_PUBLIC_FEEDS||'').split(',').map(x=>x.trim()).filter(Boolean);
  for(const u of custom.slice(0,10))urls.push({url:u,label:'Seeking Alpha Public Feed'});
  const queries=(process.env.SEEKING_ALPHA_PUBLIC_QUERIES||[
    'site:seekingalpha.com Seeking Alpha "Analyst\'s Pick"',
    'site:seekingalpha.com Seeking Alpha "Editor\'s Pick" stock',
    'site:seekingalpha.com Seeking Alpha "Strong Buy" stock',
    'site:seekingalpha.com Seeking Alpha "Rating Upgrade" stock',
    'site:seekingalpha.com Seeking Alpha "Rating Downgrade" stock',
    'site:seekingalpha.com Seeking Alpha "price target" stock'
  ].join('||')).split('||').map(x=>x.trim()).filter(Boolean);
  for(const q of queries.slice(0,8))urls.push({url:googleNewsRss(q),label:'Seeking Alpha via Google News RSS'});

  const all=[];
  for(const src of urls){
    try{const xml=await fetchText(src.url);all.push(...parseRss(xml,src.label,src.url).filter(x=>/seekingalpha\.com/i.test(x.sourceUrl)||/Seeking Alpha/i.test(`${x.title} ${x.publisher} ${x.summary} ${x.source}`)));}catch{}
  }
  const dedup=new Map();
  for(const x of all){const key=(x.sourceUrl||x.id).replace(/\?.*$/,'');const prev=dedup.get(key);if(!prev||x.ideaScore>prev.ideaScore)dedup.set(key,x);}
  return [...dedup.values()].sort((a,b)=>b.ideaScore-a.ideaScore||String(b.publishedAt).localeCompare(String(a.publishedAt))).slice(0,120);
}

export function summarizeSeekingAlphaResearch(items=[]){
  const counts={analystPick:0,editorsPick:0,strongBuy:0,upgrades:0,downgrades:0,articles:items.length};
  for(const x of items){if(x.type==='ANALYST_PICK')counts.analystPick++;if(x.type==='EDITORS_PICK')counts.editorsPick++;if(x.type==='STRONG_BUY_RESEARCH')counts.strongBuy++;if(x.type==='RATING_UPGRADE')counts.upgrades++;if(x.type==='RATING_DOWNGRADE')counts.downgrades++;}
  return counts;
}
