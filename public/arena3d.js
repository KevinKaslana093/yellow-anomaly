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
  this.heroes=[0,1,2].map(i=>this.buildHero(i));this.heroes.forEach(h=>this.scene.add(h));
  this.batches={};this.batch('body',this.geo.box,150,true);this.batch('head',this.geo.box,150,true);this.batch('visor',this.geo.box,150,false,true);this.batch('legs',this.geo.box,300,true);this.batch('arms',this.geo.box,300,true);this.batch('enemyCore',this.geo.sphere,150,false,true);this.batch('bullets',this.geo.sphere,320,false,true);this.batch('drops',this.geo.oct,220,false,true);this.batch('particles',this.geo.box,400,false,true);this.batch('orbit',this.geo.oct,6,false,true);this.batch('trails',this.geo.oct,30,false,true);this.batch('hazards',this.geo.ring,30,false,true);this.batch('effects',this.geo.ring,50,false,true);
  this.batch('heroSphere',this.geo.sphere,130,true);this.batches.heroSphere.material.metalness=.1;this.batch('heroCone',this.geo.cone,40,true);this.batches.heroCone.material.metalness=.1;
  this.heroParts=[];this.heroes.forEach(h=>h.traverse(m=>{if(m.isMesh&&(m.geometry===this.geo.sphere||m.geometry===this.geo.cone)){this.heroParts.push(m);m.visible=false;}}));
  this.batch('heals',this.geo.box,50,false,true);this.boss=this.buildBoss();this.scene.add(this.boss);
  this.marker=new T.Mesh(new T.RingGeometry(.29,.32,48),new T.MeshBasicMaterial({color:0xecf866,side:T.DoubleSide,transparent:true,opacity:.8,depthWrite:false}));this.marker.rotation.x=-Math.PI/2;this.scene.add(this.marker);
  this.beam=new T.Mesh(new T.CylinderGeometry(.22,.32,7,24,1,true),new T.MeshBasicMaterial({color:0xedff8c,transparent:true,opacity:.12,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending}));this.scene.add(this.beam);
  this.labelCanvas=document.createElement('canvas');this.labelCanvas.width=512;this.labelCanvas.height=128;this.labelCtx=this.labelCanvas.getContext('2d');this.labelTex=new T.CanvasTexture(this.labelCanvas);this.label=new T.Sprite(new T.SpriteMaterial({map:this.labelTex,transparent:true,depthTest:false}));this.label.scale.set(2,.5,1);this.scene.add(this.label);this.lastCombo=-1;
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
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const c=canvas.getContext('2d');c.fillStyle='#1f3038';c.fillRect(0,0,1024,1024);
  for(let x=0;x<1024;x+=64)for(let y=0;y<1024;y+=64){c.fillStyle=((x+y)/64)%2?'#2d4148':'#2b3e45';c.fillRect(x+1,y+1,62,62);c.fillStyle='#b5c9cc25';c.fillRect(x+5,y+5,2,2);c.fillRect(x+56,y+56,2,2);}
  c.strokeStyle='#bccc9340';c.lineWidth=2;c.beginPath();c.arc(512,512,230,0,TAU);c.stroke();c.beginPath();c.arc(512,512,210,0,TAU);c.stroke();c.fillStyle='#d8deb53a';c.font='900 110px Arial';c.textAlign='center';c.fillText('SECTOR 03',512,535);c.font='20px monospace';c.fillText('Y E L L O W   A N O M A L Y',512,577);
  for(let i=0;i<1024;i+=40){c.fillStyle='#d1ba4c';c.fillRect(i,8,23,12);c.fillRect(i,1004,23,12);c.fillRect(8,i,12,23);c.fillRect(1004,i,12,23);}
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
  const floor=this.mesh(this.world,new T.BoxGeometry(19.2,.5,15.2),this.mat('#38423c'),[0,-.28,0],[1,1,1]);
  const surface=new T.Mesh(new T.PlaneGeometry(19.2,15.2),new T.MeshStandardMaterial({map:tex,roughness:.88,metalness:.12}));surface.rotation.x=-Math.PI/2;surface.position.y=-.02;surface.receiveShadow=true;this.world.add(surface);
  this.box(this.world,'#0f1920',[0,-.82,0],[19.6,.6,15.6]);
  for(const z of [-7.72,7.72]){this.box(this.world,'#35464a',[0,.24,z],[19.8,.48,.25]);this.mesh(this.world,'box',this.glow('#d8e166'),[0,.5,z],[19.7,.035,.06]);}
  for(const x of [-9.72,9.72]){this.box(this.world,'#35464a',[x,.24,0],[.25,.48,15.4]);this.mesh(this.world,'box',this.glow('#d8e166'),[x,.5,0],[.06,.035,15.4]);}
  for(let i=-8;i<=8;i+=4)for(const z of [-8.3,8.3]){this.box(this.world,'#2c3a3e',[i,.6,z],[.5,1.4,.55]);this.mesh(this.world,'box',this.glow('#8df0d2'),[i,1.3,z],[.36,.1,.36]);}
  for(const o of GameCore.OBSTACLES||[]){const x=o.x*S,z=o.y*S,r=o.r*S;this.mesh(this.world,'cyl',this.mat('#313e42'),[x,.24,z],[r,.48,r]);this.mesh(this.world,'cyl',this.mat('#ad943e',.6),[x,.5,z],[r*.87,.08,r*.87]);this.mesh(this.world,'cyl',this.glow('#c7ea87'),[x,.555,z],[r*.45,.025,r*.45]);for(let i=0;i<6;i++){const a=i*TAU/6;this.box(this.world,'#101c22',[x+Math.cos(a)*r*.92,.24,z+Math.sin(a)*r*.92],[.07,.28,.07]);}}
  for(const x of [-10.6,10.6])for(let z=-7;z<=7;z+=2.7){this.box(this.world,'#253338',[x,.45,z],[1.3,.9,1.6]);this.box(this.world,'#55604d',[x,.95,z],[1.2,.14,1.5]);}
  // Distant industrial silhouettes provide parallax beyond the playable platform.
  for(let i=0;i<22;i++){const x=Math.sin(i*4.31)*23,z=Math.cos(i*2.21)*22;if(Math.abs(x)<11&&Math.abs(z)<9)continue;this.box(this.world,'#1b2b31',[x,-1.3,z],[1.4+(i%3),2+(i%4),1.7]);}
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
 drawHeroBatches(){for(const g of this.heroes)g.updateMatrixWorld(true);for(const part of this.heroParts){const m=this.batches[part.geometry===this.geo.sphere?'heroSphere':'heroCone'],i=m.count++;m.setMatrixAt(i,part.matrixWorld);m.setColorAt(i,part.material.color);}}
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
 onEvent(e,hero){if(e.type==='nova')this.jump[hero]=.55;if(e.type==='ultimate'){this.jump=[.65,.65,.65];this.power=1;}if(e.type==='dash')this.jump[1]=.37;if(e.type==='hurt')this.power=Math.max(this.power,.15);}
 render(f){
  const {sim,mode,visualTime:t,save,aimMoving,shake}=f,dt=Math.min(.05,Math.max(0,t-this.lastTime));this.lastTime=t;const active=mode==='playing';
  if(sim!==this.lastSim){this.target.set(sim?sim.p.x*S:0,0,sim?sim.p.y*S:0);this.jump=[0,0,0];this.lastSim=sim;}
  for(const mesh of Object.values(this.batches))mesh.count=0;
  if(active){this.jump=this.jump.map(v=>Math.max(0,v-dt));this.power=Math.max(0,this.power-dt*1.4);}
  if(sim){this.target.x+=(sim.p.x*S-this.target.x)*.12;this.target.z+=(sim.p.y*S-this.target.z)*.12;}else{this.target.set(0,0,0);}
  const mobile=this.width<600,dist=this.height<500?8.6:mobile?12.4:11.7;this.look.copy(this.target);this.look.y=.18;
  const jitter=save.motion?shake*S*.3:0;this.camera.position.set(this.target.x+Math.sin(this.yaw)*dist*.75+(Math.random()-.5)*jitter,dist*.78,this.target.z+Math.cos(this.yaw)*dist*.75+(Math.random()-.5)*jitter);this.camera.lookAt(this.look);
  this.sun.position.set(this.target.x-5,12,this.target.z+7);this.sun.target.position.copy(this.target);this.flashLight.position.set(this.target.x,1.8,this.target.z);this.flashLight.intensity=this.power*16;
  this.heroes.forEach(h=>h.visible=!!sim);this.marker.visible=!!sim;this.boss.visible=!!sim?.boss&&sim.boss.hp>0;this.beam.visible=!!sim&&sim.charge>=100;this.label.visible=!!sim&&sim.combo>8;
  if(!sim){this.drawPost(save.post!==false);return;}
  const p=sim.p;
  for(let i=0;i<3;i++){const g=this.heroes[i],lead=i===sim.hero,n=(i-sim.hero+3)%3,spread=lead?0:n===1?-.56:.56;g.position.set(p.x*S+spread,0,p.y*S+(lead?0:.5));g.scale.setScalar(lead?1:.7);let dir=Math.atan2(p.dx,p.dy);
   if(!aimMoving){let nearest=null,d=6;for(const e of sim.enemies){const ed=Math.hypot(e.x-p.x,e.y-p.y)*S;if(ed<d){nearest=e;d=ed;}}if(nearest)dir=Math.atan2(nearest.x-p.x,nearest.y-p.y);else dir=.2;}
   let delta=Math.atan2(Math.sin(dir-g.rotation.y),Math.cos(dir-g.rotation.y));g.rotation.y+=delta*.14;
   const moving=active&&aimMoving&&save.motion,step=moving?Math.sin(t*(sim.dash>0?28:13)+i*.8):0,jump=save.motion&&this.jump[i]>0?Math.sin((1-this.jump[i]/(i===1?.37:.55))*Math.PI)*.4:0;
   g.userData.body.position.y=Math.max(0,jump)+(moving?Math.abs(step)*.035:0);g.userData.body.rotation.x=lead&&sim.dash>0?.32:0;g.userData.legs.forEach((leg,j)=>leg.rotation.x=step*(j===0?1:-1)*.5);g.userData.arms.forEach((arm,j)=>arm.rotation.x=-step*(j===0?1:-1)*.35);
  }
  this.drawHeroBatches();this.marker.position.set(p.x*S,.015,p.y*S);this.marker.material.color.set(GameCore.HEROES[sim.hero].color);this.marker.scale.setScalar(1+Math.sin(t*3)*.05);this.beam.position.set(p.x*S,3.5,p.y*S);
  for(const e of sim.enemies){const x=e.x*S,z=e.y*S,angle=Math.atan2(p.x-e.x,p.y-e.y),hit=e.flash>0,color=hit?'#fff3b2':e.type==='charger'?'#a57736':e.type==='shooter'?'#476d75':'#657f71',pulse=active?Math.sin(t*9+e.id)*.04:0;
   if(e.type==='boss'){this.boss.position.set(x,Math.abs(pulse),z);this.boss.rotation.y=angle;continue;}
   const scale=e.type==='charger'?1.25:1,hover=e.type==='shooter'?.22+Math.sin(t*3+e.id)*.045:0;
   this.instance('body',x,.23+hover,z,.32*scale,.31*scale,.25*scale,color,0,angle);
   this.instance('head',x,.44*scale+hover,z,.35*scale,.16*scale,.28*scale,hit?'#ffffce':'#26363d',0,angle);
   this.instance('visor',x+Math.sin(angle)*.151*scale,.445*scale+hover,z+Math.cos(angle)*.151*scale,.24*scale,.04,.025,e.type==='shooter'?'#fb907e':'#edcf60',0,angle);
   if(e.type==='shooter'){this.instance('enemyCore',x,.21,z,.09,.09,.09,'#66e7df');}
   else for(const side of [-1,1]){const stride=pulse*side;this.instance('legs',x+Math.cos(angle)*side*.095,.06+Math.abs(stride),z-Math.sin(angle)*side*.095,.09,.12,.19,'#26373a',0,angle);}
   for(const side of [-1,1])this.instance('arms',x+Math.cos(angle)*side*.21,.27+hover,z-Math.sin(angle)*side*.21,.09,.19,.10,color,0,angle);
   if(e.type==='charger'&&e.phase===1){const a=Math.atan2(e.ax,e.ay);this.instance('hazards',x+e.ax*.9,.025,z+e.ay*.9,.23,1.45,1,'#ff684d',-Math.PI/2,0,-a);}
  }
  for(const b of sim.bullets)this.instance('bullets',b.x*S,.3,b.y*S,b.r*S*.8,b.r*S*.8,b.r*S*(b.hostile?1:2.8),b.color,0,Math.atan2(b.vx,b.vy));
  for(const d of sim.drops){if(d.type==='heal'){this.instance('heals',d.x*S,.17,d.y*S,.24,.055,.075,'#67fa8e');this.instance('heals',d.x*S,.17,d.y*S,.075,.055,.24,'#67fa8e');}else{this.instance('drops',d.x*S,.14+Math.sin(t*3+d.x)*.02,d.y*S,.047,.047,.047,'#8aeac0',t,t*.5);}}
  for(const h of sim.hazards){this.instance('hazards',h.x*S,.025,h.y*S,h.r*S,h.r*S,1,'#fb5f43',-Math.PI/2);const fill=Math.max(.04,1-h.t/1.3);this.instance('hazards',h.x*S,.03,h.y*S,h.r*S*fill,h.r*S*fill,1,'#fb9472',-Math.PI/2);}
  for(const r of f.rings){const v=1-r.t/r.max,rad=Math.max(.02,r.r*S*Math.min(1,v*1.8));this.instance('effects',r.x*S,.06,r.y*S,rad,rad,Math.max(.2,1-v)*3,r.color,-Math.PI/2);this.instance('effects',r.x*S,.18+(save.motion?Math.sin(v*Math.PI)*.55:0),r.y*S,rad*.83,rad*.83,1,r.color,-Math.PI/2);}
  for(const a of f.particles)this.instance('particles',a.x*S,.08+Math.max(0,Math.sin(a.life*5))*.55,a.y*S,a.r*S,a.r*S,a.r*S,a.color,t,t);
  for(const a of f.trails)this.instance('trails',a.x*S,.18,a.y*S,.12*a.t/.2,.1,.12*a.t/.2,'#e8f67b',0,t);
  for(let i=0;i<(sim.up.orbit||0);i++){const a=sim.time*2.4+i*TAU/sim.up.orbit;this.instance('orbit',p.x*S+Math.cos(a)*.88,.4,p.y*S+Math.sin(a)*.88,.11,.11,.11,'#edfc6c',t*3,t);}
  if(this.lastCombo!==sim.combo){this.lastCombo=sim.combo;const c=this.labelCtx;c.clearRect(0,0,512,128);c.font='italic 900 65px Arial';c.textAlign='center';c.fillStyle='#f5ff6a';c.shadowColor='#172219';c.shadowBlur=8;c.fillText(sim.combo+' COMBO',256,85);this.labelTex.needsUpdate=true;}this.label.position.set(p.x*S,1.8,p.y*S);
  for(const m of Object.values(this.batches)){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
  this.drawPost(save.post!==false);
 }
}
window.Arena3D=Arena3D;
})();
