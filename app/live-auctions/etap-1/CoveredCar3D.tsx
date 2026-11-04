"use client";
import {useEffect,useRef,useState} from "react";

// Procedural car-shaped red cloth mesh, rotating 360° in WebGL. No model/CDN required.
// Clearly a showroom visualization, not a verified vehicle or listing.
const vertexSource=`
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform float uAngle;
uniform float uAspect;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vView;
void main(){
 float co=cos(uAngle),si=sin(uAngle);
 mat3 turn=mat3(co,0.0,-si, 0.0,1.0,0.0, si,0.0,co);
 vec3 p=turn*aPosition;
 vec3 n=turn*aNormal;
 vec3 screenSpace=vec3(p.x*.88+p.z*.39,p.y*.91-p.x*.11-p.z*.25,p.z*.81-p.x*.53);
 gl_Position=vec4(screenSpace.x*1.1/max(uAspect,1.15)/2.25,(screenSpace.y-1.02)/1.8,screenSpace.z/9.0,1.0);
 vNormal=n;
 vPosition=aPosition;
 vView=screenSpace;
}
`;
const fragmentSource=`
precision mediump float;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vView;
void main(){
 vec3 n=normalize(vNormal);
 vec3 lightA=normalize(vec3(-.58,.95,.52));
 vec3 lightB=normalize(vec3(.55,.7,-.7));
 float direct=max(0.0,dot(n,lightA));
 float bounce=max(0.0,dot(n,lightB));
 float grain=sin(vPosition.x*25.0+vPosition.z*8.5)*sin(vPosition.z*15.0-vPosition.x*5.0);
 float folds=sin(vPosition.x*15.5+vPosition.z*5.6)*.11+grain*.12;
 float rim=pow(1.0-max(0.0,dot(n,normalize(vec3(.3,.3,1.0)))),3.0);
 float glimmer=pow(max(dot(reflect(-lightA,n),normalize(vec3(.25,.32,1.0))),0.0),26.0);
 float intensity=.17+direct*.67+bounce*.19+rim*.2+folds;
 vec3 crimson=vec3(.98,.017,.067)*intensity;
 crimson+=vec3(1.0,.17,.20)*glimmer*.58;
 crimson+=vec3(.25,.0,.03)*sin(vPosition.x*31.0+vPosition.z*4.2)*.17;
 gl_FragColor=vec4(clamp(crimson,0.0,1.0),1.0);
}
`;

function height(x:number,z:number){
 const xx=x/3.05,zz=z/1.2;
 const roof=Math.exp(-Math.pow((x+.25)/1.5,4));
 const outerDrop=Math.pow(Math.abs(zz),4.0);
 const endDrop=Math.pow(Math.abs(xx),7.0);
 const wheelFront=Math.exp(-Math.pow((x-1.8)/.58,2))*Math.exp(-Math.pow((Math.abs(z)-.9)/.34,2));
 const wheelBack=Math.exp(-Math.pow((x+1.8)/.58,2))*Math.exp(-Math.pow((Math.abs(z)-.9)/.34,2));
 const cloth=(.83+roof*.80+wheelFront*.20+wheelBack*.20)*(1-.89*outerDrop)*(1-.88*endDrop);
 const folds=.045*Math.sin(x*23+z*9)*Math.pow(Math.abs(zz),1.4)+.035*Math.sin(x*11.3+z*8.9);
 return Math.max(.018,cloth+folds);
}

function generateMesh(){
 const across=96,depth=48;
 const vertices:number[]=[],normals:number[]=[],indices:number[]=[];
 for(let j=0;j<=depth;j++){
  const z=(j/depth*2-1)*1.2;
  for(let i=0;i<=across;i++){
   const x=(i/across*2-1)*3.05;
   const y=height(x,z);
   const dx=(height(x+.01,z)-height(x-.01,z))/.02;
   const dz=(height(x,z+.01)-height(x,z-.01))/.02;
   const len=Math.hypot(dx,1,dz);
   vertices.push(x,y,z);
   normals.push(-dx/len,1/len,-dz/len);
  }
 }
 for(let j=0;j<depth;j++)for(let i=0;i<across;i++){
  const a=j*(across+1)+i,b=a+across+1;
  indices.push(a,b,a+1,b,b+1,a+1);
 }
 return {vertices:new Float32Array(vertices),normals:new Float32Array(normals),indices:new Uint16Array(indices)};
}
function shader(gl:WebGLRenderingContext,type:number,source:string){
 const s=gl.createShader(type);if(!s)return null;
 gl.shaderSource(s,source);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);return null}
 return s;
}

export default function CoveredCar3D(){
 const ref=useRef<HTMLCanvasElement|null>(null);
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  const canvas=ref.current;
  if(!canvas)return;
  let gl:WebGLRenderingContext|null=null;
  try{gl=canvas.getContext("webgl",{alpha:true,antialias:true,depth:true,preserveDrawingBuffer:false});}catch{}
  if(!gl)return;
  const webgl=gl;
  const v=shader(webgl,webgl.VERTEX_SHADER,vertexSource);
  const f=shader(webgl,webgl.FRAGMENT_SHADER,fragmentSource);
  if(!v||!f)return;
  const program=webgl.createProgram();if(!program)return;
  webgl.attachShader(program,v);webgl.attachShader(program,f);webgl.linkProgram(program);
  if(!webgl.getProgramParameter(program,webgl.LINK_STATUS))return;
  const data=generateMesh();
  const vb=webgl.createBuffer(),nb=webgl.createBuffer(),ib=webgl.createBuffer();
  if(!vb||!nb||!ib)return;
  webgl.useProgram(program);
  webgl.bindBuffer(webgl.ARRAY_BUFFER,vb);
  webgl.bufferData(webgl.ARRAY_BUFFER,data.vertices,webgl.STATIC_DRAW);
  const pos=webgl.getAttribLocation(program,"aPosition");
  if(pos<0)return;
  webgl.enableVertexAttribArray(pos);webgl.vertexAttribPointer(pos,3,webgl.FLOAT,false,0,0);
  webgl.bindBuffer(webgl.ARRAY_BUFFER,nb);
  webgl.bufferData(webgl.ARRAY_BUFFER,data.normals,webgl.STATIC_DRAW);
  const normal=webgl.getAttribLocation(program,"aNormal");
  if(normal<0)return;
  webgl.enableVertexAttribArray(normal);webgl.vertexAttribPointer(normal,3,webgl.FLOAT,false,0,0);
  webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER,ib);
  webgl.bufferData(webgl.ELEMENT_ARRAY_BUFFER,data.indices,webgl.STATIC_DRAW);
  const uAngle=webgl.getUniformLocation(program,"uAngle");
  const uAspect=webgl.getUniformLocation(program,"uAspect");
  webgl.enable(webgl.DEPTH_TEST);webgl.depthFunc(webgl.LEQUAL);
  webgl.disable(webgl.CULL_FACE);
  webgl.clearColor(0,0,0,0);
  const motion=window.matchMedia("(prefers-reduced-motion: reduce)");
  let raf=0,halted=false;
  const started=performance.now();
  const paint=(time:number)=>{
    if(halted)return;
    if(canvas.isConnected&&!document.hidden){
      const bounds=canvas.getBoundingClientRect();
      const dpr=Math.min(window.devicePixelRatio||1,1.5);
      const width=Math.max(1,Math.round(bounds.width*dpr)),heightPx=Math.max(1,Math.round(bounds.height*dpr));
      if(canvas.width!==width||canvas.height!==heightPx){canvas.width=width;canvas.height=heightPx;webgl.viewport(0,0,width,heightPx)}
      webgl.clear(webgl.COLOR_BUFFER_BIT|webgl.DEPTH_BUFFER_BIT);
      webgl.uniform1f(uAngle,motion.matches?-.33:((time-started)*.00017)%(Math.PI*2));
      webgl.uniform1f(uAspect,width/heightPx);
      webgl.drawElements(webgl.TRIANGLES,data.indices.length,webgl.UNSIGNED_SHORT,0);
    }
    raf=window.requestAnimationFrame(paint);
  };
  const lost=(e:Event)=>{e.preventDefault();halted=true;window.cancelAnimationFrame(raf);setReady(false)};
  canvas.addEventListener("webglcontextlost",lost);
  setReady(true);
  raf=window.requestAnimationFrame(paint);
  return()=>{
    halted=true;window.cancelAnimationFrame(raf);
    canvas.removeEventListener("webglcontextlost",lost);
    webgl.deleteBuffer(vb);webgl.deleteBuffer(nb);webgl.deleteBuffer(ib);
    webgl.deleteProgram(program);webgl.deleteShader(v);webgl.deleteShader(f);
  };
 },[]);
 return <canvas ref={ref} className={`eaLxWebglCanvas ${ready?"is-ready":""}`} aria-label="Процедурна 3D визуализация на червен покрит автомобил, въртящ се на 360 градуса"/>;
}
