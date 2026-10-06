// 使い方説明用の画面例・印刷例を docs/examples/ に作る（node tools/make_examples.js）
const { chromium } = require((()=>{try{return require.resolve('playwright')}catch{return require('child_process').execSync('npm root -g').toString().trim()+'/playwright'}})());
const fs=require('fs'), OUT=require('path').resolve(__dirname,'..','docs','examples')+'/';
const DATE='2026-09-30';
const members=[
  {id:'all',name:'全体',color:'#475569',order:0},
  {id:'m1',name:'潤',color:'#2563eb',order:1},
  {id:'m2',name:'健太',color:'#16a34a',order:2},
  {id:'m3',name:'美咲',color:'#db2777',order:3},
  {id:'m4',name:'翔',color:'#ea580c',order:4},
];
const t=(h,m)=>h*6+m/10; let n=0;
const ev=(memberId,sh,sm,eh,em,title,remind=10,place='',person='',color='')=>({id:'e'+(n++),date:DATE,memberId,start:t(sh,sm),end:t(eh,em),title,place,person,color,remind,updatedAt:1});
const events=[
  ev('all',9,0,9,30,'朝ミーティング',10,'集会室','潤、健太、美咲、翔'), ev('all',12,0,13,0,'昼休み',0), ev('all',17,30,18,0,'片付け・振り返り'),
  ev('m1',6,30,6,40,'起床',0), ev('m1',8,0,8,50,'移動',0), ev('m1',9,30,11,0,'資料作成',0), ev('m1',13,0,13,20,'電話',5,'','','#dc2626'), ev('m1',14,0,15,30,'打ち合わせ',10,'第1会議室','美咲','#7c3aed'), ev('m1',16,0,16,40,'メール返信',0),
  ev('m2',8,30,9,0,'準備',0), ev('m2',9,30,10,10,'買い出し',15), ev('m2',10,30,12,0,'作業A',0,'倉庫',''), ev('m2',13,0,14,30,'外回り',30,'駅前エリア','健太'), ev('m2',15,0,15,10,'連絡',5), ev('m2',15,30,17,0,'作業B',0),
  ev('m3',9,30,10,0,'受付',0), ev('m3',10,0,11,40,'接客',0), ev('m3',13,0,13,50,'会議準備'), ev('m3',14,0,15,30,'打ち合わせ'), ev('m3',16,0,17,20,'発送作業',0),
  ev('m4',10,0,10,30,'出発',10), ev('m4',11,0,12,0,'現場確認',0,'A棟','翔'), ev('m4',13,0,14,0,'作業',0), ev('m4',14,10,14,20,'休憩',0), ev('m4',15,0,16,30,'報告書',0),
];
(async()=>{
  const b=await chromium.launch();
  const mk=async(opts)=>{const c=await b.newContext(opts); await c.addInitScript(({s})=>{Object.defineProperty(window,'FIREBASE_CONFIG',{get:()=>null,set(){}}); localStorage.setItem('tenmin-schedule-v1',s); localStorage.setItem('tenmin-zoom','1');},{s:JSON.stringify({members,events})}); const p=await c.newPage(); await p.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await p.waitForSelector('.col');
    await p.evaluate((d)=>{const i=document.querySelector('#date'); i.value=d; i.dispatchEvent(new Event('change'));},DATE);
    await p.evaluate(()=>{document.querySelector('#status').textContent='共有中'; document.querySelector('#status').className='status shared'; document.querySelector('#invite').hidden=false; document.querySelector('#export').hidden=document.querySelector('#import').hidden=true; document.querySelector('#notif').textContent='🔔 通知ON'; document.querySelectorAll('.nowline').forEach(n=>n.remove());});
    return p;};
  // スマホ画面
  let p=await mk({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});
  await p.evaluate(()=>document.querySelector('#scroller').scrollTop=7.9*6*20);
  await p.screenshot({path:OUT+'1-phone.png'});
  // 入力画面
  await p.click('.ev >> text=打ち合わせ'); await p.waitForTimeout(200);
  await p.screenshot({path:OUT+'2-phone-edit.png'});
  // PC画面
  p=await mk({viewport:{width:1280,height:800},deviceScaleFactor:2});
  await p.evaluate(()=>document.querySelector('#scroller').scrollTop=7.9*6*20);
  await p.screenshot({path:OUT+'3-pc.png'});
  // 印刷
  await p.click('#print'); await p.selectOption('#pFrom','6'); await p.selectOption('#pTo','19'); await p.selectOption('#pOrient','portrait');
  const url=await p.$eval('#pImgs img',i=>i.src); fs.writeFileSync(OUT+'4-print-a4.png',Buffer.from(url.split(',')[1],'base64'));
  await b.close();
})();
