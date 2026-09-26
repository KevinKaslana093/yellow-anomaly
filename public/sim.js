/* Deterministic 60 Hz combat. Rendering and audio consume events only. */
(() => {
const HEROES=[{name:'奶蛙',skill:'音波震荡',color:'#a9f3b8',speed:218,rate:.54,damage:17,cooldown:7},{name:'袋鼠',skill:'极地冲刺',color:'#eaf34d',speed:255,rate:.34,damage:11,cooldown:5},{name:'牛来',skill:'牛来重砸',color:'#ffa16b',speed:198,rate:.8,damage:30,cooldown:8}];
const UPGRADES=[
 {id:'multi',name:'不止一发',icon:'⋔',desc:'每次攻击增加一枚散射弹，火力覆盖更广。',cap:3},
 {id:'orbit',name:'生人勿近',icon:'◎',desc:'获得一颗环绕能量球，持续伤害靠近的敌人。',cap:3},
 {id:'pierce',name:'打穿这条街',icon:'↗',desc:'子弹额外穿透一个敌人，伤害提高 10%。',cap:3},
 {id:'haste',name:'手速失控',icon:'ϟ',desc:'攻击频率提高 20%，技能冷却缩短 12%。',cap:4},
 {id:'magnet',name:'全都拿来',icon:'⊕',desc:'拾取范围扩大 65%，经验获取提高 15%。',cap:3},
 {id:'health',name:'胆子肥嘟嘟',icon:'✚',desc:'生命上限增加 30，立即恢复 45 点生命。',cap:4},
 {id:'power',name:'黄色暴力',icon:'✹',desc:'所有伤害提高 25%，合击充能加快 15%。',cap:4},
 {id:'speed',name:'溜得飞快',icon:'»',desc:'移动速度提高 15%，立即获得 3 秒无敌。',cap:3}
];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
class Sim{
 constructor(seed=Date.now(),hero=0){this.seed=seed>>>0;this.hero=hero;this.p={x:0,y:0,hp:100,maxHp:100,r:19,inv:2,dx:0,dy:1};this.time=0;this.kills=0;this.score=0;this.xp=0;this.level=1;this.need=12;this.charge=0;this.cds=[0,0,0];this.attack=.2;this.spawn=.5;this.enemies=[];this.bullets=[];this.drops=[];this.events=[];this.hazards=[];this.fx=[];this.up={};this.state='playing';this.bossSpawned=false;this.boss=null;this.nextId=1;this.dash=0;this.dashDir={x:0,y:1};this.orbitTick=0;this.choices=[];this.combo=0;this.comboTime=0;this.nextHeal=32;}
 rand(){let t=this.seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
 emit(type,data={}){this.events.push({type,...data});if(this.events.length>350)this.events.shift();}
 get damage(){return (1+.25*(this.up.power||0))*(1+.1*(this.up.pierce||0));}
 get speed(){return HEROES[this.hero].speed*(1+.15*(this.up.speed||0));}
 switchHero(i){if(this.state!=='playing'||i===this.hero||i<0||i>2)return;this.hero=i;this.attack=Math.min(this.attack,.12);this.emit('switch',{hero:i});}
 skill(){if(this.state!=='playing'||this.cds[this.hero]>0)return false;const p=this.p,h=this.hero;this.cds[h]=HEROES[h].cooldown*Math.pow(.88,this.up.haste||0);p.inv=Math.max(p.inv,.7);if(h===1){this.dash=.36;this.dashDir={x:p.dx,y:p.dy};p.inv=.8;this.emit('dash',{x:p.x,y:p.y});}else{const r=h===0?255:192;this.area(p.x,p.y,r,(h===0?60:125)*this.damage,h===0?140:50);this.emit('nova',{x:p.x,y:p.y,r,color:HEROES[h].color,hero:h});}return true;}
 ultimate(){if(this.state!=='playing'||this.charge<100)return false;this.charge=0;this.p.inv=3;this.area(this.p.x,this.p.y,650,210*this.damage,190);this.bullets=this.bullets.filter(b=>!b.hostile);this.emit('ultimate',{x:this.p.x,y:this.p.y,r:650});return true;}
 area(x,y,r,damage,push=0){for(const e of this.enemies){const dx=e.x-x,dy=e.y-y,d=Math.hypot(dx,dy);if(d<r+e.r&&e.hp>0){this.hit(e,damage);if(e.type!=='boss'&&d>0){e.x+=dx/d*push;e.y+=dy/d*push;e.stun=.35;}}}}
 hit(e,dmg){if(e.hp<=0)return;e.hp-=dmg;e.flash=.12;this.emit('hit',{x:e.x,y:e.y,damage:Math.round(dmg),big:dmg>45});if(e.hp<=0){this.kills++;this.combo++;this.comboTime=2;this.score+=e.type==='boss'?5000:(e.type==='charger'?45:20);this.charge=clamp(this.charge+(e.type==='boss'?0:2.8)*(1+.15*(this.up.power||0)),0,100);this.emit('kill',{x:e.x,y:e.y,type:e.type});if(e.type==='boss'){this.state='victory';this.emit('end',{win:true});}else{if(this.drops.length<180)this.drops.push({x:e.x,y:e.y,v:e.type==='shooter'?3:2,type:'xp'});else this.xp+=2;if(this.kills%24===0)this.drops.push({x:e.x,y:e.y,v:16,type:'heal'});}}}
 hurt(dmg){if(this.p.inv>0||this.state!=='playing')return;this.p.hp=Math.max(0,this.p.hp-dmg);this.p.inv=.85;this.combo=0;this.emit('hurt',{x:this.p.x,y:this.p.y});if(this.p.hp<=0){this.state='defeat';this.emit('end',{win:false});}}
 spawnEnemy(type,angle){const a=angle===undefined?this.rand()*Math.PI*2:angle;const r=(this.time<30?330:490)+this.rand()*70;const p=this.p;let e={id:this.nextId++,type,x:clamp(p.x+Math.cos(a)*r,-930,930),y:clamp(p.y+Math.sin(a)*r,-730,730),hp:27+this.time*.12,r:17,speed:55+this.time*.22,flash:0,stun:0,timer:1.5+this.rand(),phase:0};if(Math.hypot(e.x-p.x,e.y-p.y)<250){e.x=clamp(p.x-Math.cos(a)*r,-930,930);e.y=clamp(p.y-Math.sin(a)*r,-730,730);}if(type==='charger'){e.hp*=1.6;e.r=22;e.speed=48;}if(type==='shooter'){e.hp*=1.25;e.r=19;e.speed=45;}if(type==='boss'){e.hp=2400;e.maxHp=2400;e.r=65;e.speed=52;e.timer=2.2;this.boss=e;}this.enemies.push(e);return e;}
 shot(angle,damage,extra={}){if(this.bullets.length>=280)return;this.bullets.push({x:this.p.x,y:this.p.y-8,vx:Math.cos(angle)*580,vy:Math.sin(angle)*580,r:this.hero===2?8:5,life:1.2,dmg:damage,pierce:this.up.pierce||0,color:HEROES[this.hero].color,hit:[],hostile:false,...extra});}
 choose(id){if(this.state!=='upgrade'||!this.choices.some(c=>c.id===id))return false;this.up[id]=(this.up[id]||0)+1;if(id==='health'){this.p.maxHp+=30;this.p.hp=Math.min(this.p.maxHp,this.p.hp+45);}if(id==='speed')this.p.inv=3;this.state='playing';this.choices=[];this.emit('upgraded',{id});return true;}
 step(dt,input={x:0,y:0}){if(this.state!=='playing')return;this.time+=dt;const p=this.p;const hero=HEROES[this.hero];p.inv=Math.max(0,p.inv-dt);this.cds=this.cds.map(c=>Math.max(0,c-dt));this.comboTime-=dt;if(this.comboTime<0)this.combo=0;
 let mx=input.x||0,my=input.y||0,len=Math.hypot(mx,my);if(len>1){mx/=len;my/=len;}if(len>.1){p.dx=mx/Math.hypot(mx,my);p.dy=my/Math.hypot(mx,my);}this.dash=Math.max(0,this.dash-dt);if(this.dash>0){p.x+=this.dashDir.x*880*dt;p.y+=this.dashDir.y*880*dt;this.area(p.x,p.y,65,300*dt*this.damage);this.emit('trail',{x:p.x,y:p.y});}else{p.x+=mx*this.speed*dt;p.y+=my*this.speed*dt;}p.x=clamp(p.x,-925,925);p.y=clamp(p.y,-725,725);
 this.spawn-=dt;if(this.spawn<=0&&this.enemies.length<125){const count=2+Math.floor(this.time/35);for(let i=0;i<Math.min(count,6);i++){const r=this.rand();this.spawnEnemy(this.time>42&&r<.2?'shooter':this.time>23&&r<.42?'charger':'chaser');}this.spawn=Math.max(.45,1.15-this.time*.004);}
 if(this.time>=150&&!this.bossSpawned){this.bossSpawned=true;this.spawnEnemy('boss');this.emit('boss');}
 if(this.time>=180&&!this.boss){this.state='victory';this.emit('end',{win:true});return;}
 if(this.time>=240){this.hurt(9999);return;}
 if(this.time>this.nextHeal){this.nextHeal+=32;this.drops.push({x:clamp(p.x+130,-900,900),y:clamp(p.y-120,-700,700),v:20,type:'heal'});this.emit('healDrop');}
 this.attack-=dt;if(this.attack<=0){let near=null,min=620;for(const e of this.enemies){const d=Math.hypot(e.x-p.x,e.y-p.y);if(e.hp>0&&d<min){min=d;near=e;}}if(near){const a=Math.atan2(near.y-p.y,near.x-p.x);const multi=this.up.multi||0;for(let i=0;i<=multi;i++)this.shot(a+(i-multi/2)*.17,hero.damage*this.damage);if(this.hero===2&&min<120)this.area(p.x,p.y,115,16*this.damage);this.emit('shoot',{hero:this.hero});this.attack=hero.rate/Math.pow(1.2,this.up.haste||0);}else this.attack=.1;}
 this.orbitTick-=dt;if((this.up.orbit||0)>0&&this.orbitTick<=0){this.orbitTick=.2;for(let i=0;i<this.up.orbit;i++){const a=this.time*2.4+i*2*Math.PI/this.up.orbit;this.area(p.x+Math.cos(a)*88,p.y+Math.sin(a)*88,29,16*this.damage);}}
 for(const e of this.enemies){if(e.hp<=0)continue;e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);let dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;e.timer-=dt;if(e.stun<=0){if(e.type==='charger'){if(e.phase===0&&e.timer<=0){e.phase=1;e.timer=.75;e.ax=dx/d;e.ay=dy/d;this.emit('chargeWarn',{x:e.x,y:e.y});}else if(e.phase===1&&e.timer<=0){e.phase=2;e.timer=.55;}else if(e.phase===2&&e.timer<=0){e.phase=0;e.timer=2.4;}if(e.phase===2){e.x+=e.ax*470*dt;e.y+=e.ay*470*dt;}else if(e.phase===0){e.x+=dx/d*e.speed*dt;e.y+=dy/d*e.speed*dt;}}
 else if(e.type==='shooter'){if(d>310){e.x+=dx/d*e.speed*dt;e.y+=dy/d*e.speed*dt;}else if(d<190){e.x-=dx/d*e.speed*dt;e.y-=dy/d*e.speed*dt;}if(e.timer<=0&&d<700){e.timer=2.4;this.bullets.push({x:e.x,y:e.y,vx:dx/d*170,vy:dy/d*170,r:7,life:4,hostile:true,dmg:14,color:'#ff7567'});}}
 else{e.x+=dx/d*e.speed*dt;e.y+=dy/d*e.speed*dt;if(e.type==='boss'&&e.timer<=0){e.timer=e.hp<1200?1.8:2.6;for(let i=0;i<12;i++){const a=i*Math.PI/6+this.time*.3;this.bullets.push({x:e.x,y:e.y,vx:Math.cos(a)*165,vy:Math.sin(a)*165,r:8,life:5,hostile:true,dmg:18,color:'#ff835d'});}this.hazards.push({x:p.x,y:p.y,r:85,t:1.3,done:false});this.emit('bossShot');}}
 }if(Math.hypot(e.x-p.x,e.y-p.y)<e.r+p.r)this.hurt(e.type==='boss'?28:e.type==='charger'?20:12);}
 for(const b of this.bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.hostile){if(Math.hypot(b.x-p.x,b.y-p.y)<p.r+b.r){this.hurt(b.dmg);b.life=0;}}else for(const e of this.enemies){if(e.hp>0&&!b.hit.includes(e.id)&&Math.hypot(b.x-e.x,b.y-e.y)<e.r+b.r){this.hit(e,b.dmg);b.hit.push(e.id);if(b.hit.length>b.pierce){b.life=0;break;}}}}
 for(const hz of this.hazards){hz.t-=dt;if(hz.t<=0&&!hz.done){hz.done=true;if(Math.hypot(p.x-hz.x,p.y-hz.y)<hz.r+p.r)this.hurt(24);this.emit('dangerBurst',{x:hz.x,y:hz.y,r:hz.r});}}
 this.hazards=this.hazards.filter(h=>h.t>-.3);this.bullets=this.bullets.filter(b=>b.life>0).slice(-300);this.enemies=this.enemies.filter(e=>e.hp>0);
 const magnet=92*(1+.65*(this.up.magnet||0));for(const drop of this.drops){const dx=p.x-drop.x,dy=p.y-drop.y,d=Math.hypot(dx,dy);if(d<magnet){drop.x+=dx*dt*8;drop.y+=dy*dt*8;}if(d<23){if(drop.type==='heal'){p.hp=Math.min(p.maxHp,p.hp+drop.v);this.emit('heal',{v:drop.v});}else{this.xp+=drop.v*(1+.15*(this.up.magnet||0));this.score+=5;}drop.dead=true;}}this.drops=this.drops.filter(d=>!d.dead);
 if(this.xp>=this.need&&this.state==='playing'){this.xp-=this.need;this.level++;this.need=12+this.level*5;const pool=UPGRADES.filter(u=>(this.up[u.id]||0)<u.cap);this.choices=[];while(pool.length&&this.choices.length<3){const i=Math.floor(this.rand()*pool.length);this.choices.push(pool.splice(i,1)[0]);}if(this.choices.length){this.state='upgrade';this.emit('upgrade');}else{p.hp=Math.min(p.maxHp,p.hp+25);this.score+=500;}}
 }
}
globalThis.GameCore={Sim,HEROES,UPGRADES,clamp};
})();
