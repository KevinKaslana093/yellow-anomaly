/* Self-contained Three.js arena. Simulation coordinates map to X/Z at 1:100. */
(() => {
'use strict';
const T=THREE,S=.01,TAU=Math.PI*2;
class Arena3D {
 constructor(canvas){
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.scene=new T.Scene();this.scene.background=new T.Color('#121c20');this.scene.fog=new T.Fog('#121c20',17,36);
  this.camera=new T.PerspectiveCamera(43,innerWidth/innerHeight,.1,65);this.target=new T.Vector3();this.look=new T.Vector3();this.yaw=.26;
  this.geo={sphere:new T.SphereGeometry(1,20,14),box:new T.BoxGeometry(1,1,1),oct:new T.OctahedronGeometry(1),cyl:new T.CylinderGeometry(1,1,1,12),cone:new T.ConeGeometry(1,1,12),ring:new T.TorusGeometry(1,.018,6,64)};
  this.materials=new Map();this.dummy=new T.Object3D();this.color=new T.Color();this.jump=[0,0,0];this.power=0;this.lastTime=0;this.lastSim=null;
  this.scene.add(new T.HemisphereLight(0xc3e7ed,0x303020,2.15));
  this.sun=new T.DirectionalLight(0xffe9b0,3.4);this.sun.position.set(-5,12,7);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.5,far:40});this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.018;this.scene.add(this.sun);this.scene.add(this.sun.target);
  const rim=new T.DirectionalLight(0x64cdda,1.2);rim.position.set(5,5,-8);this.scene.add(rim);
  this.flashLight=new T.PointLight(0xf5fba0,0,8,2);this.scene.add(this.flashLight);
  this.world=new T.Group();this.scene.add(this.world);this.buildArena();this.mergeScenery();
  this.heroes=[0,1,2,0,1,2].map(i=>this.buildHero(i));this.heroes.forEach(h=>this.scene.add(h));
  this.batches={};this.batch('heroSphere',this.geo.sphere,320,true);this.batches.heroSphere.material.metalness=.08;this.batch('heroCone',this.geo.cone,60,true);this.batch('particles',this.geo.box,240,false,true);this.batch('effects',this.geo.ring,45,false,true);
  this.heroParts=[];this.heroes.forEach(h=>h.traverse(m=>{if(m.isMesh&&(m.geometry===this.geo.sphere||m.geometry===this.geo.cone)){this.heroParts.push(m);m.userData.root=h;m.visible=false;}}));
  this.weaponModels=new Map();this.plates=this.heroes.map(()=>this.makePlate());this.hitFx=[];
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();window.dispatchEvent(new Event('blur'));});canvas.addEventListener('webglcontextrestored',()=>location.reload());
  this.buildPost();this.resize(innerWidth,innerHeight);document.body.classList.add('has3d');
 }
 mat(color,metal=.1,rough=.55){const key=color+':'+metal+':'+rough;if(!this.materials.has(key))this.materials.set(key,new T.MeshStandardMaterial({color,metalness:metal,roughness:rough}));return this.materials.get(key);}
 glow(color){const key='glow'+color;if(!this.materials.has(key))this.materials.set(key,new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(2.8)}));return this.materials.get(key);}
 mesh(parent,geo,material,pos,scale,rotation){const m=new T.Mesh(this.geo[geo]||geo,material);m.position.set(...pos);m.scale.set(...scale);if(rotation)m.rotation.set(...rotation);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 ball(parent,color,pos,scale,rot){return this.mesh(parent,'sphere',this.mat(color),pos,scale,rot);}
 box(parent,color,pos,scale,rot){return this.mesh(parent,'box',this.mat(color,.45,.6),pos,scale,rot);}
 curve(parent,points,r,color){const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return this.mesh(parent,new T.TubeGeometry(path,20,r,7,false),this.mat(color),[0,0,0],[1,1,1]);}
 buildArena(){
  this.roof=new T.Group();this.world.add(this.roof);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const c=canvas.getContext('2d');c.fillStyle='#263946';c.fillRect(0,0,1024,1024);
  for(let x=0;x<1024;x+=64)for(let y=0;y<1024;y+=64){c.fillStyle=((x+y)/64)%2?'#324b59':'#304651';c.fillRect(x+1,y+1,62,62);}
  c.strokeStyle='#bde2d530';c.lineWidth=5;c.beginPath();c.arc(512,512,260,0,TAU);c.stroke();c.beginPath();c.arc(512,512,240,0,TAU);c.stroke();c.textAlign='center';c.fillStyle='#c3d5ce45';c.font='900 145px Arial';c.fillText('NO RULES',512,525);c.font='32px Arial';c.fillText('R O O F T O P   /   0 3',512,590);
  for(let i=0;i<1024;i+=42){c.fillStyle='#edb652';c.fillRect(i,5,25,20);c.fillRect(i,999,25,20);c.fillRect(5,i,20,25);c.fillRect(999,i,20,25);}
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
  this.box(this.roof,'#172832',[0,-.31,0],[15.2,.6,11.6]);const surface=new T.Mesh(new T.PlaneGeometry(15.2,11.6),new T.MeshStandardMaterial({map:tex,roughness:.87,metalness:.15}));surface.rotation.x=-Math.PI/2;surface.receiveShadow=true;this.roof.add(surface);
  for(const z of [-5.8,5.8])this.mesh(this.roof,'box',this.glow('#ff965e'),[0,-.08,z],[15.25,.045,.035]);for(const x of [-7.6,7.6])this.mesh(this.roof,'box',this.glow('#ff965e'),[x,-.08,0],[.035,.045,11.6]);
  for(let i=0;i<30;i++){const angle=i*2.399,r=13+(i%4)*3,x=Math.cos(angle)*r,z=Math.sin(angle)*r,h=2+i%5;this.box(this.world,'#172932',[x,-6,z],[2.4,h,2.6]);for(let j=0;j<3;j++)this.mesh(this.world,'box',this.glow(i%3?'#387880':'#bb8845'),[x,-5.8+j*.7,z+1.31],[1.4,.06,.015]);}
 }
 buildHero(index){
  const g=new T.Group(),gold=index===2?'#edb61a':'#ffd12c',dark='#363a32',cream='#ffe4a0';g.userData={legs:[],arms:[],yaw:0};
  const part=new T.Group();g.add(part);g.userData.body=part;
  if(index===0){this.ball(part,gold,[0,.53,0],[.32,.43,.26]);this.ball(part,gold,[0,.89,.015],[.245,.26,.22]);this.ball(part,cream,[0,.48,.185],[.25,.3,.115]);
   for(const side of [-1,1]){this.ball(part,'#27b15e',[side*.115,.965,.19],[.077,.086,.04]);this.ball(part,'#102422',[side*.115,.965,.222],[.044,.057,.021]);this.ball(part,'#fffad5',[side*.103,.993,.237],[.012,.016,.009]);}this.curve(part,[[-.105,.825,.214],[0,.802,.239],[.105,.825,.214]],.008,'#725017');
  }else if(index===1){this.ball(part,gold,[0,.48,0],[.265,.35,.225]);this.ball(part,cream,[0,.46,.17],[.205,.235,.10]);this.curve(part,[[-.14,.54,.24],[0,.50,.28],[.14,.54,.24]],.011,'#d49c22');this.ball(part,gold,[0,.91,.015],[.245,.265,.23]);this.ball(part,gold,[0,.83,.21],[.18,.15,.205]);this.ball(part,'#6c3010',[0,.855,.37],[.12,.087,.075]);
   for(const side of [-1,1]){this.ball(part,gold,[side*.14,1.24,.005],[.08,.3,.062],[0,0,-side*.23]);this.ball(part,'#efaa32',[side*.15,1.27,.056],[.042,.205,.014],[0,0,-side*.23]);this.ball(part,'#fff9d7',[side*.107,1.005,.203],[.063,.079,.033]);this.ball(part,'#493015',[side*.1,1.005,.232],[.032,.044,.018]);this.ball(part,'#ffffff',[side*.092,1.024,.245],[.01,.015,.008]);}
   this.curve(part,[[0,.3,-.16],[.05,.18,-.42],[.18,.22,-.61],[.24,.36,-.67]],.057,gold);
  }else{this.ball(part,gold,[0,.51,0],[.34,.415,.25]);this.ball(part,gold,[0,.99,.005],[.3,.265,.24]);this.ball(part,'#d2a547',[0,.55,.17],[.26,.29,.1]);this.ball(part,'#ac88ae',[0,.875,.235],[.235,.135,.127]);this.ball(part,'#b697bd',[0,.807,.29],[.185,.045,.072]);this.curve(part,[[-.155,.849,.328],[0,.83,.361],[.155,.849,.328]],.009,'#684b71');
   for(const side of [-1,1]){this.ball(part,'#77596f',[side*.082,.92,.345],[.029,.018,.008]);this.ball(part,gold,[side*.335,1.037,0],[.15,.066,.084],[0,0,side*.22]);this.ball(part,'#d69469',[side*.348,1.045,.055],[.088,.033,.025],[0,0,side*.22]);this.ball(part,'#f6e9c1',[side*.12,1.067,.208],[.08,.048,.028]);this.ball(part,'#292322',[side*.12,1.056,.234],[.029,.027,.012]);this.ball(part,gold,[side*.12,1.101,.22],[.091,.035,.024]);this.curve(part,[[side*.048,1.154,.214],[side*.13,1.162,.206],[side*.20,1.141,.17]],.019,'#70501d');this.curve(part,[[side*.225,1.15,-.03],[side*.325,1.22,-.035],[side*.355,1.37,-.045]],.043,'#3e4242');this.mesh(part,'cone',this.mat('#484a45'),[side*.356,1.37,-.045],[.039,.15,.039],[0,0,-side*.28]);}
   for(let i=0;i<9;i++){const a=i*2.4;this.mesh(part,'cone',this.mat('#dba91b'),[Math.sin(a)*.2,.77+Math.cos(a)*.07,.20],[.026,.09,.035],[.4,0,a]);}
  }
  for(const side of [-1,1]){const leg=new T.Group();leg.position.set(side*(index===1?.12:.16),.19,0);part.add(leg);this.ball(leg,gold,[0,0,0],[.11,.18,.11]);this.ball(leg,index===0?dark:index===2?'#97809f':gold,[0,-.13,.07],[index===1?.11:.13,.068,index===1?.21:.13]);g.userData.legs.push(leg);
   const arm=new T.Group();arm.position.set(side*(index===2?.3:.26),.65,0);arm.rotation.z=side*.30;part.add(arm);this.ball(arm,gold,[side*.025,-.13,.01],[index===2?.12:.095,.225,.10]);this.ball(arm,index===0?dark:index===2?'#a48bab':gold,[side*.04,-.3,.045],[.085,.08,.075]);g.userData.arms.push(arm);}
  return g;
 }
 mergeScenery(){const groups=new Map();for(const m of [...this.world.children]){if(!m.isMesh||![this.geo.box,this.geo.cyl].includes(m.geometry))continue;const key=m.geometry.uuid+':'+m.material.type;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);}for(const parts of groups.values()){const first=parts[0],mat=first.material.clone();mat.color.set(0xffffff);const batch=new T.InstancedMesh(first.geometry,mat,parts.length);for(let i=0;i<parts.length;i++){const p=parts[i];p.updateMatrix();batch.setMatrixAt(i,p.matrix);batch.setColorAt(i,p.material.color);this.world.remove(p);}batch.castShadow=true;batch.receiveShadow=true;this.world.add(batch);}}
 drawHeroBatches(){for(const g of this.heroes)g.updateMatrixWorld(true);for(const part of this.heroParts){if(!part.userData.root.visible)continue;const m=this.batches[part.geometry===this.geo.sphere?'heroSphere':'heroCone'],i=m.count++;m.setMatrixAt(i,part.matrixWorld);m.setColorAt(i,part.userData.root.userData.hit?new T.Color(0xfff6ce):part.material.color);}}
 buildBoss(){const g=new T.Group();this.box(g,'#323f45',[0,.68,0],[1.15,1.1,.85]);this.box(g,'#e08a43',[0,1.29,0],[1.34,.19,1.02]);this.box(g,'#25333b',[0,1.3,0],[.96,.36,.64]);this.mesh(g,'box',this.glow('#ff724f'),[0,1.30,.34],[.78,.11,.06]);this.mesh(g,'sphere',this.glow('#fb8150'),[0,.68,.46],[.22,.22,.035]);for(const side of [-1,1]){this.box(g,'#5f6f66',[side*.83,.82,0],[.4,.7,.46]);this.box(g,'#171f26',[side*.36,.17,.02],[.31,.3,.68]);this.mesh(g,'cone',this.mat('#bf8e43'),[side*.83,1.35,0],[.15,.45,.15]);}return g;}
 batch(name,geo,count,shadow=false,glow=false){const mat=glow?new T.MeshBasicMaterial({color:new T.Color(0xffffff).multiplyScalar(2.6)}):new T.MeshStandardMaterial({color:0xffffff,metalness:.4,roughness:.55});const mesh=new T.InstancedMesh(geo,mat,count);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=shadow;mesh.receiveShadow=!glow;mesh.count=0;this.scene.add(mesh);this.batches[name]=mesh;}
 instance(name,x,y,z,sx,sy,sz,color,rx=0,ry=0,rz=0){const m=this.batches[name],i=m.count;if(i>=m.instanceMatrix.count)return;const d=this.dummy;d.position.set(x,y,z);d.rotation.set(rx,ry,rz);d.scale.set(sx,sy,sz);d.updateMatrix();m.setMatrixAt(i,d.matrix);this.color.set(color);m.setColorAt(i,this.color);m.count++;}
 inputVector(x,y){const c=Math.cos(this.yaw),s=Math.sin(this.yaw);return{x:x*c+y*s,y:-x*s+y*c};}
 buildPost(){
  const hdr=this.renderer.capabilities.isWebGL2&&this.renderer.extensions.has('EXT_color_buffer_float');
  const options={type:hdr?T.HalfFloatType:T.UnsignedByteType,minFilter:T.LinearFilter,magFilter:T.LinearFilter};
  this.sceneTarget=new T.WebGLRenderTarget(1,1,options);this.sceneTarget.samples=this.renderer.capabilities.isWebGL2?2:0;
  this.bloomA=new T.WebGLRenderTarget(1,1,{...options,depthBuffer:false});this.bloomB=new T.WebGLRenderTarget(1,1,{...options,depthBuffer:false});
  this.postScene=new T.Scene();this.postCamera=new T.Camera();const vertex='varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const blur='varying vec2 vUv;uniform sampler2D source;uniform vec2 stepUV;uniform float threshold;vec3 tap(float n){vec3 c=texture2D(source,vUv+stepUV*n).rgb;float l=max(c.r,max(c.g,c.b));return c*max(0.,l-threshold)/max(l,.001);}void main(){vec3 c=tap(0.)*.227027; c+=(tap(1.3846)+tap(-1.3846))*.316216;c+=(tap(3.2307)+tap(-3.2307))*.070270;gl_FragColor=vec4(c,1.);}';
  this.blurMat=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:blur,toneMapped:false,depthTest:false,depthWrite:false,uniforms:{source:{value:null},stepUV:{value:new T.Vector2()},threshold:{value:1.25}}});
  this.finalMat=new T.ShaderMaterial({vertexShader:vertex,toneMapped:false,depthTest:false,depthWrite:false,uniforms:{source:{value:this.sceneTarget.texture},bloom:{value:this.bloomB.texture},pixel:{value:new T.Vector2()},strength:{value:.18},grade:{value:1}},fragmentShader:`varying vec2 vUv;uniform sampler2D source;uniform sampler2D bloom;uniform vec2 pixel;uniform float strength;uniform float grade;
vec3 film(vec3 c){return clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);}
void main(){vec3 c=texture2D(source,vUv).rgb;vec3 a=texture2D(source,vUv+vec2(pixel.x,0.)).rgb;vec3 b=texture2D(source,vUv-vec2(pixel.x,0.)).rgb;vec3 d=texture2D(source,vUv+vec2(0.,pixel.y)).rgb;vec3 e=texture2D(source,vUv-vec2(0.,pixel.y)).rgb;float edge=length(a-b)+length(d-e);c=mix(c,(a+b+d+e+c*4.)/8.,clamp(edge*.14,0.,.42));c+=texture2D(bloom,vUv).rgb*strength;c*=vec3(1.025,1.01,.985);c=film(c*1.12);vec2 q=vUv*(1.-vUv);float vig=pow(max(.01,q.x*q.y*16.),.075);c*=mix(1.,vig,grade);gl_FragColor=vec4(pow(c,vec3(1./2.2)),1.);}`});
  this.quad=new T.Mesh(new T.PlaneGeometry(2,2),this.finalMat);this.quad.frustumCulled=false;this.postScene.add(this.quad);
 }
 drawPost(enabled){
  if(!enabled){this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.camera);return;}
  this.renderer.setRenderTarget(this.sceneTarget);this.renderer.render(this.scene,this.camera);
  this.quad.material=this.blurMat;this.blurMat.uniforms.source.value=this.sceneTarget.texture;this.blurMat.uniforms.stepUV.value.set(1/this.bloomA.width,0);this.blurMat.uniforms.threshold.value=1.2;this.renderer.setRenderTarget(this.bloomA);this.renderer.render(this.postScene,this.postCamera);
  this.blurMat.uniforms.source.value=this.bloomA.texture;this.blurMat.uniforms.stepUV.value.set(0,1/this.bloomB.height);this.blurMat.uniforms.threshold.value=0;this.renderer.setRenderTarget(this.bloomB);this.renderer.render(this.postScene,this.postCamera);
  this.quad.material=this.finalMat;this.finalMat.uniforms.strength.value=this.width<700?.12:.2;this.renderer.setRenderTarget(null);this.renderer.render(this.postScene,this.postCamera);
 }
 resize(w,h){this.width=w;this.height=h;const ratio=Math.min(devicePixelRatio||1,w<700?1.25:1.5);this.renderer.setPixelRatio(ratio);this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.sun.shadow.mapSize.set(1024,1024);if(this.sceneTarget){this.sceneTarget.setSize(Math.round(w*ratio),Math.round(h*ratio));const reduction=w<700?4:2;this.bloomA.setSize(Math.max(1,Math.round(w/reduction)),Math.max(1,Math.round(h/reduction)));this.bloomB.setSize(this.bloomA.width,this.bloomA.height);this.finalMat.uniforms.pixel.value.set(1/(w*ratio),1/(h*ratio));}}
 makePlate(){const canvas=document.createElement('canvas');canvas.width=384;canvas.height=112;const texture=new T.CanvasTexture(canvas),sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(1.65,.48,1);this.scene.add(sprite);return{canvas,texture,sprite,last:''};}
 weaponModel(key,kind){let m=this.weaponModels.get(key);if(m&&m.userData.kind!==kind){this.scene.remove(m);this.weaponModels.delete(key);m=null;}if(m)return m;m=new T.Group();m.userData.kind=kind;this.scene.add(m);this.weaponModels.set(key,m);
  if(kind==='bat'){this.mesh(m,'cyl',this.mat('#755030'),[0,.1,0],[.034,.25,.034]);this.mesh(m,'cyl',this.mat('#dbad68'),[0,.43,0],[.068,.46,.068]);this.mesh(m,'cyl',this.mat('#e8d7a6'),[0,-.035,0],[.06,.035,.06]);}
  if(kind==='pan'){this.box(m,'#39464e',[0,.12,0],[.06,.36,.06]);this.mesh(m,'cyl',this.mat('#657d88',.8,.3),[0,.46,0],[.21,.06,.21],[Math.PI/2,0,0]);this.mesh(m,'cyl',this.mat('#26363e',.7,.25),[0,.46,.036],[.17,.016,.17],[Math.PI/2,0,0]);}
  if(kind==='hammer'){this.box(m,'#935f37',[0,.2,0],[.06,.64,.06]);this.box(m,'#6e8294',[0,.56,0],[.49,.26,.26]);this.box(m,'#d8ac69',[-.27,.56,0],[.06,.29,.29]);this.box(m,'#d8ac69',[.27,.56,0],[.06,.29,.29]);}return m;
 }
 onEvent(e){if(e.type==='hit'){this.power=e.id===0?.45:.18;this.hitFx.push({...e,t:.25,max:.25,color:e.id===0?'#ff7760':'#fff3a5',r:55});}if(e.type==='skill')this.hitFx.push({...e,t:.48,max:.48,color:GameCore.HEROES[e.hero].color,r:e.hero===0?185:100});if(e.type==='impact')this.hitFx.push({...e,t:.16,max:.16,color:e.id===0?'#b5ffee':'#ff7964',r:e.kind==='hammer'?95:60});}
 render(frame){
  const{sim,mode,visualTime:t,save,shake=0}=frame,dt=Math.min(.05,Math.max(0,t-this.lastTime));this.lastTime=t;const active=mode==='playing';if(sim!==this.lastSim){this.target.set(0,0,0);this.lastSim=sim;this.hitFx=[];}
  for(const m of Object.values(this.batches))m.count=0;this.power=Math.max(0,this.power-dt*2);
  const mobile=this.width<650,p=sim?.p,following=p&&!p.fall&&!p.respawn&&!p.eliminated,tx=following?p.x*S*(mobile?.85:.38):0,tz=following?p.y*S*(mobile?.85:.38):0;this.target.x+=(tx-this.target.x)*.09;this.target.z+=(tz-this.target.z)*.09;
  const baseDistance=this.height<500?12.4:mobile?15:17,distance=baseDistance*(sim?Math.max(.58,Math.sqrt(sim.bounds.x/760)):1),jitter=save.motion?shake*S*.26:0;this.look.copy(this.target);this.look.y=.25;
  this.camera.position.set(this.target.x+Math.sin(this.yaw)*distance*.65+(Math.random()-.5)*jitter,distance*.78,this.target.z+Math.cos(this.yaw)*distance*.65);this.camera.lookAt(this.look);this.flashLight.position.set(p?p.x*S:0,1.5,p?p.y*S:0);this.flashLight.intensity=this.power*12;
  this.roof.scale.set(sim?sim.bounds.x/760:1,1,sim?sim.bounds.y/580:1);this.heroes.forEach(g=>g.visible=false);this.plates.forEach(p=>p.sprite.visible=false);for(const m of this.weaponModels.values())m.visible=false;
  if(sim){
   for(const f of sim.fighters){const g=this.heroes[(f.id+sim.hero)%6];g.visible=!f.eliminated&&!f.respawn; if(!g.visible)continue;
    g.position.set(f.x*S,f.fall?-f.fall*f.fall*5:0,f.y*S);g.userData.hit=f.flash>0;g.scale.setScalar(f.id===0?1.12:1.04);let yaw=Math.atan2(f.dx,f.dy);g.rotation.y+=Math.atan2(Math.sin(yaw-g.rotation.y),Math.cos(yaw-g.rotation.y))*.35;g.rotation.z=f.fall?f.fall*3:0;
    const step=active&&f.moving&&save.motion?Math.sin(t*14+f.id):0,dodge=f.dodge>0?Math.sin((1-f.dodge/.3)*Math.PI)*.48:0,body=g.userData.body;
    body.position.y=(save.motion?Math.abs(step)*.035:0)+dodge+(f.skillDash>0&&f.hero===1?.27:0);body.rotation.x=f.stun>0?-.28:f.skillDash>0?.4:0;body.scale.setScalar(f.hero===0&&f.skillCd>6.6?1.13:1);
    g.userData.legs.forEach((leg,j)=>leg.rotation.x=f.skillDash>0&&f.hero===1?-1.2:step*(j?1:-1)*.5);
    const a=f.attack,progress=a?Math.min(1,a.t/a.wind):0;g.userData.arms.forEach((arm,j)=>{arm.rotation.x=-step*(j?1:-1)*.3;arm.rotation.z=(j?1:-1)*.3;if(a&&j===(f.weapon?1:f.combo%2)){arm.rotation.x=a.done?-1.5:progress*.9;arm.rotation.z=(j?1:-1)*(a.done?.1:.8);}else if(f.weapon&&j===1)arm.rotation.x=-.9;});
    if(f.dodge>0)body.rotation.x=-.5;
    const ring=f.id===0?'#7cffe2':'#ff7b66';if(!f.fall){this.instance('effects',f.x*S,.025,f.y*S,f.id===0?.49:.4,f.id===0?.49:.4,1.5,ring,-Math.PI/2);if(f.inv>.25)this.instance('effects',f.x*S,.22,f.y*S,.47,.47,1,'#b0e9f3',-Math.PI/2);}
    if(a&&!a.done&&f.id>0)this.instance('effects',(f.x+f.dx*65)*S,.035,(f.y+f.dy*65)*S,a.reach*S*.65,a.reach*S*.65,1+progress*3,'#ff674b',-Math.PI/2);
    const plate=this.plates[f.id],label=(f.id===0?'你':GameCore.HEROES[f.hero].name+' '+f.id)+'  '+Math.round(f.damage)+'%';plate.sprite.visible=!f.fall;plate.sprite.position.set(f.x*S,1.85,f.y*S);if(plate.last!==label){plate.last=label;const c=plate.canvas.getContext('2d');c.clearRect(0,0,384,112);c.fillStyle='#0a1720dd';c.beginPath();c.roundRect(8,20,368,80,18);c.fill();c.font='bold 40px Arial';c.textAlign='center';c.fillStyle=f.id===0?'#a8ffe3':f.damage>100?'#ff9871':'#f5e6d7';c.fillText(label,192,74);plate.texture.needsUpdate=true;}
    if(f.weapon){const w=this.weaponModel('hand'+f.id,f.weapon.kind);w.visible=true;g.updateMatrixWorld(true);const hand=new T.Vector3(.04,-.3,.045);g.userData.arms[1].localToWorld(hand);w.position.copy(hand);w.rotation.set(a&&a.done?-1.5:-.4,g.rotation.y,a?Math.sin(progress*Math.PI)*1.4:-.25);w.scale.setScalar(1.2);}
   }
   for(const w of sim.weapons){const model=this.weaponModel('ground'+w.id,w.kind);model.visible=true;model.position.set(w.x*S,.19+Math.sin(t*2+w.id)*.045,w.y*S);model.rotation.set(.45,t*.45+w.id,Math.PI/3);model.scale.setScalar(1.2);this.instance('effects',w.x*S,.028,w.y*S,.35,.35,1.5,GameCore.WEAPONS[w.kind].color,-Math.PI/2);}
   for(const w of sim.projectiles){const model=this.weaponModel('throw'+w.id,w.kind);model.visible=true;model.position.set(w.x*S,.65,w.y*S);model.rotation.set(t*20,t*12,.7);model.scale.setScalar(1.2);}
   this.drawHeroBatches();
  }
  for(const [key,m] of this.weaponModels)if(!m.visible){this.scene.remove(m);this.weaponModels.delete(key);}
  if(active)this.hitFx.forEach(f=>f.t-=dt);this.hitFx=this.hitFx.filter(f=>f.t>0);for(const f of this.hitFx){const v=1-f.t/f.max,r=Math.max(.03,f.r*S*v);this.instance('effects',f.x*S,.2,f.y*S,r,r,(1-v)*4,f.color,-Math.PI/2);}
  for(const a of frame.particles||[])this.instance('particles',a.x*S,.12+Math.sin(a.life*5)*.65,a.y*S,a.r*S,a.r*S,a.r*S,a.color,t,t);
  for(const m of Object.values(this.batches)){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}this.drawPost(save.post!==false);
 }

}
window.Arena3D=Arena3D;
})();
