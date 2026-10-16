/* Magnolia showcase copy of the homepage "house, taken apart" drawing.
   Same renderer, camera, stages and controls as /assets/js/scroll-house.js;
   only the model (buildModel), cut heights, shadow footprint, focus roles
   and stage lines are changed for this house, ADU and garage.
   Original header follows.
   Original line-drawing house for this page.
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
/** Teaching model of the Magnolia project: one-story house over a daylight basement
 * (new ADU in the basement) plus a detached one-car garage. Built from the permit sets
 * (sheets A100, A202, A203, A300, A301, garage A200). Units are approximate feet.
 * Printed: main level 75'-0" wide, west wall 49'-0", ADU 32'-0" wide, main level to
 * plate 8'-6", basement 8'-6" below main, garage 12'-0" x 20'-0" inside, 12'-0" high,
 * roofs are standing seam metal. Everything else is scaled by eye from the sheets.
 * X runs left to right on the plan sheet; Z runs from sheet top (deck side) to sheet
 * bottom (Constance Dr W side); Y is up. Basement floor is Y 0; main level is Y 8.5.
 */
const WALL = [0.985,0.982,0.972], FLOOR = [0.965,0.962,0.95];
// Colors follow the project photos: black standing seam roof and fascia, white
// vertical siding, black-framed glass, black rails. The garage is not in the photos,
// so it keeps the neutral sketch roof.
const ROOF = [0.22,0.23,0.24], GLASS = [0.46,0.52,0.55];
const SKETCH_ROOF = [0.90,0.905,0.898], FRAME = [0.13,0.135,0.14], FASCIA = [0.16,0.165,0.17];
const INK = [0.12,0.13,0.13], DETAIL = [0.42,0.44,0.43];
const FURN = [0.93,0.932,0.922], PLANT = [0.80,0.84,0.74];
const EARTH = [0.915,0.918,0.895];
const MAIN = 8.5, PLATE = 17.5, ROOF_HI = 22.4, ROOF_Z0 = -1.8, ROOF_PITCH = 1/12;
const roofY = z => ROOF_HI - (z - ROOF_Z0) * ROOF_PITCH;
// Garage: interior 12'x20' drawn as a 12.5'x20.5' shell; 3/12 shed, high at the door.
// Placed per the garage set's site plan A100: at the Constance Dr W lot line, right side.
const G = { x0:58, x1:70.5, z0:56.3, z1:76.8, floor:8.5, low:15.5, high:20.5 };
// Lot per the ADU set's site plan A100: 85.00 ft by 110.0 ft (9,350 SF), sides 5'-0" from the house.
const LOT = { x0:-4.7, x1:80.3, z0:-32.7, z1:77.3 };
const gRoofY = z => G.low + (z - (G.z0 - 1)) * ((G.high - G.low) / (G.z1 - G.z0 + 2));
function buildModel() {
  const groups = [], labels = [];
  const group = id => { const g = {id,solid:[],lines:[]}; groups.push(g); return g; };
  const site=group('site'), lower=group('lower'), slab=group('upperfloor');
  const upper=group('upper'), roofs=group('roof'), garageRoof=group('garageRoof');
  const porchRoof=group('porchRoof'), finish=group('finish'), garage=group('garage');
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
    const body = exterior ? (bodyRole===8 ? 8 : 5) : bodyRole;
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
          rect(lo-.12,lo+.12,bot-.14,top+.14,FRAME);rect(hi-.12,hi+.12,bot-.14,top+.14,FRAME);
          rect(lo,hi,bot-.14,bot+.06,FRAME);rect(lo,hi,top-.06,top+.14,FRAME);
          if(h[4]!=='door' && top-bot<5)rect(lo,hi,(bot+top)/2-.05,(bot+top)/2+.05,FRAME);
          for(let m=lo+3;m<hi-1;m+=3) rect(m-.07,m+.07,bot,top,FRAME);
        } else {
          for(let yy=h[2]+1;yy<h[3];yy+=1.25) {
            const p=axis==='x'?[[lo,yy,f+sign*.06],[hi,yy,f+sign*.06]]:[[f+sign*.06,yy,lo],[f+sign*.06,yy,hi]];
            line(finish,...p,DETAIL);
          }
          for(let xx=lo+.5;xx<hi-1;xx+=2.5)rect(xx,Math.min(xx+2,hi-.3),h[3]-1.35,h[3]-.5,GLASS);
        }
      }
    }
    segment(cursor,b,y0,y1);
    if(exterior) {
      // White vertical siding: one stroke per board, broken at every opening.
      for(let u=a+.75;u<b-.1;u+=.75) {
        let bottom=y0;
        for(const h of [...sorted].sort((p,q)=>p[2]-q[2])) {
          if(u<h[0]-.13||u>h[1]+.13)continue;
          vstroke(u,bottom,Math.max(bottom,h[2]-.16));bottom=Math.max(bottom,h[3]+.16);
        }
        vstroke(u,bottom,y1);
      }
    }
    function vstroke(u,lo,hi) {
      if(hi<=lo)return;const f=fixed+sign*(t/2+.015);
      line(finish,axis==='x'?[u,lo,f]:[f,lo,u],axis==='x'?[u,hi,f]:[f,hi,u],DETAIL);
    }
    function stroke(u,v,y) {
      if(v<=u)return;const f=fixed+sign*(t/2+.015);
      line(finish,axis==='x'?[u,y,f]:[f,y,u],axis==='x'?[v,y,f]:[f,y,v],DETAIL);
    }
  }
  const windowAt=(at,w,y=0)=>[at-w/2,at+w/2,y+2.7,y+7.2,'window'];
  const tallAt=(at,w,y=0)=>[at-w/2,at+w/2,y+.3,y+7.2,'window'];
  const doorAt=(at,w=3,y=0)=>[at-w/2,at+w/2,y,y+6.9,'door'];
  function partition(g,axis,f,a,b,y,holes=[],h=8.5,role=6) {wall(g,axis,f,a,b,y,y+h,holes,false,1,.3,role);}
  function outline(g,points,y,color=DETAIL) {for(let i=0;i<points.length;i++) line(g,[points[i][0],y,points[i][1]],[points[(i+1)%points.length][0],y,points[(i+1)%points.length][1]],color);}
  function planLabel(text,x,z,minor=false,floor='main',y=.25) {labels.push({text,position:[x,y,z],minor,floor});}
  function inside(poly,x,z) {
    let c=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
      const [xi,zi]=poly[i],[xj,zj]=poly[j];
      if((zi>z)!==(zj>z) && x<(xj-xi)*(z-zi)/(zj-zi)+xi) c=!c;
    }
    return c;
  }
  // Ring of walls around a polygon. holes[i] belongs to edge i (poly[i] to poly[i+1]).
  function ring(g,poly,y0,y1,holes,exterior,role=0) {
    for(let i=0;i<poly.length;i++) {
      const [ax,az]=poly[i],[bx,bz]=poly[(i+1)%poly.length];
      const axis = az===bz ? 'x' : 'z';
      const fixed = axis==='x' ? az : ax;
      const a = axis==='x' ? Math.min(ax,bx) : Math.min(az,bz);
      const b = axis==='x' ? Math.max(ax,bx) : Math.max(az,bz);
      const mid=(a+b)/2, probe = axis==='x' ? inside(poly,mid,fixed+.3) : inside(poly,fixed+.3,mid);
      const sign = probe ? -1 : 1;
      if(holes && holes[i]===null) continue;
      const ext = typeof exterior==='function' ? exterior(i) : exterior;
      wall(g,axis,fixed,a,b,y0,y1,(holes&&holes[i])||[],ext,sign,.5,role);
    }
  }
  // Main level outline, from A202 (75'-0" across, 49'-0" west wall; jogs scaled).
  // Outline traced from the ADU set's site plan A100 (lot 85.00 ft wide sets the scale;
// 75 ft overall and the 49 ft west wall match A202). Jogs are approximate (about +-1 ft).
  const P=[[0,6],[32.3,6],[32.3,13.5],[50.3,13.5],[50.3,7.7],[55.3,7.7],[55.3,-.3],[75.3,-.3],
           [75.3,41],[62,41],[62,42.7],[49,42.7],[49,38.5],[32.3,38.5],[32.3,55.7],[0,55.7]];
  // Plan rectangles that tile P (used for slabs and the crawl space).
  const TILES=[[0,32.3,6,55.7],[32.3,49,13.5,38.5],[49,62,13.5,42.7],[62,75.3,13.5,41],[50.3,75.3,7.7,13.5],[55.3,75.3,-.3,7.7]];
  // ---- Site, from the ADU and garage site plans (A100) and the survey sheet.
  // Grade: the lot falls toward Magnolia Blvd W, so the basement daylights on that side.
  // The raised block on the Constance Dr W side stands in for grade at the main level.
  // Slope heights are not printed; the hatch shows direction only.
  const SITE_LINE=[.55,.57,.55], TREE=[.52,.60,.48];
  for(const [x0,x1,z0] of [[LOT.x0,32.55,55.95],[32.55,48.75,38.75],[48.75,62.25,42.95],[62.25,LOT.x1,41.25]])
    box(site,x0,0,z0,x1,MAIN-.2,LOT.z1,EARTH,0);
  box(site,-14,-.3,-47,95,0,LOT.z1,[.93,.935,.91],7,false);
  // Constance Dr W: street at the upper grade along the bottom lot line.
  box(site,-14,0,LOT.z1,95,MAIN-.2,100,[.9,.9,.885],0);
  for(const z of [LOT.z1+5,LOT.z1+6,LOT.z1+20])line(site,[-14,MAIN-.18,z],[95,MAIN-.18,z],SITE_LINE);
  for(let x=-12;x<94;x+=8)line(site,[x,MAIN-.18,LOT.z1+13],[x+4,MAIN-.18,LOT.z1+13],SITE_LINE);
  // Magnolia Blvd W beyond the bluff at the top of the lot.
  box(site,-14,-.3,-64,95,-.02,-47,[.9,.9,.885],0,false);
  for(const z of [-47,-49,-64])line(site,[-14,0,z],[95,0,z],SITE_LINE);
  for(let x=-12;x<94;x+=8)line(site,[x,0,-55.5],[x+4,0,-55.5],SITE_LINE);
  // Property line, dashed.
  const dash=(a,b)=>{const L=Math.hypot(b[0]-a[0],b[2]-a[2]);for(let t=0;t<L;t+=3){const t1=Math.min(L,t+1.8);line(site,a.map((v,i)=>v+(b[i]-v)*t/L),a.map((v,i)=>v+(b[i]-v)*t1/L),INK);}};
  const ly=z=>z>55?MAIN-.15:.04;
  dash([LOT.x0,.04,LOT.z0],[LOT.x1,.04,LOT.z0]);
  dash([LOT.x0,ly(LOT.z1),LOT.z1],[LOT.x1,ly(LOT.z1),LOT.z1]);
  // Side lines climb where the grade block starts on each side.
  for(const [x,zs] of [[LOT.x0,55.95],[LOT.x1,41.25]]){dash([x,.04,LOT.z0],[x,.04,zs-.25]);line(site,[x,.04,zs-.25],[x,MAIN-.15,zs],INK);dash([x,MAIN-.15,zs],[x,MAIN-.15,LOT.z1]);}
  // Existing block walls / rockery on the bluff (heavy lines on the site plan).
  for(const pts of [[[-4.5,-27],[3,-27.5],[11,-26]],[[31,-45],[33,-38],[38,-39],[44,-36]],[[52,-38],[58,-35],[66,-34],[71,-39],[76,-33]]])
    for(let i=0;i<pts.length-1;i++) box(site,Math.min(pts[i][0],pts[i+1][0])-.2,0,Math.min(pts[i][1],pts[i+1][1])-.2,Math.max(pts[i][0],pts[i+1][0])+.2,1.4,Math.max(pts[i][1],pts[i+1][1])+.2,WALL,0);
  // Slope hatch between the lot line and the deck, pointing downhill.
  for(let x=-2;x<79;x+=4.5) for(const z of [-22,-12]) {line(site,[x,.05,z],[x,.05,z-4],SITE_LINE);line(site,[x,.05,z-4],[x-.7,.05,z-2.8],SITE_LINE);line(site,[x,.05,z-4],[x+.7,.05,z-2.8],SITE_LINE);}
  // Contour-like lines traced loosely from the survey.
  for(const zc of [-30,-17,-6]) {const pts=[];for(let x=-4;x<=80;x+=4)pts.push([x,.05,zc+Math.sin(x*.13+zc)*1.6]);for(let i=0;i<pts.length-1;i++)line(site,pts[i],pts[i+1],SITE_LINE);}
  // Trees shown on the site plan (positions scaled by eye). Crown outlines, not sized by species.
  function tree(x,z,r,y=0){const pts=[];for(let i=0;i<14;i++){const a=i/14*Math.PI*2;pts.push([x+Math.cos(a)*r,y+.06,z+Math.sin(a)*r]);}
    for(let i=0;i<14;i++)line(site,pts[i],pts[(i+1)%14],TREE);
    for(let i=0;i<5;i++){const a=i/5*Math.PI*2;line(site,[x,y+.06,z],[x+Math.cos(a)*r*.6,y+.06,z+Math.sin(a)*r*.6],TREE);}}
  tree(20,-38,4);tree(36,-27,4.5);tree(67,-24,3.5);tree(33,-58,3);tree(42,-59,3);tree(64,-58,3.5);tree(6,72,3.5,MAIN-.2);
  // Driveway to the garage door.
  box(site,G.x0+.8,MAIN-.2,G.z1,G.x1-.8,MAIN-.12,LOT.z1+5,FLOOR,0);
  // ---- Basement (lower). Deck-side walls daylight; the rest are foundation walls.
  // Daylight faces (edges 1-6) get siding and openings; the rest are buried foundation walls.
  ring(lower,P,0,MAIN,[
    null, [], [windowAt(41,4)], [], [], [], [windowAt(60,3),windowAt(70,3)]
  ],i=>i>=1&&i<=6,7);
  // The ADU's daylight face is its own wall (role 8) so the ADU callout can mark it.
  wall(lower,'x',6,0,32.3,0,MAIN,[doorAt(9,6),doorAt(20,3),windowAt(27,5)],true,-1,.5,8);
  // ADU 865 SF (A202 of the ADU set): 32'-0" wide at the deck side.
  box(lower,0.25,.02,6.25,32,.06,33,[.94,.945,.955],8,false);
  partition(lower,'x',33,0,32,0,[doorAt(26,3)],MAIN,8);
  partition(lower,'z',32,6,33,0,[],MAIN,8);
  partition(lower,'x',17,17,32,0,[],MAIN,8);
  partition(lower,'z',17,6,17,0,[doorAt(14,3)],MAIN,8);
  partition(lower,'x',26,0,12,0,[],MAIN,8);
  partition(lower,'z',12,26,33,0,[doorAt(29.5,2.5)],MAIN,8);
  partition(lower,'x',28,12,21,0,[doorAt(16,2.5)],MAIN,8);
  // ADU kitchen run and bed.
  box(lower,19,.06,19.5,31.5,3,21.5,FURN,8);
  box(lower,22,.06,8,27,1.6,14,FURN,8);
  // Crawl space beyond the ADU: low fill, not habitable.
  // Contiguous fill, inset 0.25 ft from the foundation walls.
  for(const [x0,z0,x1,z1] of [[55.55,-.05,75.05,7.95],[50.55,7.95,75.05,13.75],[32.55,13.75,75.05,38.25],[49.25,38.25,75.05,40.75],[49.25,40.75,61.75,42.45]])
    box(lower,x0,.02,z0,x1,3.2,z1,EARTH,7);
  // Existing stair from the main level down to the basement.
  for(let i=0;i<13;i++) {
    const x=30-i*.75, yt=MAIN-(i+1)*.654;
    box(lower,x-.75,Math.max(.05,yt-.16),27,x,Math.max(.2,yt),30.5,FLOOR,1);
  }
  // ADU entry landing (24 SF, "porch @ ADU access") with steps down to grade ("by others").
  box(lower,16,-.05,2,22,.6,6,FLOOR,3);
  for(let i=0;i<2;i++) box(lower,16.5,-.05,2-(i+1)*1,21.5,.4-i*.2,2-i*1,FLOOR,3);
  // ---- Deck side, per the photos: main deck in the notch between the wings with a
  // stair down to a lower deck at grade, and a narrow deck along the left wing.
  // Depths and the lower deck size are scaled by eye from the photos.
  box(lower,32.3,MAIN-.3,-3,50.3,MAIN,13.5,FLOOR,4);
  box(lower,50.3,MAIN-.3,-3,55.3,MAIN,7.7,FLOOR,4);
  box(lower,0,MAIN-.3,1.5,18,MAIN,6,FLOOR,4);
  for(let x=32.9;x<55.3;x+=.9) line(lower,[x,MAIN+.01,-3],[x,MAIN+.01,x<50.3?13.5:7.7],DETAIL,4);
  for(const [x,z] of [[32.9,-2.6],[39,-2.6],[45,-2.6],[50.1,-2.6],[.6,2],[9,2],[17.4,2]])box(lower,x-.3,0,z-.3,x+.3,MAIN-.3,z+.3,FRAME,4);
  box(lower,32.3,MAIN-.9,-3.15,55.3,MAIN-.3,-2.85,FRAME,4);
  // Lower deck / patio at grade.
  box(lower,50.5,-.02,-15,74,.45,-3,FLOOR,4);
  for(let x=51.1;x<74;x+=1.2) line(lower,[x,.46,-15],[x,.46,-3],DETAIL,4);
  function rail(g,axis,f,a,b,y,role) {
    const prism=(u,v,y0,y1,w=.075)=>axis==='x'?box(g,u,y0,f-w,v,y1,f+w,FRAME,role):box(g,f-w,y0,u,f+w,y1,v,FRAME,role);
    prism(a,b,y+3.37,y+3.5,.1);prism(a,b,y+.16,y+.26,.06);
    for(let x=a;x<=b+.001;x+=4)prism(x,Math.min(x+.13,b+.13),y,y+3.5,.09);
    prism(b-.13,b,y,y+3.5,.09);
    for(let k=1;k<4;k++){const yy=y+.26+k*.78;axis==='x'?line(g,[a,yy,f],[b,yy,f],FRAME,role):line(g,[f,yy,a],[f,yy,b],FRAME,role);}
  }
  // Rails sit in the main-level group so the level cut peels them with the walls.
  rail(upper,'x',-2.9,32.4,50.5,MAIN,4);
  rail(upper,'z',32.4,-2.9,6,MAIN,4);
  rail(upper,'x',1.6,0.1,17.9,MAIN,4);
  rail(upper,'z',17.9,1.6,6,MAIN,4);
  // Deck stair down to the lower deck, with black stringers.
  for(let i=0;i<12;i++) {
    const z=-3-i*.75, yt=MAIN-(i+1)*.68;
    box(lower,50.8,Math.max(.5,yt-.16),z-.75,54.8,Math.max(.6,yt),z,FLOOR,4);
  }
  for(const x of [50.8,54.8]) {
    face(lower,[[x,MAIN,-3],[x,MAIN-.6,-3],[x,.45,-12],[x,1.05,-12]],FRAME,4,false);
    // Black stair rail: sloped top rail and three posts, in the main-level group like the deck rails.
    box(upper,x-.07,.45,-12.1,x+.07,3.95,-11.9,FRAME,4); box(upper,x-.07,MAIN,-3.1,x+.07,MAIN+3.5,-2.9,FRAME,4);
    face(upper,[[x,MAIN+3.4,-3],[x,MAIN+3.5,-3],[x,3.95,-12],[x,3.85,-12]],FRAME,4,false);
    line(upper,[x,MAIN+1.8,-3],[x,2.3,-12],FRAME,4);
  }
  // Existing open porch, 60 SF, at the entry.
  // In the entry notch per the site plan; size from 60 SF (approximate shape).
  box(lower,35,MAIN-.25,38.75,45,MAIN+.05,44.8,FLOOR,3);
  // ---- Main level floor.
  for(const [x0,x1,z0,z1] of TILES) box(slab,x0,MAIN,z0,x1,MAIN+.5,z1,FLOOR);
  const M0 = MAIN+.5;
  // Openings per the A301 elevations and the photos: glass walls on the deck side,
  // punched windows elsewhere. Panel widths are approximate.
  const glass=(a,b)=>[a,b,M0+.25,M0+7.7,'window'];
  ring(upper,P,M0,PLATE,[
    [glass(1.5,13.5),glass(16,30.8)],
    [glass(7,12.6)],
    [glass(33.4,49.2)],
    [glass(8.4,12.8)],
    [],
    [glass(.4,7)],
    [glass(56.4,74.2)],
    [windowAt(12,3.5,M0),windowAt(30,5,M0)],
    [windowAt(69,3,M0)],
    [],
    [windowAt(55,3,M0)],
    [],
    [windowAt(36,2.5,M0),doorAt(42,3,M0)],
    [windowAt(47,3,M0)],
    [windowAt(9,7,M0),windowAt(24,3,M0)],
    [windowAt(14,3.5,M0),windowAt(36,3,M0),windowAt(46,3,M0)],
  ],true);
  // Wall above the plate up to the single sloped roof (clerestory band).
  for(let i=0;i<P.length;i++) {
    const [ax,az]=P[i],[bx,bz]=P[(i+1)%P.length];
    face(upper,[[ax,PLATE,az],[bx,PLATE,bz],[bx,roofY(bz)-.15,bz],[ax,roofY(az)-.15,az]],WALL,5,true,PLATE);
  }
  // Main level rooms (A202): three bedrooms, living, dining, kitchen, office/craft.
  partition(upper,'z',12.5,6,38,M0,[doorAt(25,3,M0)]);
  partition(upper,'x',32,0,12.5,M0,[doorAt(9,2.5,M0)]);
  partition(upper,'x',38,0,20,M0,[doorAt(16,3,M0)]);
  partition(upper,'z',20,38,55,M0,[doorAt(41,3,M0)]);
  partition(upper,'x',15.5,12.5,32.3,M0,[doorAt(28,3,M0)]);
  partition(upper,'z',59,17,40,M0,[doorAt(20,3,M0)]);
  partition(upper,'x',17,59,75,M0);
  partition(upper,'x',30,59,75,M0,[doorAt(61,2.5,M0)]);
  partition(upper,'x',32,37,49,M0);
  partition(upper,'z',37,32,38.5,M0,[doorAt(35,2.5,M0)]);
  partition(upper,'z',44,32,38.5,M0,[doorAt(35,2.5,M0)]);
  // Kitchen island (8'-0" on A202), beds.
  box(upper,61,M0,8.5,69,M0+3,12,FURN);
  function bed(x,z,w=5,d=6.5) {
    box(upper,x,M0+.05,z,x+w,M0+1.6,z+d,FURN);
    for(let i=0;i<2;i++)box(upper,x+.22+i*w/2,M0+1.6,z+.25,x+w/2-.22+i*w/2,M0+1.78,z+1.6,WALL);
  }
  bed(3,15,6,7);bed(3,46,5.5,6.5);bed(66,20,5.5,6.5);
  box(upper,22,M0,32,30,M0+2.5,34.5,FURN);
  box(upper,42,M0,18,50,M0+2.5,22,FURN);
  // Stair opening rail at the existing basement stair.
  for(const z of [26.8,30.7]) box(upper,21.5,M0,z-.07,30,M0+3,z+.07,WALL,1);
  // ---- One low-slope roof (A203): standing seam metal, 1'-6" overhang, falls toward the gutter side.
  function roofRect(g,x0,x1,z0,z1,fn,seam,role=0,col=ROOF,seamCol=[.42,.44,.45],t=1.1) {
    const y0=fn(z0), y1=fn(z1);
    face(g,[[x0,y0,z0],[x1,y0,z0],[x1,y1,z1],[x0,y1,z1]],col,role,false);
    face(g,[[x0,y0-t,z0],[x1,y0-t,z0],[x1,y1-t,z1],[x0,y1-t,z1]],col,role,false);
    for(let x=x0+seam;x<x1-.2;x+=seam) line(g,[x,y0+.03,z0],[x,y1+.03,z1],seamCol,role);
  }
  // 1'-6" overhang (A203); the roof spans the deck notch as on the roof plan.
  const R=[[-1.5,4.5],[55.3,4.5],[55.3,-1.8],[76.8,-1.8],[76.8,44.2],[33.8,44.2],[33.8,57.2],[-1.5,57.2]];
  roofRect(roofs,-1.5,33.8,4.5,57.2,roofY,1.5);
  roofRect(roofs,33.8,55.3,4.5,44.2,roofY,1.5);
  roofRect(roofs,55.3,76.8,-1.8,44.2,roofY,1.5);
  for(let i=0;i<R.length;i++) {
    const [ax,az]=R[i],[bx,bz]=R[(i+1)%R.length];
    face(roofs,[[ax,roofY(az)-1.1,az],[bx,roofY(bz)-1.1,bz],[bx,roofY(bz),bz],[ax,roofY(az),az]],FASCIA,0,true);
  }
  // ---- Detached one-car garage (garage set A100/A200/A300).
  box(garage,G.x0,G.floor-.2,G.z0,G.x1,G.floor+.05,G.z1,FLOOR,7);
  const GP=[[G.x0,G.z0],[G.x1,G.z0],[G.x1,G.z1],[G.x0,G.z1]];
  ring(garage,GP,G.floor,G.low,[
    [doorAt(68.5,3,G.floor)],[],[[60.25,68.25,G.floor,G.floor+7,'garage']],[windowAt(62,3,G.floor),windowAt(71,3,G.floor)]
  ],true);
  for(let i=0;i<GP.length;i++) {
    const [ax,az]=GP[i],[bx,bz]=GP[(i+1)%GP.length];
    face(garage,[[ax,G.low,az],[bx,G.low,bz],[bx,gRoofY(bz)-.15,bz],[ax,gRoofY(az)-.15,az]],WALL,5,true,G.low);
  }
  roofRect(garageRoof,G.x0-1,G.x1+1,G.z0-1,G.z1+1,gRoofY,1.5,0,SKETCH_ROOF,[.70,.72,.71],.45);
  const GR=[[G.x0-1,G.z0-1],[G.x1+1,G.z0-1],[G.x1+1,G.z1+1],[G.x0-1,G.z1+1]];
  for(let i=0;i<4;i++) {
    const [ax,az]=GR[i],[bx,bz]=GR[(i+1)%4];
    face(garageRoof,[[ax,gRoofY(az)-.45,az],[bx,gRoofY(bz)-.45,bz],[bx,gRoofY(bz),bz],[ax,gRoofY(az),az]],WALL,0,true);
  }
  outline(garage,[[59.5,59.5],[60.5,58.5],[68,58.5],[69,59.5],[69,73.5],[68,74.5],[60.5,74.5],[59.5,73.5]],G.floor+.1);
  // ---- Labels. Printed figures only for dimensions.
  for(const r of [
    ['75 ft',37.5,-1,true],['49 ft',-1.8,30,true],
    ['Bedroom',6,24],['Office / craft',22.5,10.5],['Living',22,21],['Dining',46,24],
    ['Kitchen',65,6],['Bedroom',67,26],['Bedroom',10,48],['Bath',6,35,true],
    ['Laundry',46.5,35,true],['Powder',40.5,35,true],['Bath',67,35,true],
    ['Deck',20,1.5],['Magnolia Blvd W',30,-48.5,true],['Constance Dr W',30,LOT.z1+3,true],['Stair',26,28.7,true],['Porch',40,41.8,true],['Entry',42,37,true],['Garage',64.2,66.5]
  ])planLabel(r[0],r[1],r[2],!!r[3],'upper',r[2]<-40?.1:r[2]>LOT.z1?MAIN:(r[1]>55&&r[2]>55?G.floor+.2:M0+.15));
  for(const r of [
    ['ADU 865 SF',8,13],['Living',8,19,true],['Bedroom',24,11.5],['Kitchen',25,24],
    ['Bath',6,29.5,true],['Laundry',16.5,30.5,true],['Existing basement',16,44.5],['ADU entry',19,1,true],
    ['Crawl space',53,29],['32 ft',16,7,true],['Magnolia Blvd W',30,-48.5,true],['Garage',64.2,66.5,true]
  ])planLabel(r[0],r[1],r[2],!!r[3],'main',r[2]<-40?.1:(r[1]>55&&r[2]>55?G.floor+.2:.25));
  return {groups:groups.map(g=>({id:g.id,solid:new Float32Array(g.solid),lines:new Float32Array(g.lines)})),labels,
    bounds:{min:[-6,-.5,-50],max:[82,23,84]},
    notes:'Teaching sketch from the permit sets. Unprinted dimensions are scaled by eye.'};
}

const DEFAULT_BOUNDS = { min: [-6, -0.5, -50], max: [82, 23, 84] };

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
  const roofCut = mix(26, 16.8, smooth(0.30, 0.46, p));
  const upperCut = mix(18.4, 8.85, smooth(0.48, 0.64, p));
  const upperFade = p < 0.50 ? 1 : 1 - smooth(0.58, 0.66, p);
  const lowerCut = mix(8.62, 0.42, smooth(0.72, 0.94, p));
  switch (id) {
    case 'site': return state(true);
    case 'lower': return state(true, lowerCut);
    case 'upperfloor': return state(p < 0.67, mix(9.0, 8.65, smooth(0.58, 0.66, p)), upperFade);
    case 'garage': return state(true, p < 0.48 ? 100 : Math.max(upperCut + 0.2, 8.95));
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
  if (p < 0.50) return mix(full, 18.2, smooth(0.30, 0.46, p));
  if (p < 0.70) return mix(18.2, 9.6, smooth(0.48, 0.66, p));
  return mix(9.6, 1.4, smooth(0.72, 0.94, p));
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
  float light = 0.9 + 0.1 * (0.5 + 0.5 * dot(normal, normalize(vec3(-0.35, 0.9, 0.28))));
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
  float a = rectangle(vGround, vec2(37.65, 27.7), vec2(37.7, 28.0));
  float b = rectangle(vGround, vec2(64.2, 66.5), vec2(6.2, 10.2));
  float c = rectangle(vGround, vec2(27.5, 2.0), vec2(27.5, 4.0));
  float d = max(min(min(a, b), c), 0.0);
  float shadow = exp(-d * d / 13.0) * uStrength;
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
    const [x0, z0, x1, z1] = [-14, -64, 95, 100];
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
    const dpr = Math.min(displayDpr, cssW < 600 ? 1.35 : 2,
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
      else if (id === 'balcony' || id === 'deck') role = 4;
      else if (id === 'adu') role = 8;
      else if (id === 'garage' && (groupId === 'garage' || groupId === 'garageRoof')) lift = 1;
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
    gl.uniform1f(shadowProgram.uniforms.uStrength, mix(0.14, 0.04, smooth(0.28, 0.78, p)));
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
    { id: "house", end: 0.16, line: "The finished house, the ADU below it, and the garage. Tap it, then drag to turn it." },
    { id: "front", end: 0.32, line: "The deck side: tall glass on the main level, the deck and stair, and the daylight basement below." },
    { id: "roof", end: 0.48, line: "The roof lifts off. One low-slope standing seam metal roof, and the garage's own metal roof." },
    { id: "upper", end: 0.66, line: "The main level: living, dining, kitchen, office, and three bedrooms." },
    { id: "plan", end: 0.84, line: "The basement, cut flat: the new 865 SF ADU beside the existing basement." },
    { id: "foundation", end: 2, line: "The foundation, the slabs the house and the garage stand on." }
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
