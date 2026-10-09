const {chromium}=require('playwright');
const path=require('path');
const url='file:///'+path.resolve(__dirname,'index.html').replace(/\\/g,'/');
async function main(){
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:400,height:850},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(url);console.log('title',await page.title(),'questions',await page.evaluate(()=>Object.values(window.__game.questions).map(x=>x.length)));
 const width=await page.evaluate(()=>({body:document.body.scrollWidth,viewport:innerWidth}));
 if(width.body>width.viewport)throw Error(`Horizontal overflow: ${width.body} > ${width.viewport}`);
 const report={};
 for(const rate of [1,.75,.5]){
  const runs=[];
  for(let i=0;i<20;i++){
   const outcome=await page.evaluate(({rate,i})=>{
    const g=window.__game;g.chooseTalent(i%4);let steps=0;
    while(steps++<15000){const s=g.state(),p=s.phase;
      if(p==='win'||p==='dead')return{result:p,act:s.act,floor:s.floor,turns:steps,hp:s.hp,asked:s.asked,correct:s.correct,damage:s.totalDamage};
      if(p==='map'){let opts=s.route[s.floor];g.chooseNode(opts.includes('chest')?'chest':opts.includes('station')?'station':opts.includes('battle')?'battle':opts[0]);continue}
      if(p==='chest'){g.advance();continue}
      if(p==='rest'){g.rest('heal');continue}
      if(p==='station'){let q=s.question,answer=Math.random()<rate?0:1;g.stationAnswer(q.order.indexOf(answer));continue}
      if(p==='station-result'){let q=s.question;if(q.order[q.chosen]===0)g.stationReward('atk');else g.advance();continue}
      if(p==='reward'){let ranked=[...s.reward].sort((a,b)=>{let x=g.cards[a],y=g.cards[b];return (y.type==='attack'?2:0)+(y.rarity==='legendary'?3:y.rarity==='epic'?2:y.rarity==='rare'?1:0)-((x.type==='attack'?2:0)+(x.rarity==='legendary'?3:x.rarity==='epic'?2:x.rarity==='rare'?1:0))});g.takeReward(ranked[0]);continue}
      if(p==='battle'){let b=s.battle;if(!b.answered){let answer=Math.random()<rate?0:1;g.battleAnswer(b.question.order.indexOf(answer));continue}let best=-1,cost=-1;for(let j=0;j<b.hand.length;j++){let c=g.cards[b.hand[j].id];if(c.cost<=b.energy&&c.cost>cost){best=j;cost=c.cost}}if(best>=0){g.playCard(best);continue}g.endTurn();continue}
      throw Error('Unknown phase '+p);
    }
    return{result:'timeout',act:g.state().act,floor:g.state().floor,turns:steps};
   },{rate,i});runs.push(outcome);
  }
  report[rate]={wins:runs.filter(x=>x.result==='win').length,deaths:runs.filter(x=>x.result==='dead').length,timeouts:runs.filter(x=>x.result==='timeout').length,meanAsked:Math.round(runs.reduce((n,x)=>n+(x.asked||0),0)/20),meanDamage:Math.round(runs.reduce((n,x)=>n+(x.damage||0),0)/20),deathsByAct:runs.filter(x=>x.result==='dead').reduce((a,x)=>(a[x.act]=(a[x.act]||0)+1,a),{})};
  console.log(rate,JSON.stringify(report[rate]));
 }
 console.log('console errors',errors.length,errors.slice(0,10));
 if(process.env.SCREENSHOT)await page.screenshot({path:path.resolve(process.env.SCREENSHOT),fullPage:true});
 await browser.close();if(errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
