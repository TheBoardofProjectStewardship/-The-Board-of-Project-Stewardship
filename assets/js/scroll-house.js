/* Original line-drawing house for this page.
   The mesh is built once from the supplied plan sheets. The upper sheet's
   overall width is 45 feet, so the main envelope runs 45 feet. Scroll changes
   the cut height and an orthographic camera; it does not rebuild the mesh
   or flip the view. casa-serra ships without a license, so none of its code
   or assets are used. The cut follows that project's public starter prompt.
*/
(function (factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof globalThis !== "undefined") globalThis.BoardHouse = api;
  if (typeof document !== "undefined") {
    var start = function () { api.mount(); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
})(function () {
/** Original illustrative model reconstructed from the supplied raster references.
 * Units are approximate feet, not surveyed dimensions or structural member sizes.
 * X goes left to right on the plan; Z goes from sheet top to sheet bottom; Y is up.
 * All coordinates are built once. The renderer changes cut heights, never topology.
 */
const WALL = [0.985,0.982,0.972], FLOOR = [0.965,0.962,0.95];
const ROOF = [0.90,0.905,0.898], GLASS = [0.78,0.83,0.84];
const INK = [0.12,0.13,0.13], DETAIL = [0.42,0.44,0.43];
const FURN = [0.93,0.932,0.922], PLANT = [0.80,0.84,0.74];
function buildModel() {
  const groups = [], labels = [];
  const group = id => { const g = {id,solid:[],lines:[]}; groups.push(g); return g; };
  const site=group('site'), lower=group('lower'), slab=group('upperfloor');
  const upper=group('upper'), roofs=group('roof'), garageRoof=group('garageRoof');
  const porchRoof=group('porchRoof'), finish=group('finish');
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function tri(g,a,b,c,color=WALL,role=0,baseY=Math.min(a[1],b[1],c[1])) {
    const n=cross(sub(b,a),sub(c,a)); const d=Math.hypot(...n)||1;
    for (const p of [a,b,c]) g.solid.push(...p,...n.map(v=>v/d),...color,role,baseY);
  }
  function line(g,a,b,color=INK,role=0,baseY=Math.min(a[1],b[1])) {g.lines.push(...a,...color,role,baseY,...b,...color,role,baseY);}
  function face(g,pts,color=WALL,role=0,edge=true,baseY=Math.min(...pts.map(p=>p[1]))) {
    for(let i=1;i<pts.length-1;i++) tri(g,pts[0],pts[i],pts[i+1],color,role,baseY);
    if(edge) for(let i=0;i<pts.length;i++) line(g,pts[i],pts[(i+1)%pts.length],INK,role,baseY);
  }
  function box(g,x0,y0,z0,x1,y1,z1,color=WALL,role=0,edge=true) {
    if(x1<=x0||y1<=y0||z1<=z0) return;
    const p=[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],
             [x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]];
    for(const idx of [[4,7,6,5],[0,1,2,3],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]]) face(g,idx.map(i=>p[i]),color,role,false,y0);
    if(edge) for(const [a,b] of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]) line(g,p[a],p[b],INK,role,y0);
  }
  // Openings [start,end,sill,head,kind]. Every opening is cut from the wall;
  // siding strokes are interrupted at those same intervals.
  function wall(g,axis,fixed,a,b,y0,y1,holes=[],exterior=false,sign=1,t=.5,bodyRole=0) {
    const body = exterior ? 5 : bodyRole;
    const sorted=[...holes].sort((a,b)=>a[0]-b[0]);
    function segment(u,v,bot,top,role=body) {
      if(axis==='x')box(g,u,bot,fixed-t/2,v,top,fixed+t/2,WALL,role);
      else box(g,fixed-t/2,bot,u,fixed+t/2,top,v,WALL,role);
    }
    let cursor=a;
    for(const h of sorted) {
      const lo=Math.max(a,h[0]),hi=Math.min(b,h[1]); if(hi<=lo) continue;
      segment(cursor,lo,y0,y1); segment(lo,hi,y0,Math.min(y1,h[2]));
      segment(lo,hi,Math.max(y0,h[3]),Math.min(y1,h[3]+.6),exterior?2:body);
      segment(lo,hi,Math.max(y0,h[3]+.6),y1);cursor=hi;
      if(exterior) {
        const f=fixed+sign*(t/2+.04),s=lo+.1,e=hi-.1,bot=h[2]+.08,top=h[3]-.08;
        function rect(u,v,l,h,col) {
          if(axis==='x')box(finish,u,l,f-.05,v,h,f+.05,col,0,false);
          else box(finish,f-.05,l,u,f+.05,h,v,col,0,false);
        }
        rect(s,e,bot,top,h[4]==='door'?[.88,.89,.87]:GLASS);
        if(h[4]!=='garage') {
          rect(lo-.08,lo+.08,bot-.14,top+.14,WALL);rect(hi-.08,hi+.08,bot-.14,top+.14,WALL);
          rect(lo,hi,bot-.14,bot+.02,WALL);rect(lo,hi,top-.02,top+.14,WALL);
          if(h[4]!=='door')rect(lo,hi,(bot+top)/2-.05,(bot+top)/2+.05,WALL);
          if(hi-lo>5) rect((lo+hi)/2-.05,(lo+hi)/2+.05,bot,top,WALL);
        } else {
          for(let yy=1;yy<h[3];yy+=1.25) {
            const p=axis==='x'?[[lo,yy,f+.06],[hi,yy,f+.06]]:[[f+.06,yy,lo],[f+.06,yy,hi]];
            line(finish,...p,DETAIL);
          }
          for(let xx=lo+.5;xx<hi-1;xx+=2.5)rect(xx,Math.min(xx+2,hi-.3),h[3]-1.35,h[3]-.5,GLASS);
        }
      }
    }
    segment(cursor,b,y0,y1);
    if(exterior) {
      for(let y=y0+.55;y<y1-.1;y+=.55) {
        let start=a;
        for(const h of sorted) {
          if(y<h[2]-.16||y>h[3]+.16)continue;
          stroke(start,Math.max(start,h[0]-.13),y);start=Math.max(start,h[1]+.13);
        }
        stroke(start,b,y);
      }
    }
    function stroke(u,v,y) {
      // The east upper front uses vertical battens instead of lap courses.
      if(axis==='x' && fixed===32 && y0>10) v=Math.min(v,57.3);
      if(v<=u)return;const f=fixed+sign*(t/2+.015);
      line(finish,axis==='x'?[u,y,f]:[f,y,u],axis==='x'?[v,y,f]:[f,y,v],DETAIL);
    }
  }
  const windowAt=(at,w,y=0)=>[at-w/2,at+w/2,y+2.7,y+7.2,'window'];
  const doorAt=(at,w=3,y=0)=>[at-w/2,at+w/2,y,y+7.3,'door'];
  function partition(g,axis,f,a,b,y,holes=[]) {wall(g,axis,f,a,b,y,y+10,holes,false,1,.3,6);}
  function outline(g,points,y,color=DETAIL) {for(let i=0;i<points.length;i++) line(g,[points[i][0],y,points[i][1]],[points[(i+1)%points.length][0],y,points[(i+1)%points.length][1]],color);}
  function planLabel(text,x,z,minor=false,floor='main',y=.25) {labels.push({text,position:[x,y,z],minor,floor});}
  // Ground slabs follow the two buildings, the open court, and the recessed patio.
  box(site,0,-.28,5,22,0,27,FLOOR,7);
  box(site,31,-.3,0,37,0,24,FLOOR,7);
  box(site,37,-.3,7,58,0,24,FLOOR,7);
  box(site,58,-.3,0,73,0,11,FLOOR,7);
  box(site,58,-.3,11,76,0,32,FLOOR,7);
  box(site,57,-.3,24,58,0,32,FLOOR,7);
  box(site,31,-.23,24,57,0,33,FLOOR,3);
  box(site,37,-.2,0,58,0,7,[.91,.926,.885],3);
  box(site,73,-.22,0,76,0,11,FLOOR,7);
  box(site,22,-.26,5,31,-.05,27,[.88,.9,.84]);
  // Narrow planted strip and two path ribbons. No private plan image is embedded.
  box(site,24,-.04,5.5,25.5,.16,26.4,PLANT);
  box(site,27,-.03,5.5,28.25,.06,26.4,FLOOR);
  box(site,29,-.03,11,30,.06,24,FLOOR);
  // Main lower envelope. Open patio and rear court remain outside this polygon.
  wall(lower,'x',0,31,37,0,10,[windowAt(34,2.5)],true,-1);
  wall(lower,'z',31,0,24,0,10,[windowAt(5,2),doorAt(17,3)],true,-1);
  wall(lower,'z',37,0,7,0,10,[],true,1);
  wall(lower,'x',7,37,58,0,10,[windowAt(41,2),windowAt(45,2),windowAt(49,2),windowAt(53,2)],true,-1);
  wall(lower,'z',58,0,7,0,10,[],true,-1);
  wall(lower,'x',0,58,73,0,10,[windowAt(61,2),windowAt(68,3)],true,-1);
  wall(lower,'z',73,0,11,0,10,[doorAt(9)],true,1);
  wall(lower,'x',11,73,76,0,10,[],true,-1);
  wall(lower,'z',76,11,32,0,10,[windowAt(17,7),windowAt(28,3)],true,1);
  wall(lower,'x',32,57,76,0,10,[windowAt(61,2.5),windowAt(70,6.5)],true,1);
  wall(lower,'z',57,24,32,0,10,[doorAt(26)],true,-1);
  wall(lower,'x',24,31,57,0,10,[windowAt(34,2.5),[39,48,0,8,'door'],windowAt(53,3)],true,1);
  // Utility, pantry, stair enclosure, powder, mudroom and front office.
  partition(lower,'z',37,7,14.5,0,[doorAt(13)]);
  partition(lower,'x',14.5,31,37,0,[doorAt(34)]);
  partition(lower,'x',19,31,37,0,[doorAt(34)]);
  partition(lower,'z',37,19,24,0,[doorAt(21.5)]);
  partition(lower,'x',11.3,37,54.5,0); // long stair south edge, opens at right
  partition(lower,'z',58,7,11.5,0);
  partition(lower,'z',64,0,11,0,[doorAt(8.5,2.5)]);
  partition(lower,'x',6.3,64,73,0,[doorAt(67)]);
  partition(lower,'x',11,58,64,0,[doorAt(61)]);
  partition(lower,'x',24,57,76,0,[doorAt(61)]);
  partition(lower,'z',62,28,32,0);
  partition(lower,'x',28,57,62,0,[doorAt(59.5,2.4)]);
  // Garage door faces the patio side, as in the axonometric reference.
  wall(lower,'x',27,0,22,0,10,[[2,20,0,8,'garage']],true,1,.6);
  wall(lower,'x',5,0,22,0,10,[],true,-1,.6);
  wall(lower,'z',0,5,27,0,10,[windowAt(12,3),windowAt(21,3)],true,-1,.6);
  wall(lower,'z',22,5,27,0,10,[doorAt(10,3)],true,1,.6);
  // Fixed rise to the upper FLOOR (10.5), not to its wall or roof height.
  // Thin tread prisms make a readable flight; they are a diagram, not stair detailing.
  for(let i=0;i<17;i++) {
    const x=39+i*.94,yt=(i+1)*.53;
    box(lower,x,Math.max(.05,yt-.16),7.6,x+.94,yt,10.7,FLOOR,1);
  }
  // Plan-only tread marks lie on the lower slab, under the rising stair.
  for(let i=0;i<=17;i++)line(site,[39+i*.94,.07,7.6],[39+i*.94,.07,10.7],DETAIL,1);
  line(site,[39,.07,9.1],[56,.07,9.1],DETAIL,1);
  box(lower,55,8.86,7.6,57.4,9.05,10.7,FLOOR,1);
  for(let i=0;i<3;i++)box(lower,54.5,9.05+i*.48,10.7+i*.86,57.4,9.23+(i+1)*.42,11.56+i*.86,FLOOR,1);
  box(lower,54.2,10.32,13.28,58,10.5,15.05,FLOOR,1);
  // Kitchen perimeter, island, dining and living furnishings stay pale in plan.
  box(lower,37.4,.05,22.1,55.5,3,23.5,FURN);
  box(lower,37.4,.05,16.5,38.8,3,22.1,FURN);
  box(lower,41,0,17.3,47.8,3,20.8,FURN);
  outline(lower,[[42,18],[44.3,18],[44.3,20],[42,20]],3.03);
  box(lower,51.1,.05,16,56.4,2.7,19.5,FURN);
  for(const x of [51.5,54.2])for(const z of [15,19.8])box(lower,x,.1,z,x+1.2,1.5,z+1.2,FURN);
  box(lower,67,.05,13,73,1.6,15.4,FURN);
  box(lower,65.4,.05,15.3,67.4,1.6,21.7,FURN);
  box(lower,68.2,.05,16.8,71.8,1.15,19.8,FURN);
  box(lower,73.8,.05,20,75.5,4,23,FURN);
  box(lower,67,.05,24.5,74.8,2.4,26,FURN);
  box(lower,58.3,.05,1,60.3,2.4,2.6,FURN);
  box(lower,70,.05,1,72.5,2.5,5.5,FURN);
  // Cars are outlines, not black blocks; they remain legible beneath room labels.
  for(const x of [2.4,12]) {
    outline(site,[[x,9],[x+1,8],[x+5.3,8],[x+6.3,9],[x+6.3,22],[x+5.3,23],[x+1,23],[x,22]],.04);
    outline(site,[[x+.6,12],[x+5.7,12],[x+5.5,19],[x+.8,19]],.05);
  }
  // Deck balusters and complete returns. Spacing is visual, not a code assertion.
  function rail(g,axis,f,a,b,y,role) {
    const at=(u,h)=>axis==='x'?[u,h,f]:[f,h,u];
    const prism=(u,v,y0,y1,w=.075)=>axis==='x'?box(g,u,y0,f-w,v,y1,f+w,WALL,role):box(g,f-w,y0,u,f+w,y1,v,WALL,role);
    prism(a,b,y+2.95,y+3.08,.11);prism(a,b,y+.16,y+.25,.07);
    for(let x=a;x<=b+.001;x+=.48)line(g,at(x,y+.22),at(x,y+2.98),INK,role);
    for(let x=a;x<=b+.001;x+=4)prism(x,Math.min(x+.13,b+.13),y,y+3.08,.095);
  }
  rail(lower,'x',32.8,35.5,56.6,.05,3);
  rail(lower,'z',31.3,25,32.8,.05,3);
  rail(lower,'z',56.6,25,32.8,.05,3);
  box(lower,31.3,.05,31.8,31.65,10,32.15,WALL,3);
  box(lower,56.5,.05,31.8,56.85,10,32.15,WALL,3);
  box(lower,32,0,28,38,1.6,30,FURN,3);
  box(lower,43,0,28,48,1.6,30,FURN,3);
  // Upper slab has BOTH outdoor recesses and a real stair opening.
  box(slab,31,10,15,76,10.5,32,FLOOR);
  box(slab,58,10,0,76,10.5,15,FLOOR);
  box(slab,37,10,6.5,58,10.5,7.4,FLOOR);
  box(slab,37,10,7.4,38.8,10.5,15,FLOOR);
  box(slab,38.8,10,11.5,54.2,10.5,15,FLOOR);
  // side balcony x31..37, beside garage rather than along full front wall
  box(slab,31,10.08,0,37,10.5,15,FLOOR,4);
  // Upper exterior is stepped in plan: balcony, stair recess, bedroom wing.
  wall(upper,'x',32,31,76,10.5,20.5,[windowAt(35,2,10.5),windowAt(44,3.4,10.5),windowAt(52,2,10.5),windowAt(67,3.4,10.5)],true,1);
  wall(upper,'z',31,15,32,10.5,20.5,[windowAt(26,2,10.5)],true,-1);
  wall(upper,'x',15,31,37,10.5,20.5,[],true,-1);
  wall(upper,'z',37,6.5,15,10.5,20.5,[doorAt(13,3,10.5)],true,-1);
  wall(upper,'x',6.5,37,58,10.5,20.5,[windowAt(41,1.4,10.5),windowAt(45,1.4,10.5),windowAt(49,1.4,10.5),windowAt(53,1.4,10.5)],true,-1);
  wall(upper,'z',58,0,6.5,10.5,20.5,[],true,-1);
  wall(upper,'x',0,58,76,10.5,20.5,[windowAt(65,3,10.5)],true,-1);
  wall(upper,'z',76,0,32,10.5,20.5,[windowAt(6,3,10.5),windowAt(16,2,10.5),windowAt(26,3,10.5)],true,1);
  // Primary suite, two right-side bedrooms, two hall baths, laundry and circulation.
  partition(upper,'z',37,15,32,10.5,[doorAt(17.5,2.5,10.5),doorAt(23,2.5,10.5)]);
  partition(upper,'x',21,31,37,10.5);
  partition(upper,'x',15,37,52,10.5,[doorAt(50,3,10.5)]);
  partition(upper,'z',52,15,32,10.5,[doorAt(18,3,10.5)]);
  partition(upper,'z',58,22,32,10.5,[doorAt(23.7,3,10.5)]);
  partition(upper,'x',22,52,58,10.5,[doorAt(55,3,10.5)]);
  partition(upper,'x',11,58,76,10.5,[doorAt(61,3,10.5)]);
  partition(upper,'z',64,11,22,10.5,[doorAt(13,2.5,10.5),doorAt(20,2.5,10.5)]);
  partition(upper,'x',16.5,64,76,10.5);
  partition(upper,'x',22,58,76,10.5,[doorAt(61,3,10.5)]);
  // Guard beside the actual upper stair opening, no slab through the flight.
  rail(upper,'x',11.4,39,53.8,10.5,1);
  rail(upper,'x',.3,31.3,36.8,10.5,4);
  rail(upper,'z',31.3,.3,14.7,10.5,4);
  rail(upper,'x',14.7,31.3,36.8,10.5,4);
  function bed(x,z,w=5,d=6) {
    box(upper,x,10.55,z,x+w,12.1,z+d,FURN);
    for(let i=0;i<2;i++)box(upper,x+.22+i*w/2,12.1,z+.25,x+w/2-.22+i*w/2,12.28,z+1.6,WALL);
  }
  bed(41,24,6.1,6.5);bed(67,2,5.8,6.7);bed(67,24,5.8,6.7);
  for(const z of [12,17.5]) {
    box(upper,73,10.55,z,75.5,12.1,z+3.4,FURN);
    outline(upper,[[73.3,z+.3],[75.2,z+.3],[75.2,z+3.1],[73.3,z+3.1]],12.12);
    box(upper,65,10.55,z,67.5,13,z+1.6,FURN);
  }
  box(upper,31.6,10.55,28.5,36.2,12.1,31.4,FURN);
  box(upper,32,10.55,23,33.6,13,25.5,FURN);
  box(upper,32,10.55,15.8,36.2,16.5,17,FURN);
  for(const z of [25,28])box(upper,52.5,10.55,z,55.2,13,z+2.6,FURN);
  // Roof primitives. Eastern bedroom gable runs north/south; west cross roof
  // ends in a hip beside the balcony. Shared depth testing resolves their valleys.
  function roofX(g,x0,x1,z0,z1,eave,ridge,hip=0,role=0) {
    const m=(z0+z1)/2,r0=x0+hip;
    face(g,[[x0,eave,z0],[x1,eave,z0],[x1,ridge,m],[r0,ridge,m]],ROOF,role);
    face(g,[[x0,eave,z1],[r0,ridge,m],[x1,ridge,m],[x1,eave,z1]],ROOF,role);
    if(hip)face(g,[[x0,eave,z0],[r0,ridge,m],[x0,eave,z1]],ROOF,role);
    else face(g,[[x0,eave,z0],[x0,eave,z1],[x0,ridge,m]],WALL,role);
    face(g,[[x1,eave,z0],[x1,ridge,m],[x1,eave,z1]],WALL,role);
    const half=(z1-z0)/2;
    for(let z=z0+.9;z<z1-.5;z+=1.2) {
      const frac=1-Math.abs(z-m)/half,y=eave+(ridge-eave)*frac;
      line(g,[x0+hip*frac,y+.015,z],[x1,y+.015,z],[.75,.77,.76],role);
    }
  }
  function roofZ(g,x0,x1,z0,z1,eave,ridge) {
    const m=(x0+x1)/2;
    face(g,[[x0,eave,z0],[m,ridge,z0],[m,ridge,z1],[x0,eave,z1]],ROOF);
    face(g,[[m,ridge,z0],[x1,eave,z0],[x1,eave,z1],[m,ridge,z1]],ROOF);
    face(g,[[x0,eave,z0],[x1,eave,z0],[m,ridge,z0]],WALL);
    const frontGableZ=g===roofs && x1===77 ? 32.27 : z1;
    face(g,[[x0,eave,frontGableZ],[m,ridge,frontGableZ],[x1,eave,frontGableZ]],WALL,0,!(g===roofs && x1===77));
    for(let x=x0+.9;x<x1-.5;x+=1.2) {
      const y=eave+(ridge-eave)*(1-Math.abs(x-m)/((x1-x0)/2));
      line(g,[x,y+.015,z0],[x,y+.015,z1],[.75,.77,.76]);
    }
  }
  roofX(garageRoof,-.8,22.8,4.2,27.8,10.05,15,0);
  roofX(roofs,30,66,14,33,20.5,27.8,8.8);
  roofZ(roofs,57,77,-.8,33,20.5,29.3);
  // Subordinate rear roof above long stair; preserves the open outside court.
  roofX(roofs,36.4,65,5.8,15.5,20.5,24.4,4.5);
  roofX(porchRoof,36.5,58.2,-.5,6.6,10.05,11.1,0,3);
  // Roof over breezeway: sloped shallow connector, below the side balcony.
  face(porchRoof,[[22.5,9.5,5],[30.6,9.5,5],[30.6,10,25.7],[22.5,10,25.7]],ROOF);
  // Dormer cut into the FRONT west slope, with cheeks meeting its pitch.
  face(roofs,[[43,22.3,30.9],[49.5,22.3,30.9],[49.5,25.2,30.9],[43,25.2,30.9]],WALL);
  face(roofs,[[43,22.3,30.9],[43,25.2,30.9],[43,26.1,25.8]],WALL);
  face(roofs,[[49.5,22.3,30.9],[49.5,26.1,25.8],[49.5,25.2,30.9]],WALL);
  roofZ(roofs,42.5,50,25.8,31.4,25.2,27.1);
  box(roofs,43.8,23.25,30.92,48.7,24.75,31.02,GLASS,0);
  line(roofs,[43.8,24,31.03],[48.7,24,31.03],INK);
  // Board-and-batten on upper east gable; mask the upper bedroom window.
  for(let x=57.4;x<76;x+=1.15) {
    const top=20.5+(29.3-20.5)*(1-Math.abs(x-67)/10);
    if(x>65.15&&x<68.85) {
      line(finish,[x,10.5,32.5],[x,13.05,32.5],DETAIL);
      line(finish,[x,17.87,32.5],[x,top,32.5],DETAIL);
    } else line(finish,[x,10.5,32.5],[x,top,32.5],DETAIL);
  }
  // Upper-sheet overall width is 45 ft. Garage width is 22 ft. No other
  // dimension is printed; small figures on the sheets are too blurred to certify.
  planLabel('45 ft',53.5,0.55);
  planLabel('22 ft',11,4.15);
  for(const r of [
    ['Garage',11,15],['Utility',34,8],['Pantry',34,21.5,true],
    ['Stair',46.5,9.4],['Kitchen',44,14.7],['Dining',53.5,21.5],
    ['Living',70.5,19.5],['Powder',61,5,true],['Mudroom',68.4,3.8,true],
    ['Foyer',68.3,9],['Entrance',73.2,6.2,true],['Office',69,29],['Storage',59.5,30.4,true],
    ['Patio',44,26],['Exit',33.2,16.5,true]
  ])planLabel(...r);
  for(const r of [
    ['Primary',44,20],['Walk-in',33.6,18.6],['Bath',34.5,26,true],
    ['Bedroom 1',68,8.8],['Bedroom 2',67,23.4],['Bath',69,13.8,true],
    ['Bath',69,19.4,true],['Laundry',55,24],['Balcony',34,8],['Stair',46,9],
    ['Roof below',11,16,true]
  ])planLabel(r[0],r[1],r[2],!!r[3],'upper',10.65);
  return {groups:groups.map(g=>({id:g.id,solid:new Float32Array(g.solid),lines:new Float32Array(g.lines)})),labels,
    bounds:{min:[-1,-.5,-1.2],max:[77.4,29.5,34]},
    notes:'Illustrative raster reconstruction. Main and upper reference dimensions differ; no measurement certification.'};
}

const DEFAULT_BOUNDS = { min: [-1, -0.5, -1.2], max: [77.2, 29.5, 34.5] };
const PAPER = [0.969, 0.965, 0.949];
const MAX_PIXELS = 1600000;
const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, p) => { const t = clamp((p - a) / (b - a)); return t * t * (3 - 2 * t); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function stageAt(progress) {
  const p = clamp(progress);
  return p < 0.16 ? 0 : p < 0.32 ? 1 : p < 0.48 ? 2 : p < 0.66 ? 3 : p < 0.84 ? 4 : 5;
}

/** Scroll peels the finished house. Progress 0 is the whole building. */
function groupState(id, progress) {
  const p = clamp(progress);
  const state = (visible, cut = 100, opacity = 1) => ({ visible, cut, opacity });
  const roofFade = 1 - smooth(0.32, 0.46, p);
  const roofCut = mix(32, 19.6, smooth(0.30, 0.46, p));
  const upperCut = mix(21.2, 10.35, smooth(0.48, 0.64, p));
  const upperFade = p < 0.50 ? 1 : 1 - smooth(0.58, 0.66, p);
  const lowerCut = mix(10.6, 0.42, smooth(0.72, 0.94, p));
  switch (id) {
    case 'site': return state(true);
    case 'lower': return state(true, lowerCut);
    case 'upperfloor': return state(p < 0.67, mix(10.5, 10.15, smooth(0.58, 0.66, p)), upperFade);
    case 'upper': return state(p < 0.67, upperCut, upperFade);
    case 'garageRoof':
    case 'porchRoof':
    case 'roof': return state(roofFade > 0.02, roofCut, roofFade);
    case 'finish': return state(p < 0.67, p < 0.48 ? roofCut : upperCut, p < 0.32 ? 1 : upperFade);
    default: return state(true);
  }
}

function visibleHeight(p, bounds) {
  const full = bounds.max[1];
  if (p < 0.30) return full;
  if (p < 0.50) return mix(full, 20.6, smooth(0.30, 0.46, p));
  if (p < 0.70) return mix(20.6, 11.2, smooth(0.48, 0.66, p));
  return mix(11.2, 1.4, smooth(0.72, 0.94, p));
}

/**
 * Orthographic camera: exact plan first; readable cutaways; garage-left finish.
 * An explicit basis avoids lookAt's singularity when looking straight down.
 * The frustum fits ALL eight visible bounding-box corners at every aspect ratio.
 */
function scrollPose(progress) {
  const p = clamp(Number.isFinite(progress) ? progress : 0);
  const axon = 52 * Math.PI / 180;
  const front = 76 * Math.PI / 180;
  const plan = 0.05;
  const toFront = smooth(0.10, 0.28, p);
  const toPlan = smooth(0.40, 0.62, p);
  return {
    angle: mix(mix(axon, front, toFront), plan, toPlan),
    heading: mix(mix(-36 * Math.PI / 180, Math.PI, toFront), -0.2, toPlan),
  };
}

function cameraFor(progress, width, height, bounds = DEFAULT_BOUNDS, orbit) {
  const p = clamp(Number.isFinite(progress) ? progress : 0);
  const aspect = Math.max(1, width) / Math.max(1, height);
  const pose = scrollPose(p);
  let angle = pose.angle;
  let heading = pose.heading;
  let zoom = 1;
  if (orbit && Number.isFinite(orbit.lockAngle)) {
    angle = orbit.lockAngle;
    if (Number.isFinite(orbit.lockHeading)) heading = orbit.lockHeading;
  }
  if (orbit) {
    heading += Number.isFinite(orbit.yaw) ? orbit.yaw : 0;
    angle += Number.isFinite(orbit.pitch) ? orbit.pitch : 0;
    // Stay above a true top-down view and below a ground-level flip.
    const minAngle = 0.02;
    const maxAngle = 78 * Math.PI / 180;
    if (angle < minAngle) angle = minAngle;
    if (angle > maxAngle) angle = maxAngle;
    zoom = Number.isFinite(orbit.zoom) ? orbit.zoom : 1;
    if (zoom < 0.55) zoom = 0.55;
    if (zoom > 2.4) zoom = 2.4;
  }
  const back = [Math.sin(angle) * Math.sin(heading), Math.cos(angle), Math.sin(angle) * Math.cos(heading)];
  const right = [Math.cos(heading), 0, -Math.sin(heading)];
  const up = [-Math.cos(angle) * Math.sin(heading), Math.sin(angle), -Math.cos(angle) * Math.cos(heading)];
  const top = visibleHeight(p, bounds);
  const target = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + top) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  let left = Infinity, rightEdge = -Infinity, bottom = Infinity, upper = -Infinity;
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], top]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const delta = [x - target[0], y - target[1], z - target[2]];
        const px = dot(delta, right), py = dot(delta, up);
        left = Math.min(left, px); rightEdge = Math.max(rightEdge, px);
        bottom = Math.min(bottom, py); upper = Math.max(upper, py);
      }
    }
  }
  const centerX = (left + rightEdge) / 2, centerY = (bottom + upper) / 2;
  for (let i = 0; i < 3; i++) target[i] += right[i] * centerX + up[i] * centerY;
  const halfHeight = Math.max((upper - bottom) / 2, (rightEdge - left) / (2 * aspect)) * 1.075 * zoom;
  const halfWidth = halfHeight * aspect;
  const eye = target.map((v, i) => v + back[i] * 200);
  return { eye, target, right, up, back, halfWidth, halfHeight, near: 0.1, far: 400, angle, heading };
}

/** Column-major view/projection matrix, shared with the static preview tools. */
function computeMVP(camera) {
  const { right: r, up: u, back: b, eye, halfWidth: w, halfHeight: h, near, far } = camera;
  const dz = -2 / (far - near);
  return new Float32Array([
    r[0] / w, u[0] / h, b[0] * dz, 0,
    r[1] / w, u[1] / h, b[1] * dz, 0,
    r[2] / w, u[2] / h, b[2] * dz, 0,
    -dot(r, eye) / w, -dot(u, eye) / h,
    -dot(b, eye) * dz - (far + near) / (far - near), 1,
  ]);
}

function projectPoint(m, position, width, height) {
  const [x, y, z] = position;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  return {
    x: (0.5 + (m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5) * width,
    y: (0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5) * height,
    depth: (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  };
}

const SOLID_VERTEX = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
attribute float aRole;
attribute float aBaseY;
uniform mat4 uMvp;
uniform mediump float uCut;
varying mediump vec3 vNormal;
varying mediump vec3 vColor;
varying mediump float vRole;
varying mediump float vBaseY;
void main() {
  vec3 p = aPosition;
  p.y = min(p.y, uCut);
  gl_Position = uMvp * vec4(p, 1.0);
  vNormal = aNormal;
  vColor = aColor;
  vRole = aRole;
  vBaseY = aBaseY;
}`;

const SOLID_FRAGMENT = `
precision mediump float;
uniform float uFocus;
uniform float uLift;
uniform float uOpacity;
uniform mediump float uCut;
varying mediump vec3 vNormal;
varying mediump vec3 vColor;
varying mediump float vRole;
varying mediump float vBaseY;
void main() {
  if (vBaseY > uCut + 0.001) discard;
  vec3 normal = normalize(vNormal);
  if (!gl_FrontFacing) normal = -normal;
  float light = 0.93 + 0.07 * max(0.0, dot(normal, normalize(vec3(-0.35, 0.9, 0.28))));
  vec3 color = vColor * light;
  float mark = uLift;
  if (uFocus > 0.5 && abs(vRole - uFocus) < 0.1) mark = 1.0;
  if (mark > 0.0) color = mix(color, vec3(0.12, 0.28, 0.72), 0.50 * mark);
  gl_FragColor = vec4(color, uOpacity);
}`;

const LINE_VERTEX = `
attribute vec3 aPosition;
attribute vec3 aColor;
attribute float aRole;
attribute float aBaseY;
uniform mat4 uMvp;
uniform mediump float uCut;
varying mediump vec3 vColor;
varying mediump float vRole;
varying mediump float vBaseY;
void main() {
  vec3 p = aPosition;
  p.y = min(p.y, uCut);
  gl_Position = uMvp * vec4(p, 1.0);
  vColor = aColor;
  vRole = aRole;
  vBaseY = aBaseY;
}`;

const LINE_FRAGMENT = `
precision mediump float;
uniform float uFocus;
uniform float uLift;
uniform float uOpacity;
uniform mediump float uCut;
varying mediump vec3 vColor;
varying mediump float vRole;
varying mediump float vBaseY;
void main() {
  if (vBaseY > uCut + 0.001) discard;
  vec3 color = vColor;
  float mark = uLift;
  if (uFocus > 0.5 && abs(vRole - uFocus) < 0.1) mark = 1.0;
  if (mark > 0.0) color = mix(color, vec3(0.08, 0.20, 0.55), mark);
  gl_FragColor = vec4(color, uOpacity);
}`;

const SHADOW_VERTEX = `
attribute vec3 aPosition;
uniform mat4 uMvp;
varying mediump vec2 vGround;
void main() {
  vGround = aPosition.xz;
  gl_Position = uMvp * vec4(aPosition, 1.0);
}`;

const SHADOW_FRAGMENT = `
precision mediump float;
uniform vec3 uPaper;
uniform float uStrength;
varying mediump vec2 vGround;
float rectangle(vec2 p, vec2 center, vec2 halfSize) {
  vec2 q = abs(p - center) - halfSize;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
void main() {
  float a = rectangle(vGround, vec2(55.0, 14.5), vec2(22.5, 16.0));
  float b = rectangle(vGround, vec2(12.0, 15.0), vec2(11.0, 11.0));
  float c = rectangle(vGround, vec2(54.0, 31.0), vec2(20.0, 2.5));
  float d = max(min(min(a, b), c), 0.0);
  float shadow = exp(-d * d / 7.0) * uStrength;
  gl_FragColor = vec4(uPaper * (1.0 - shadow), 1.0);
}`;

function labelsFor(model, progress, mvp, width, height) {
  const upper = progress >= 0.50 && progress <= 0.66;
  const main = progress >= 0.68 && progress <= 0.84;
  if (!main && !upper) return [];
  const opacity = upper
    ? smooth(0.50, 0.54, progress) * (1 - smooth(0.62, 0.66, progress))
    : smooth(0.68, 0.72, progress) * (1 - smooth(0.80, 0.84, progress));
  if (opacity < 0.015) return [];
  const floor = main ? 'main' : 'upper';
  const labels = [];
  // Major rooms take priority when the phone view cannot fit every annotation.
  const narrow = width < 640;
  const fontPx = 12;
  const candidates = model.labels.filter(label => label.floor === floor && (!label.minor || !narrow));
  candidates.sort((a, b) => {
    const rank = (label) => Number(!!label.minor) + (narrow && /\bft\b/i.test(label.text) ? 1 : 0);
    return rank(a) - rank(b);
  });
  const limit = narrow ? 4 : candidates.length;
  for (const label of candidates) {
    if (labels.length >= limit) break;
    const projected = projectPoint(mvp, label.position, width, height);
    const char = fontPx * 0.56;
    const half = Math.min(label.text.length * char * 0.5, narrow ? fontPx * 6 : fontPx * 8);
    const vy = fontPx * 0.55;
    const box = { left: projected.x - half - 2, right: projected.x + half + 2, top: projected.y - vy, bottom: projected.y + vy };
    if (box.left < 3 || box.right > width - 3 || box.top < 3 || box.bottom > height - 3) continue;
    if (labels.some(l => box.left < l.box.right && box.right > l.box.left && box.top < l.box.bottom && box.bottom > l.box.top)) continue;
    labels.push({ text: label.text, x: projected.x, y: projected.y, minor: !!label.minor, opacity, box });
  }
  return labels.map(({ box, ...label }) => label);
}

function createRenderer(canvas, options) {
  options = options || {};
  const gl = canvas.getContext('webgl', {
    alpha: false, antialias: false, depth: true, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: !!options.preserveDrawingBuffer, powerPreference: 'low-power',
  });
  if (!gl) throw new Error('The drawing context is unavailable.');
  const buffers = [], programs = [];
  let disposed = false;
  const stats = { drawCalls: 0, triangles: 0, lineSegments: 0, bufferBytes: 0, renderCount: 0, pixelRatio: 1 };

  function makeProgram(vertexSource, fragmentSource, attributes, uniforms) {
    const shaders = [];
    let program = null;
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error('A drawing shader could not be allocated.');
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('A drawing shader could not be compiled.');
      }
      program = gl.createProgram();
      if (!program) throw new Error('The drawing program could not be allocated.');
      for (const shader of shaders) gl.attachShader(program, shader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('The drawing program could not be linked.');
      programs.push(program);
      return {
        program,
        attributes: Object.fromEntries(attributes.map(name => [name, gl.getAttribLocation(program, name)])),
        uniforms: Object.fromEntries(uniforms.map(name => [name, gl.getUniformLocation(program, name)])),
      };
    } catch (error) {
      if (program && !programs.includes(program)) gl.deleteProgram(program);
      throw error;
    } finally {
      for (const shader of shaders) gl.deleteShader(shader);
    }
  }

  function upload(data, stride) {
    if (!data || data.length === 0) return null;
    if (!(data instanceof Float32Array) || data.length % stride !== 0) throw new Error('The drawing mesh is invalid.');
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('The drawing mesh could not be allocated.');
    buffers.push(buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    stats.bufferBytes += data.byteLength;
    return { buffer, count: data.length / stride };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const buffer of buffers) gl.deleteBuffer(buffer);
    for (const program of programs) gl.deleteProgram(program);
    buffers.length = programs.length = 0;
  }

  let model, meshes, solidProgram, lineProgram, shadowProgram, shadow;
  try {
    model = buildModel();
    solidProgram = makeProgram(SOLID_VERTEX, SOLID_FRAGMENT,
      ['aPosition', 'aNormal', 'aColor', 'aRole', 'aBaseY'], ['uMvp', 'uCut', 'uFocus', 'uLift', 'uOpacity']);
    lineProgram = makeProgram(LINE_VERTEX, LINE_FRAGMENT,
      ['aPosition', 'aColor', 'aRole', 'aBaseY'], ['uMvp', 'uCut', 'uFocus', 'uLift', 'uOpacity']);
    shadowProgram = makeProgram(SHADOW_VERTEX, SHADOW_FRAGMENT,
      ['aPosition'], ['uMvp', 'uPaper', 'uStrength']);
    meshes = model.groups.map(group => ({ id: group.id, solid: upload(group.solid, 11), lines: upload(group.lines, 8) }));
    // A single procedural contact-shadow surface; no shadow map or texture fetch.
    const [x0, z0, x1, z1] = [-6, -7, 83, 40];
    shadow = upload(new Float32Array([
      x0, -0.46, z0, x1, -0.46, z0, x1, -0.46, z1,
      x0, -0.46, z0, x1, -0.46, z1, x0, -0.46, z1,
    ]), 3);
    if (gl.getError() !== gl.NO_ERROR) throw new Error('The drawing buffers could not be initialized.');
  } catch (error) {
    dispose();
    throw error;
  }

  const maximumSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
  const viewportLimit = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  gl.clearColor(...PAPER, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE); // Thin roof and gable faces are intentionally two-sided.
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.lineWidth(1); // Portable on iOS and desktop; no unsupported thick GL lines.

  const enabledAttributes = new Set();
  function use(program) {
    for (const location of enabledAttributes) gl.disableVertexAttribArray(location);
    enabledAttributes.clear();
    gl.useProgram(program.program);
  }

  function attribute(program, name, size, stride, offset) {
    const location = program.attributes[name];
    if (location < 0) return;
    gl.enableVertexAttribArray(location);
    enabledAttributes.add(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride * 4, offset * 4);
  }

  function setOpacity(opacity) {
    if (opacity < 0.999) { gl.enable(gl.BLEND); gl.depthMask(false); }
    else { gl.disable(gl.BLEND); gl.depthMask(true); }
  }

  function render(progress, focusId, width, height, orbit, groupView) {
    if (disposed) throw new Error('The drawing has been disposed.');
    if (gl.isContextLost()) return null;
    const p = clamp(Number.isFinite(progress) ? progress : 0);
    const cssW = Math.max(1, Number.isFinite(width) ? width : canvas.clientWidth);
    const cssH = Math.max(1, Number.isFinite(height) ? height : canvas.clientHeight);
    const displayDpr = Math.max(1, globalThis.devicePixelRatio || 1);
    const dpr = Math.min(displayDpr, cssW < 600 ? 1.5 : 2,
      Math.sqrt(MAX_PIXELS / (cssW * cssH)),
      maximumSize / cssW, maximumSize / cssH,
      viewportLimit[0] / cssW, viewportLimit[1] / cssH);
    const bufferWidth = Math.max(1, Math.floor(cssW * dpr));
    const bufferHeight = Math.max(1, Math.floor(cssH * dpr));
    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
      canvas.width = bufferWidth;
      canvas.height = bufferHeight;
      gl.viewport(0, 0, bufferWidth, bufferHeight);
    }
    stats.pixelRatio = dpr;
    stats.drawCalls = stats.triangles = stats.lineSegments = 0;
    stats.renderCount++;
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const camera = cameraFor(p, cssW, cssH, model.bounds || DEFAULT_BOUNDS, orbit);
    const mvp = computeMVP(camera);
    function focusFor(id, groupId) {
      let role = 0, lift = 0;
      if (id === 'stairs') role = 1;
      else if (id === 'header') role = 2;
      else if (id === 'porch') role = 3;
      else if (id === 'balcony') role = 4;
      else if (id === 'bearing' || id === 'framing') role = 5;
      else if (id === 'partition') role = 6;
      else if (id === 'foundation' || id === 'footings') role = 7;
      else if (id === 'roof' && (groupId === 'roof' || groupId === 'garageRoof' || groupId === 'porchRoof')) lift = 1;
      else if (id === 'structure' && (groupId === 'upper' || groupId === 'upperfloor')) lift = 1;
      return { role, lift };
    }
    const states = groupView
      ? meshes.map(mesh => {
          const g = groupView[mesh.id] || { visible: false, cut: 0, opacity: 0 };
          return {
            visible: !!g.visible,
            cut: Number.isFinite(g.cut) ? g.cut : 100,
            opacity: Number.isFinite(g.opacity) ? g.opacity : 1,
          };
        })
      : meshes.map(mesh => groupState(mesh.id, p));

    use(shadowProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, shadow.buffer);
    attribute(shadowProgram, 'aPosition', 3, 3, 0);
    gl.uniformMatrix4fv(shadowProgram.uniforms.uMvp, false, mvp);
    gl.uniform3fv(shadowProgram.uniforms.uPaper, PAPER);
    gl.uniform1f(shadowProgram.uniforms.uStrength, mix(0.18, 0.05, smooth(0.28, 0.78, p)));
    gl.drawArrays(gl.TRIANGLES, 0, shadow.count);
    stats.drawCalls++;
    stats.triangles += 2;

    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);
    use(solidProgram);
    gl.uniformMatrix4fv(solidProgram.uniforms.uMvp, false, mvp);
    for (let i = 0; i < meshes.length; i++) {
      const { solid } = meshes[i], state = states[i];
      if (!solid || !state.visible || state.opacity < 0.001) continue;
      const mark = focusFor(focusId, meshes[i].id);
      gl.uniform1f(solidProgram.uniforms.uFocus, mark.role);
      gl.uniform1f(solidProgram.uniforms.uLift, mark.lift);
      setOpacity(state.opacity);
      gl.bindBuffer(gl.ARRAY_BUFFER, solid.buffer);
      attribute(solidProgram, 'aPosition', 3, 11, 0);
      attribute(solidProgram, 'aNormal', 3, 11, 3);
      attribute(solidProgram, 'aColor', 3, 11, 6);
      attribute(solidProgram, 'aRole', 1, 11, 9);
      attribute(solidProgram, 'aBaseY', 1, 11, 10);
      gl.uniform1f(solidProgram.uniforms.uCut, state.cut);
      gl.uniform1f(solidProgram.uniforms.uOpacity, state.opacity);
      gl.drawArrays(gl.TRIANGLES, 0, solid.count);
      stats.drawCalls++;
      stats.triangles += solid.count / 3;
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);

    // Edges follow every solid pass, so walls hide edges behind them correctly.
    use(lineProgram);
    gl.uniformMatrix4fv(lineProgram.uniforms.uMvp, false, mvp);
    for (let i = 0; i < meshes.length; i++) {
      const { lines } = meshes[i], state = states[i];
      if (!lines || !state.visible || state.opacity < 0.001) continue;
      const mark = focusFor(focusId, meshes[i].id);
      gl.uniform1f(lineProgram.uniforms.uFocus, mark.role);
      gl.uniform1f(lineProgram.uniforms.uLift, mark.lift);
      setOpacity(state.opacity);
      gl.bindBuffer(gl.ARRAY_BUFFER, lines.buffer);
      attribute(lineProgram, 'aPosition', 3, 8, 0);
      attribute(lineProgram, 'aColor', 3, 8, 3);
      attribute(lineProgram, 'aRole', 1, 8, 6);
      attribute(lineProgram, 'aBaseY', 1, 8, 7);
      gl.uniform1f(lineProgram.uniforms.uCut, state.cut);
      gl.uniform1f(lineProgram.uniforms.uOpacity, state.opacity);
      gl.drawArrays(gl.LINES, 0, lines.count);
      stats.drawCalls++;
      stats.lineSegments += lines.count / 2;
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    return { labels: labelsFor(model, p, mvp, cssW, cssH), stageIndex: stageAt(p) };
  }

  return { render, dispose, stats };
}

  var STAGES = [
    { id: "house", end: 0.16, line: "The finished house. Tap it, then drag to turn it." },
    { id: "front", end: 0.32, line: "The front: board-and-batten gable, dormer, porch, and the two-car garage." },
    { id: "roof", end: 0.48, line: "The roof lifts off. Hip, gable, dormer, and the lower garage roof." },
    { id: "upper", end: 0.66, line: "The upper floor: primary suite, two bedrooms, laundry, and the stair." },
    { id: "plan", end: 0.84, line: "The main floor, cut flat and seen from above." },
    { id: "foundation", end: 2, line: "The foundation, the slab the frame stands on." }
  ];

  function mount() {
    var root = document.getElementById("scroll-house");
    if (!root || root.getAttribute("data-ready") === "1") return;
    root.setAttribute("data-ready", "1");
    var track = root.querySelector(".scroll-house-track");
    var sticky = root.querySelector(".scroll-house-sticky");
    var sheet = root.querySelector(".scroll-house-sheet");
    var canvas = root.querySelector(".scroll-house-canvas");
    var labelsEl = root.querySelector(".sh-labels");
    var lineEl = root.querySelector("#scroll-house-line");
    var bar = root.querySelector(".sh-progress span");
    var range = root.querySelector(".sh-scrub");
    var stageNodes = root.querySelectorAll(".sh-stages button");
    var learnSets = root.querySelectorAll(".sh-learn-set");
    var learnNotes = root.querySelectorAll(".sh-note");
    var learnPrompt = root.querySelector(".sh-learn-prompt");
    var callButtons = root.querySelectorAll(".sh-call");
    var exploreBar = root.querySelector(".sh-explore");
    var exploreToggle = root.querySelector(".sh-explore-toggle");
    var exploreReset = root.querySelector(".sh-explore-reset");
    var zoomIn = root.querySelector("[data-zoom='in']");
    var zoomOut = root.querySelector("[data-zoom='out']");
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    var removers = [];
    var labelNodes = [];
    var pointers = new Map();
    var engine = null;
    var focusId = "";
    var current = "";
    var rendered = 0;
    var lastTime = 0;
    var raf = 0;
    var running = false;
    var dirty = true;
    var lost = false;
    var disposed = false;
    var explore = false;
    var exploreDismissed = false;
    var exploreDismissedAt = "";
    var yaw = 0;
    var pitch = 0;
    var zoom = 1;
    var dragging = false;
    var pinchStart = 0;
    var zoomAtPinch = 1;
    var lastInteract = (typeof performance !== "undefined" ? performance.now() : 0);
    var ZOOM_MIN = 0.55;
    var ZOOM_MAX = 2.4;

    function on(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      removers.push(function () { target.removeEventListener(type, handler, options); });
    }

    function stageByProgress(p) {
      var i;
      for (i = 0; i < STAGES.length; i++) if (p < STAGES[i].end) return STAGES[i];
      return STAGES[STAGES.length - 1];
    }

    function stickyTop() {
      var raw = window.getComputedStyle(sticky).top;
      if (!raw || raw === "auto") return 0;
      return parseFloat(raw) || 0;
    }

    var manual = null;
    var fitted = false;

    function contentFits() {
      if (window.matchMedia("(max-height: 520px)").matches) return false;
      var rootFont = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      if (rootFont > 20) return false;
      var wasEnhanced = root.classList.contains("is-enhanced");
      root.classList.remove("is-enhanced");
      var natural = sticky.scrollHeight;
      if (wasEnhanced) root.classList.add("is-enhanced");
      return natural <= window.innerHeight - 8;
    }

    function syncFlow() {
      if (reduced.matches || lost) {
        root.classList.remove("is-enhanced");
        root.classList.add("is-flow");
        return;
      }
      var fits = contentFits();
      root.classList.toggle("is-enhanced", fits);
      root.classList.toggle("is-flow", !fits);
      if (fits) manual = null;
    }

    function scrollProgress() {
      if (!root.classList.contains("is-enhanced")) return manual == null ? 0 : manual;
      var rect = track.getBoundingClientRect();
      var travel = track.offsetHeight - sticky.offsetHeight;
      if (travel <= 1) return manual == null ? 0 : manual;
      var scrolled = stickyTop() - rect.top;
      if (scrolled <= 0) return 0;
      if (scrolled >= travel) return 1;
      return scrolled / travel;
    }

    function paintStill(p) {
      if (disposed || lost) return;
      if (!engine) {
        try { engine = createRenderer(canvas); }
        catch (e) { fail(); return; }
      }
      rendered = Math.max(0, Math.min(1, p));
      try {
        paint(rendered);
        dirty = false;
      } catch (error) {
        fail();
      }
    }

    function scrollToProgress(p) {
      p = Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0));
      if (reduced.matches) {
        manual = p;
        paintStill(p);
        return;
      }
      if (!root.classList.contains("is-enhanced")) {
        manual = p;
        dirty = true;
        kick();
        return;
      }
      var rect = track.getBoundingClientRect();
      var travel = Math.max(1, track.offsetHeight - sticky.offsetHeight);
      var y = window.scrollY + rect.top - stickyTop() + travel * p;
      window.scrollTo({ top: y, behavior: "instant" });
      dirty = true;
      kick();
    }

    function applyFocus(id) {
      focusId = id || "";
      var i;
      for (i = 0; i < callButtons.length; i++) {
        var onNote = callButtons[i].getAttribute("data-callout") === focusId && focusId !== "";
        callButtons[i].setAttribute("aria-pressed", onNote ? "true" : "false");
        callButtons[i].classList.toggle("is-on", onNote);
      }
      for (i = 0; i < learnNotes.length; i++) {
        learnNotes[i].classList.toggle("is-open", learnNotes[i].getAttribute("data-callout") === focusId && focusId !== "");
      }
      if (learnPrompt) learnPrompt.classList.toggle("is-hidden", focusId !== "");
      dirty = true;
    }

    function focusBelongs(stageId) {
      var s, b;
      if (!focusId) return true;
      for (s = 0; s < learnSets.length; s++) {
        if (learnSets[s].getAttribute("data-stage") !== stageId) continue;
        var buttons = learnSets[s].querySelectorAll(".sh-call");
        for (b = 0; b < buttons.length; b++) {
          if (buttons[b].getAttribute("data-callout") === focusId) return true;
        }
      }
      return false;
    }

    function showStageSet(stageId) {
      var i;
      for (i = 0; i < learnSets.length; i++) learnSets[i].hidden = learnSets[i].getAttribute("data-stage") !== stageId;
      if (!focusBelongs(stageId)) applyFocus("");
    }

    function orbitArgs() {
      if (!explore) return null;
      return { yaw: yaw, pitch: pitch, zoom: zoom };
    }

    function clampOrbit(p) {
      var pose = scrollPose(p);
      var angle = pose.angle + pitch;
      var minAngle = 0.02;
      var maxAngle = 78 * Math.PI / 180;
      if (angle < minAngle) pitch += minAngle - angle;
      else if (angle > maxAngle) pitch -= angle - maxAngle;
      if (zoom < ZOOM_MIN) zoom = ZOOM_MIN;
      if (zoom > ZOOM_MAX) zoom = ZOOM_MAX;
    }

    function markInteract() {
      lastInteract = typeof performance !== "undefined" ? performance.now() : 0;
    }

    function setExplore(on) {
      var stageId = current || stageByProgress(rendered).id;
      if (on && stageId !== "house") return;
      explore = !!on;
      if (!explore) dragging = false;
      root.classList.toggle("is-explore", explore);
      if (exploreToggle) {
        exploreToggle.setAttribute("aria-pressed", explore ? "true" : "false");
        exploreToggle.classList.toggle("is-on", explore);
      }
      if (exploreReset) exploreReset.hidden = !explore;
      if (zoomIn) zoomIn.hidden = !explore;
      if (zoomOut) zoomOut.hidden = !explore;
      if (canvas) {
        canvas.setAttribute("aria-pressed", explore ? "true" : "false");
        canvas.style.touchAction = explore ? "none" : "pan-y pinch-zoom";
      }
      dirty = true;
      kick();
    }

    function updateExploreChrome(stageId) {
      var allowed = stageId === "house";
      if (exploreBar) exploreBar.hidden = !allowed;
      if (!allowed) {
        if (explore) setExplore(false);
        return;
      }
    }

    function resetOrbit() {
      yaw = 0;
      pitch = 0;
      zoom = 1;
      markInteract();
      dirty = true;
      kick();
    }

    function nudgeYaw(delta) {
      yaw += delta;
      markInteract();
      dirty = true;
      kick();
    }

    function nudgePitch(delta) {
      pitch += delta;
      clampOrbit(rendered);
      markInteract();
      dirty = true;
      kick();
    }

    function nudgeZoom(factor) {
      zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * factor));
      markInteract();
      dirty = true;
      kick();
    }

    function pointerDistance() {
      var pts = [];
      pointers.forEach(function (pt) { pts.push(pt); });
      if (pts.length < 2) return 0;
      var dx = pts[0].x - pts[1].x;
      var dy = pts[0].y - pts[1].y;
      return Math.hypot(dx, dy);
    }

    function renderLabels(labels, width, height) {
      var accepted = labels || [];
      var i, node, item;
      for (i = 0; i < accepted.length; i++) {
        item = accepted[i];
        node = labelNodes[i];
        if (!node) {
          node = document.createElement("span");
          node.className = "sh-label";
          labelsEl.appendChild(node);
          labelNodes.push(node);
        }
        node.hidden = false;
        node.classList.toggle("is-dim", !!item.minor || /\bft\b/i.test(item.text));
        if (node.textContent !== item.text) node.textContent = item.text;
        node.style.left = item.x.toFixed(1) + "px";
        node.style.top = item.y.toFixed(1) + "px";
        node.style.opacity = String(item.opacity);
      }
      for (i = accepted.length; i < labelNodes.length; i++) labelNodes[i].hidden = true;
      root.classList.toggle("is-plan", rendered >= 0.68 && rendered <= 0.84 && accepted.length > 0);
      root.classList.toggle("is-upper-labels", rendered >= 0.50 && rendered < 0.67 && accepted.length > 0);
    }

    function paint(p) {
      if (!engine || lost) return;
      var rect = sheet.getBoundingClientRect();
      var result = engine.render(p, focusId, Math.max(1, rect.width), Math.max(1, rect.height), orbitArgs());
      if (!result) { fail(); return; }
      renderLabels(result.labels);
      var narrowLabels = rect.width < 640;
      var roomNodes = root.querySelectorAll(".sh-rooms");
      for (var r = 0; r < roomNodes.length; r++) {
        var which = roomNodes[r].getAttribute("data-rooms");
        var showRooms = narrowLabels && ((which === "main" && p >= 0.68 && p <= 0.84) || (which === "upper" && p >= 0.50 && p < 0.67));
        roomNodes[r].hidden = !showRooms;
      }
      if (bar) bar.style.transform = "scaleX(" + p.toFixed(5) + ")";
      if (range && document.activeElement !== range) {
        range.value = String(Math.round(p * 1000));
        var stageName = stageByProgress(p).id;
        range.setAttribute("aria-valuetext", stageName + ", " + Math.round(p * 100) + " percent");
      }
      root.classList.toggle("is-scrolled", p > 0.04);
      root.classList.toggle("is-late", p > 0.8);
      root.classList.add("is-drawn");
      if (!fitted) { fitted = true; syncFlow(); }
      var stage = stageByProgress(p);
      if (stage.id !== current) {
        current = stage.id;
        if (lineEl) lineEl.textContent = stage.line;
        var n;
        for (n = 0; n < stageNodes.length; n++) {
          var on = stageNodes[n].getAttribute("data-stage") === stage.id;
          var item = stageNodes[n].parentElement;
          if (item) item.classList.toggle("is-on", on);
          if (on) stageNodes[n].setAttribute("aria-current", "step");
          else stageNodes[n].removeAttribute("aria-current");
        }
        showStageSet(stage.id);
      }
      updateExploreChrome(stage.id);
    }

    function kick() {
      if (disposed || lost || !running || raf) return;
      raf = window.requestAnimationFrame(draw);
    }

    function draw(now) {
      raf = 0;
      if (disposed || lost || !running || !engine || document.hidden) return;
      var target = scrollProgress();
      var dt = lastTime ? Math.min(64, Math.max(1, now - lastTime)) : 16;
      lastTime = now;
      var diff = target - rendered;
      if (Math.abs(diff) < 0.0004) rendered = target;
      else rendered += diff * (1 - Math.exp(-dt / 70));
      var moving = Math.abs(target - rendered) >= 0.0004;
      var stageNow = stageByProgress(Math.abs(target - rendered) < 0.0004 ? target : rendered);
      var idleFor = (typeof performance !== "undefined" ? performance.now() : 0) - lastInteract;
      var spinning = explore && !reduced.matches && !dragging && pointers.size === 0 &&
        stageNow.id === "house" && rendered < 0.14 && idleFor > 1600 && !moving;
      if (spinning) {
        yaw += (dt / 1000) * 0.22;
        dirty = true;
      }
      if (moving || dirty) {
        try {
          paint(rendered);
          dirty = false;
        } catch (error) {
          fail();
          return;
        }
      }
      if (moving || spinning) raf = window.requestAnimationFrame(draw);
      else lastTime = 0;
    }

    function destroyEngine() {
      if (!engine) return;
      try { engine.dispose(); } catch (e) { /* context may already be gone */ }
      engine = null;
    }

    function fail() {
      lost = true;
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      destroyEngine();
      root.classList.add("is-fallback");
      root.classList.remove("is-drawn");
    }

    function start() {
      if (disposed || lost || reduced.matches) return;
      root.classList.remove("is-still");
      if (!engine) {
        try { engine = createRenderer(canvas); }
        catch (e) { fail(); return; }
      }
      rendered = scrollProgress();
      dirty = true;
      running = true;
      kick();
    }

    function stop() {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      lastTime = 0;
    }

    function destroy() {
      if (disposed) return;
      disposed = true;
      stop();
      destroyEngine();
      removers.forEach(function (fn) { fn(); });
    }

    on(root, "click", function (event) {
      var btn = event.target && event.target.closest ? event.target.closest(".sh-call") : null;
      if (btn && root.contains(btn)) {
        var id = btn.getAttribute("data-callout");
        applyFocus(focusId === id ? "" : id);
        kick();
        return;
      }
      var stageButton = event.target && event.target.closest ? event.target.closest(".sh-stages button") : null;
      if (stageButton && root.contains(stageButton)) scrollToProgress(parseFloat(stageButton.getAttribute("data-sh-progress")) || 0);
    });
    on(root, "keydown", function (event) {
      var stageButton = event.target && event.target.closest ? event.target.closest(".sh-stages button") : null;
      if (!stageButton || !root.contains(stageButton)) return;
      var items = Array.prototype.slice.call(stageNodes);
      var index = items.indexOf(stageButton);
      var next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        next = items[Math.min(items.length - 1, index + 1)];
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        next = items[Math.max(0, index - 1)];
      }
      if (next) {
        next.focus();
        scrollToProgress(parseFloat(next.getAttribute("data-sh-progress")) || 0);
      }
    });
    if (range) {
      on(range, "input", function () { scrollToProgress(Number(range.value) / 1000); });
    }
    if (exploreToggle) {
      on(exploreToggle, "click", function () {
        var next = !explore;
        exploreDismissed = !next;
        exploreDismissedAt = next ? "" : (current || stageByProgress(rendered).id);
        markInteract();
        setExplore(next);
      });
    }
    if (exploreReset) {
      on(exploreReset, "click", function () {
        resetOrbit();
      });
    }
    if (zoomIn) on(zoomIn, "click", function () { nudgeZoom(1 / 1.12); });
    if (zoomOut) on(zoomOut, "click", function () { nudgeZoom(1.12); });
    on(canvas, "keydown", function (event) {
      if (stageByProgress(rendered).id !== "house") return;
      var handled = true;
      if (event.key === "ArrowLeft") nudgeYaw(0.14);
      else if (event.key === "ArrowRight") nudgeYaw(-0.14);
      else if (event.key === "ArrowUp") nudgePitch(-0.08);
      else if (event.key === "ArrowDown") nudgePitch(0.08);
      else if (event.key === "+" || event.key === "=") nudgeZoom(1 / 1.12);
      else if (event.key === "-" || event.key === "_") nudgeZoom(1.12);
      else handled = false;
      if (!handled) return;
      event.preventDefault();
      if (!explore) {
        exploreDismissed = false;
        setExplore(true);
      }
    });
    on(canvas, "click", function () {
      if (explore) return;
      if ((current || stageByProgress(rendered).id) !== "house") return;
      exploreDismissed = false;
      exploreDismissedAt = "";
      setExplore(true);
    });
    on(sheet, "wheel", function (event) {
      if (!explore || (!event.ctrlKey && !event.metaKey)) return;
      if (exploreBar && exploreBar.contains(event.target)) return;
      event.preventDefault();
      nudgeZoom(Math.exp(event.deltaY * 0.0011));
    }, { passive: false });
    var orbitPointer = null;
    function rememberPointer(event) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    function beginOrbit(event) {
      orbitPointer = event.pointerId;
      rememberPointer(event);
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(event.pointerId); } catch (e) { /* already released */ }
      }
      dragging = true;
      root.classList.add("is-dragging");
      markInteract();
    }
    on(canvas, "pointerdown", function (event) {
      if (!explore) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (exploreBar && exploreBar.contains(event.target)) return;
      var origin = { id: event.pointerId, x: event.clientX, y: event.clientY, type: event.pointerType };
      pointers.set(event.pointerId, origin);
      if (pointers.size >= 2) {
        pinchStart = pointerDistance();
        zoomAtPinch = zoom;
        dragging = true;
        root.classList.add("is-dragging");
        markInteract();
        return;
      }
      if (orbitPointer !== null) return;
      if (event.pointerType === "mouse" || event.pointerType === "pen") beginOrbit(event);
    });
    on(canvas, "pointermove", function (event) {
      var tracked = pointers.get(event.pointerId);
      if (!tracked) return;
      if (explore && pointers.size >= 2) {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: tracked.type });
        var dist = pointerDistance();
        if (pinchStart > 0 && dist > 0) {
          zoom = zoomAtPinch * (dist / pinchStart);
          if (zoom < ZOOM_MIN) zoom = ZOOM_MIN;
          if (zoom > ZOOM_MAX) zoom = ZOOM_MAX;
          markInteract();
          dirty = true;
          kick();
        }
        return;
      }
      if (orbitPointer === null) {
        var dx = event.clientX - tracked.x;
        var dy = event.clientY - tracked.y;
        var adx = Math.abs(dx);
        var ady = Math.abs(dy);
        if (adx < 10 && ady < 10) return;
        if (explore || adx > ady) {
          beginOrbit(event);
          tracked = pointers.get(event.pointerId);
        } else {
          pointers.delete(event.pointerId);
          return;
        }
      }
      if (orbitPointer !== event.pointerId || !tracked) return;
      var prev = { x: tracked.x, y: tracked.y };
      rememberPointer(event);
      nudgeYaw(-(event.clientX - prev.x) * 0.0075);
      pitch -= (event.clientY - prev.y) * 0.0045;
      clampOrbit(rendered);
      dirty = true;
      kick();
    });
    function releasePointer(event) {
      if (!event || pointers.has(event.pointerId) || orbitPointer === event.pointerId) {
        if (event) pointers.delete(event.pointerId);
        if (!event || orbitPointer === event.pointerId) orbitPointer = null;
      }
      if (pointers.size < 2) pinchStart = 0;
      if (pointers.size === 0 || orbitPointer === null) {
        dragging = false;
        root.classList.remove("is-dragging");
        markInteract();
      }
    }
    on(canvas, "pointerup", releasePointer);
    on(canvas, "pointercancel", releasePointer);
    on(canvas, "lostpointercapture", releasePointer);
    on(window, "scroll", function () { markInteract(); dirty = true; kick(); }, { passive: true });
    on(window, "resize", function () { fitted = false; dirty = true; kick(); }, { passive: true });
    on(window, "orientationchange", function () { fitted = false; dirty = true; kick(); }, { passive: true });
    on(document, "visibilitychange", function () {
      if (document.hidden) {
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
        lastTime = 0;
      } else kick();
    });
    on(canvas, "webglcontextlost", function (event) {
      event.preventDefault();
      fail();
    });
    on(canvas, "webglcontextrestored", function () {
      if (disposed || reduced.matches) return;
      lost = false;
      root.classList.remove("is-fallback");
      destroyEngine();
      start();
    });
    if (reduced.addEventListener) on(reduced, "change", function () {
      syncFlow();
      if (reduced.matches) {
        root.classList.add("is-still");
        stop();
        destroyEngine();
      } else {
        lost = false;
        root.classList.remove("is-still", "is-fallback");
        start();
      }
    });
    on(window, "pagehide", destroy);
    if (window.ResizeObserver) {
      var resizeObserver = new ResizeObserver(function () { dirty = true; kick(); });
      resizeObserver.observe(sheet);
      removers.push(function () { resizeObserver.disconnect(); });
    }
    if (window.IntersectionObserver) {
      var visibleObserver = new IntersectionObserver(function (entries) {
        running = !lost && !reduced.matches && entries.some(function (entry) { return entry.isIntersecting; });
        if (running) { dirty = true; kick(); }
        else if (raf) { window.cancelAnimationFrame(raf); raf = 0; lastTime = 0; }
      });
      visibleObserver.observe(sheet);
      removers.push(function () { visibleObserver.disconnect(); });
    } else {
      running = true;
    }
    syncFlow();
    if (!reduced.matches) start();
    else root.classList.add("is-still");
  }

  function openViewer(canvas) {
    var engine = createRenderer(canvas, { preserveDrawingBuffer: true });
    return {
      draw: function (spec) {
        spec = spec || {};
        var w = spec.width || canvas.clientWidth || 320;
        var h = spec.height || canvas.clientHeight || 180;
        return engine.render(spec.progress || 0, spec.focus || "", w, h, spec.orbit || null, spec.groups || null);
      },
      dispose: function () { engine.dispose(); }
    };
  }

  return {
    mount: mount,
    buildModel: buildModel,
    cameraFor: cameraFor,
    computeMVP: computeMVP,
    projectPoint: projectPoint,
    groupState: groupState,
    stageAt: stageAt,
    openViewer: openViewer,
    STAGES: STAGES,
    PAPER: PAPER
  };
});
