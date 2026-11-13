import {compileScenario} from '../scenario-engine/index.js';
export const studyStyles=['minimal','product','educational'];
// One shared story; only visual grammar and choreography vary.
export function compileStyleStudy(brief,style){
  if(!studyStyles.includes(style))throw new Error('Unknown study style');
  const checked=compileScenario(brief);
  const composition={width:checked.width,height:checked.height,fps:checked.fps,duration:checked.duration};
  const story=brief.scenes.map(scene=>({title:scene.title,subtitle:scene.subtitle || '',duration:Math.round((scene.duration ?? 4)*checked.fps)/checked.fps}));
  const code=`export const composition=${JSON.stringify(composition)};\nexport const story=${JSON.stringify(story)};\nexport const style=${JSON.stringify(style)};\nexport function createMotion(context){return (${createStyledMotion.toString()})(context,story,style);}\n`;
  return {composition,story,style,code};
}
function createStyledMotion({stage,gsap,width,height},story,style){
  const themes={minimal:{bg:'#f4f0e8',ink:'#232b26',accent:'#b94c36',muted:'#676c62'},product:{bg:'#0c1224',ink:'#f4f7ff',accent:'#86f0d2',muted:'#a5b1cc'},educational:{bg:'#f5ebd8',ink:'#243b42',accent:'#c94f35',muted:'#5b6b6d'}};
  const theme=themes[style];stage.replaceChildren();stage.dir='rtl';stage.style.background=theme.bg;
  const make=(tag,text,css,parent)=>{const e=document.createElement(tag);e.textContent=text;Object.assign(e.style,css);parent?.append(e);return e;};
  const root=make('div','',{position:'absolute',width:'1080px',height:'1920px',transform:`scale(${width/1080},${height/1920})`,transformOrigin:'top left',color:theme.ink,fontFamily:'Tahoma, Arial, sans-serif',overflow:'hidden'},stage);
  const timeline=gsap.timeline({paused:true});let cursor=0;
  for(const [i,scene] of story.entries()){
    const card=make('section','',{position:'absolute',inset:'0',opacity:'0',boxSizing:'border-box',padding:'150px 94px'},root);card.dataset.studyScene=i;
    make('span',style==='minimal'?'یادداشتِ حرکت':style==='product'?'استودیوی ایده':'دفتر ایده‌ها',{fontSize:'25px',letterSpacing:'1px',color:theme.muted},card);
    make('span',`۰${i+1} / ۰${story.length}`,{position:'absolute',left:'94px',top:'150px',fontSize:'26px',direction:'ltr',color:theme.muted},card);
    const rule=make('div','',{position:'absolute',top:'225px',left:'94px',right:'94px',height:'2px',background:theme.muted,opacity:'.35'},card);
    const number=make('div',`0${i+1}`,{position:'absolute',top:'330px',right:'76px',fontSize:style==='minimal'?'310px':'240px',fontWeight:'bold',lineHeight:'1',color:theme.accent,opacity:style==='minimal'?'.13':'.25',direction:'ltr'},card);
    const heading=make('h1',scene.title,{position:'absolute',top:style==='product'?'830px':'710px',left:'94px',right:'94px',fontSize:style==='minimal'?'112px':'94px',lineHeight:'1.65',margin:'0',fontWeight:'bold'},card);heading.dataset.studyTitle='';
    const detail=make('p',scene.subtitle,{position:'absolute',top:style==='product'?'1080px':'1055px',left:'100px',right:'100px',fontSize:'36px',lineHeight:'2',margin:'0',color:theme.muted},card);
    let illustration;
    if(style==='minimal'){
      illustration=make('div','',{position:'absolute',top:'620px',right:'100px',height:'12px',width:'120px',background:theme.accent,transformOrigin:'right'},card);
      make('p','کمتر، اما دقیق‌تر',{position:'absolute',bottom:'210px',right:'100px',fontSize:'26px',color:theme.muted},card);
    }else if(style==='product'){
      make('div','',{position:'absolute',width:'750px',height:'750px',top:'180px',left:'-220px',borderRadius:'50%',background:'radial-gradient(circle, #26977f55, transparent 68%)'},card);
      illustration=make('div','',{position:'absolute',left:'94px',right:'94px',top:'390px',height:'330px',border:'2px solid #344561',borderRadius:'32px',background:'linear-gradient(130deg,#1f304b,#101a30)',boxShadow:'0 32px 90px #0005',padding:'44px',boxSizing:'border-box'},card);
      make('div','مسیر تولید',{fontSize:'25px',color:theme.muted},illustration);
      const row=make('div','',{display:'flex',gap:'20px',marginTop:'42px'},illustration);
      for(const label of ['سناریو','کد','ریلز'])make('div',label,{flex:'1',padding:'30px 8px',textAlign:'center',fontSize:'32px',border:'1px solid #446279',borderRadius:'16px',color:theme.accent,background:'#ffffff08'},row);
      make('p','یک جریان پیوسته؛ از فکر تا تصویر',{position:'absolute',bottom:'230px',right:'100px',fontSize:'28px',color:theme.accent},card);
    }else{
      make('div','',{position:'absolute',inset:'0',background:'repeating-linear-gradient(transparent,transparent 79px,#385b4914 80px)',pointerEvents:'none'},card);
      illustration=make('div','',{position:'absolute',top:'380px',right:'100px',left:'100px',height:'260px'},card);
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 800 260');svg.style.width='100%';svg.style.height='100%';
      for(const d of ['M 720 200 C 600 180, 500 245, 340 180 S 140 80, 80 90','M 120 65 L 75 90 L 115 135','M 380 75 C 420 20, 520 15, 555 73 C 585 132, 490 160, 424 120 C 380 96, 390 65, 380 75']){
        const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);path.setAttribute('fill','none');path.setAttribute('stroke',theme.accent);path.setAttribute('stroke-width','9');path.setAttribute('stroke-linecap','round');svg.append(path);
      }illustration.append(svg);
      make('p','یاد بگیر، بساز، روایت کن',{position:'absolute',bottom:'220px',right:'100px',fontSize:'30px',color:theme.accent,transform:'rotate(-2deg)'},card);
    }
    const footer=make('div','',{position:'absolute',bottom:'150px',right:'100px',left:'100px',height:'5px',background:theme.muted,opacity:'.3',transformOrigin:'right'},card);
    const enter=style==='minimal'?0.65:style==='product'?0.45:0.55,exit=0.35;
    gsap.set([heading,detail,illustration],{opacity:0});
    timeline.fromTo(card,{opacity:0},{opacity:1,duration:0.18,immediateRender:false},cursor);
    timeline.fromTo(heading,{opacity:0,y:style==='minimal'?34:70},{opacity:1,y:0,duration:enter,ease:'power2.out',immediateRender:false},cursor+0.1);
    timeline.fromTo(detail,{opacity:0,y:24},{opacity:1,y:0,duration:0.45,immediateRender:false},cursor+0.45);
    timeline.fromTo(illustration,{opacity:0,scale:style==='product'?0.9:1,x:style==='educational'?35:0},{opacity:1,scale:1,x:0,duration:enter,ease:style==='product'?'back.out(1.2)':'power2.out',immediateRender:false},cursor+0.2);
    timeline.fromTo(footer,{scaleX:0},{scaleX:1,duration:scene.duration-exit,ease:'none',immediateRender:false},cursor);
    timeline.fromTo(card,{opacity:1,y:0},{opacity:0,y:-20,duration:exit,immediateRender:false},cursor+scene.duration-exit);
    cursor+=scene.duration;
  }
  timeline.to({},{duration:cursor},0);return timeline;
}
