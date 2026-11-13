// Trusted local motion code: export metadata and return a paused GSAP timeline.
export const composition={width:1080,height:1920,fps:30,duration:4};
export function createMotion({stage,gsap}) {
  stage.replaceChildren();stage.dir='rtl';
  stage.style.background='#101827';
  const timeline=gsap.timeline({paused:true});
  timeline.to({},{duration:composition.duration},0);
  const cards=[['از کد تا حرکت','این ریلز با یک فایل کد ساخته شد'],['خروجی آماده است','پیش‌نمایش و ویدئو از یک تایم‌لاین']];
  cards.forEach(([title,subtitle],index)=>{
    const card=document.createElement('section');
    Object.assign(card.style,{position:'absolute',inset:'0',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'120px 85px',textAlign:'center',color:'#ffffff'});
    const accent=document.createElement('div');Object.assign(accent.style,{width:'130px',height:'130px',borderRadius:'50%',background:'#2dd4bf',marginBottom:'100px'});
    const heading=document.createElement('h1');heading.textContent=title;Object.assign(heading.style,{fontSize:'74px',lineHeight:'1.5',margin:'0 0 65px'});
    const caption=document.createElement('p');caption.textContent=subtitle;Object.assign(caption.style,{fontSize:'38px',lineHeight:'1.8',color:'#94a3b8',margin:'0'});
    card.append(accent,heading,caption);stage.append(card);gsap.set(card,{opacity:0,y:70});
    timeline.fromTo(card,{opacity:0,y:70},{opacity:1,y:0,duration:0.5,ease:'power2.out',immediateRender:false},index*2);
    timeline.fromTo(card,{opacity:1,y:0},{opacity:0,y:-70,duration:0.4,ease:'power1.inOut',immediateRender:false},index*2+1.6);
  });
  return timeline;
}
