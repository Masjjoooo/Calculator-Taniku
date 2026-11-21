(() => {
'use strict';
const URL='https://gevrnbqksgjlvpqjtmtl.supabase.co';
const KEY='sb_publishable_xjMpFAk6N34RvbgpP6IrPA_J5RIFcnF';
// Masukkan Google Maps JavaScript API key yang dibatasi ke domain aplikasi di sini.
const GOOGLE_MAPS_API_KEY='';
let googleMutantLayer=null,googleLoaderPromise=null;
const db=window.supabase.createClient(URL,KEY);
const $=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(n);
let map=null,layer=null,savedLayer=null,ownerId=null,drawMode=false,points=[],watch=null,accuracy=null,gpsMode=false,gpsPosition=null,gpsMarker=null,villages=[],farmers=[],fields=[],redoStack=[],baseLayers={},activeBase='satellite';
function msg(s){$('mapStatus').textContent=s}
function area(p){if(p.length<3)return 0;const R=6378137,r=Math.PI/180;let sum=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];sum+=(b[1]-a[1])*r*(2+Math.sin(a[0]*r)+Math.sin(b[0]*r))}return Math.abs(sum*R*R/2)}
function dist(a,b){const R=6371008.8,r=Math.PI/180,d1=(b[0]-a[0])*r,d2=(b[1]-a[1])*r,x=Math.sin(d1/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
function perimeter(p){return p.length<2?0:p.reduce((s,a,i)=>s+dist(a,p[(i+1)%p.length]),0)}
function stats(){const a=area(points),p=perimeter(points);$('mapArea').textContent=fmt(a)+' m²';$('mapPerimeter').textContent=fmt(p)+' m';$('mapBoxes').textContent=fmt(a/1400)+' kotak';$('mapUndo').disabled=!points.length;$('mapRedo').disabled=!redoStack.length;$('mapAddPoint').disabled=!drawMode}
function draw(){if(!layer)return;layer.clearLayers();if(points.length){L.polyline(points,{color:'#fff',weight:4,dashArray:drawMode?'7 6':null}).addTo(layer);points.forEach((p,i)=>L.circleMarker(p,{radius:6,color:'#fff',weight:2,fillColor:'#176b45',fillOpacity:1}).bindTooltip(String(i+1)).addTo(layer));if(points.length>=3)L.polygon(points,{color:'#fff',weight:3,fillColor:'#8b4c55',fillOpacity:.38}).bindTooltip(fmt(area(points))+' m²',{permanent:true,direction:'center'}).addTo(layer)}stats()}
function installMapUI(){
 const style=document.createElement('style');style.textContent=`
 #fieldMap{position:relative;overflow:hidden}
 .map-aim{position:absolute;z-index:700;left:50%;top:50%;width:34px;height:34px;transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(0 1px 3px #000)}
 .map-aim:before,.map-aim:after{content:"";position:absolute;background:#fff;border:1px solid #173b2b;border-radius:2px}
 .map-aim:before{width:2px;height:34px;left:16px;top:0}.map-aim:after{height:2px;width:34px;top:16px;left:0}
 .map-aim i{position:absolute;width:8px;height:8px;border:2px solid #fff;background:#176b45;border-radius:50%;left:13px;top:13px}
 .map-tools{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:9px 0}
 .map-tools select{width:auto;min-width:150px;flex:1}
 #mapAddPoint{background:#176b45;color:#fff;flex:1}
 #mapUndo:disabled,#mapRedo:disabled,#mapAddPoint:disabled{opacity:.38}
 .leaflet-control-attribution{font-size:9px!important}
 `;document.head.appendChild(style);
 const aim=document.createElement('div');aim.className='map-aim';aim.innerHTML='<i></i>';aim.setAttribute('aria-label','Titik bidik peta');$('fieldMap').appendChild(aim);
 const tools=document.createElement('div');tools.className='map-tools';tools.innerHTML='<select id="mapLayerChoice" aria-label="Jenis peta"><option value="satellite">Satelit Esri</option><option value="google">Google Satellite</option><option value="googlehybrid">Google Hybrid</option><option value="hybrid">Esri + nama tempat</option><option value="street">Peta jalan</option><option value="topo">Topografi</option></select><button type="button" class="secondary" id="mapGpsCenter">Pusatkan GPS</button><button type="button" class="primary" id="mapAddPoint">＋ Tambah titik bidik</button><button type="button" class="secondary" id="mapRedo">Redo</button>';
 $('fieldMap').insertAdjacentElement('afterend',tools);
 $('mapLayerChoice').addEventListener('change',e=>setBase(e.target.value));
 $('mapGpsCenter').addEventListener('click',centerGps);
 $('mapAddPoint').addEventListener('click',addAimPoint);
 $('mapRedo').addEventListener('click',redo);
 $('mapUndo').textContent='Undo';
 $('mapFinish').textContent='Selesai batas';
 $('mapDraw').textContent='Mulai bidik titik';
 $('mapGps').textContent='Aktifkan GPS';
}
function init(){if(map)return;map=L.map('fieldMap',{zoomControl:true}).setView([-6.75,111.05],16);baseLayers.satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri, Maxar, Earthstar Geographics'});baseLayers.labels=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Labels © Esri'});baseLayers.street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'});baseLayers.topo=L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'© OpenTopoMap contributors'});setBase(activeBase);savedLayer=L.featureGroup().addTo(map);layer=L.featureGroup().addTo(map);showSaved();map.on('click',()=>{if(drawMode)msg('Arahkan titik bidik di tengah peta, lalu tekan Tambah titik bidik.')});installMapUI();setTimeout(()=>map.invalidateSize(),200)}
function loadScript(src){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error('Gagal memuat '+src));document.head.appendChild(script)})}
async function ensureGoogleMutant(){
 if(googleMutantLayer)return googleMutantLayer;
 if(!GOOGLE_MAPS_API_KEY)return Promise.reject(new Error('Google Maps API key belum diatur. Tambahkan key yang dibatasi untuk domain Calculator-Taniku pada konstanta GOOGLE_MAPS_API_KEY di map.js.'));
 if(!googleLoaderPromise)googleLoaderPromise=(async()=>{await loadScript('https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(GOOGLE_MAPS_API_KEY)+'&v=weekly');await loadScript('https://unpkg.com/leaflet.gridlayer.googlemutant@0.16.0/Leaflet.GoogleMutant.js');if(!L.gridLayer?.googleMutant)throw new Error('Plugin Leaflet.GoogleMutant tidak berhasil dimuat.');googleMutantLayer={satellite:L.gridLayer.googleMutant({type:'satellite',maxZoom:22}),hybrid:L.gridLayer.googleMutant({type:'hybrid',maxZoom:22})};return googleMutantLayer})();
 return googleLoaderPromise;
}
async function setBase(name){
 if(!map)return;
 if(name==='google'||name==='googlehybrid'){
  try{const g=await ensureGoogleMutant();Object.values(baseLayers).forEach(x=>map.removeLayer(x));if(googleMutantLayer.satellite)map.removeLayer(googleMutantLayer.satellite);if(googleMutantLayer.hybrid)map.removeLayer(googleMutantLayer.hybrid);const selected=name==='google'?g.satellite:g.hybrid;map.addLayer(selected);activeBase=name;msg(name==='google'?'Google Satellite aktif.':'Google Hybrid aktif.');}
  catch(e){$('mapLayerChoice').value=activeBase;msg(e.message+' Tetap menggunakan peta sebelumnya.');}
  return;
 }
 Object.values(baseLayers).forEach(x=>map.removeLayer(x));map.addLayer(name==='hybrid'?baseLayers.satellite:baseLayers[name]);if(name==='hybrid')map.addLayer(baseLayers.labels);activeBase=name;
}
function populate(){const v=$('mapVillage').value,f=$('mapFarmer').value;$('mapFarmer').innerHTML='<option value="">Pilih petani</option>'+farmers.filter(x=>!v||x.village_id===v).map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('');$('mapField').innerHTML='<option value="">Buat petak baru</option>'+fields.filter(x=>(!v||x.village_id===v)&&(!f||x.farmer_id===f)).map(x=>'<option value="'+x.id+'">'+esc(x.name)+' · '+fmt(x.area_m2)+' m²</option>').join('')}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function load(){const session=await db.auth.getSession();if(!session.data.session)return;ownerId=session.data.session.user.id;const [v,f,fs]=await Promise.all([db.from('villages').select('id,name').order('name'),db.from('farmers').select('id,name,village_id').order('name'),db.from('fields').select('id,name,area_m2,village_id,farmer_id,boundary_geojson,perimeter_m,measurement_method,measured_at').order('created_at',{ascending:false})]);if(v.error||f.error||fs.error){msg((v.error||f.error||fs.error).message);return}villages=v.data||[];farmers=f.data||[];fields=fs.data||[];$('mapVillage').innerHTML='<option value="">Pilih desa</option>'+villages.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('');populate();showSaved()}
function showSaved(){if(!map||!savedLayer)return;savedLayer.clearLayers();fields.forEach(x=>{const coords=x.boundary_geojson?.coordinates?.[0];if(!coords||coords.length<4)return;const latlng=coords.slice(0,-1).map(c=>[c[1],c[0]]);L.polygon(latlng,{color:'#fff',weight:2,fillColor:'#7b4c55',fillOpacity:.2}).bindTooltip(esc(x.name)+' · '+fmt(x.area_m2)+' m²').addTo(savedLayer)})}
function stop(){if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;$('mapGps').textContent='Aktifkan GPS'}
function centerGps(){if(gpsPosition){map.setView(gpsPosition,19);msg('Peta dipusatkan ke posisi GPS. Geser peta hingga bidikan tepat pada sudut sawah.');return}if(!navigator.geolocation)return msg('GPS tidak tersedia.');navigator.geolocation.getCurrentPosition(p=>{gpsPosition=[p.coords.latitude,p.coords.longitude];accuracy=p.coords.accuracy;if(gpsMarker)gpsMarker.setLatLng(gpsPosition);else gpsMarker=L.circleMarker(gpsPosition,{radius:8,color:'#fff',weight:3,fillColor:'#1685d5',fillOpacity:1}).bindTooltip('Posisi GPS').addTo(map);$('mapAccuracy').textContent='±'+fmt(accuracy)+' m';map.setView(gpsPosition,19);msg('Lokasi GPS ditemukan. Geser peta untuk menempatkan bidikan tepat pada batas sawah.')},e=>msg('Lokasi gagal: '+e.message),{enableHighAccuracy:true,timeout:15000})}
function addAimPoint(){if(!drawMode)return;const c=map.getCenter(),p=[c.lat,c.lng];if(points.length&&dist(points[points.length-1],p)<.5)return msg('Titik terlalu dekat dengan titik sebelumnya. Geser peta sedikit.');points.push(p);redoStack=[];draw();msg('Titik '+points.length+' ditambahkan. Geser peta ke sudut berikutnya, lalu tambah titik lagi.')}
function undo(){if(!points.length)return;redoStack.push(points.pop());draw();msg('Titik terakhir dibatalkan. Tekan Redo untuk mengembalikannya.')}
function redo(){if(!redoStack.length)return;points.push(redoStack.pop());draw();msg('Titik dikembalikan.')}
function loadField(){const f=fields.find(x=>x.id===$('mapField').value);if(!f)return;points=(f.boundary_geojson?.coordinates?.[0]||[]).slice(0,-1).map(c=>[c[1],c[0]]);redoStack=[];$('mapFieldName').value=f.name;draw();if(points.length)map.fitBounds(L.latLngBounds(points).pad(.2))}
async function save(){const village_id=$('mapVillage').value,farmer_id=$('mapFarmer').value,name=$('mapFieldName').value.trim(),id=$('mapField').value;if(!village_id||!farmer_id||!name)return msg('Pilih desa, petani, dan isi nama petak.');if(points.length<3)return msg('Batas sawah membutuhkan minimal 3 titik.');const ring=points.map(p=>[p[1],p[0]]);ring.push(ring[0]);const payload={owner_id:ownerId,village_id,farmer_id,name,area_m2:area(points),perimeter_m:perimeter(points),boundary_geojson:{type:'Polygon',coordinates:[ring]},measurement_method:gpsMode?'gps_aim':'manual_aim',measured_at:new Date().toISOString(),gps_accuracy_m:accuracy,location:villages.find(x=>x.id===village_id)?.name||null};const q=id?db.from('fields').update(payload).eq('id',id):db.from('fields').insert(payload);const {error}=await q;if(error)return msg('Gagal menyimpan: '+error.message);msg('Berhasil disimpan: '+fmt(payload.area_m2)+' m².');await load();$('mapField').value=id||'';drawMode=false;stats()}
$('mapVillage').addEventListener('change',populate);$('mapFarmer').addEventListener('change',populate);$('mapField').addEventListener('change',loadField);
$('mapDraw').addEventListener('click',()=>{init();stop();points=[];redoStack=[];gpsMode=false;drawMode=true;draw();map.setView(map.getCenter(),Math.max(map.getZoom(),18));msg('Mode bidik aktif. Geser peta hingga tanda bidik tepat di sudut pertama, lalu tekan Tambah titik bidik.')});
$('mapUndo').addEventListener('click',undo);
$('mapFinish').addEventListener('click',()=>{if(points.length<3)return msg('Tambahkan minimal 3 titik sebelum menyelesaikan batas.');drawMode=false;stop();draw();msg('Batas selesai. Periksa polygon dan luas, lalu simpan pengukuran.')});
$('mapClear').addEventListener('click',()=>{stop();drawMode=false;points=[];redoStack=[];layer?.clearLayers();showSaved();stats();msg('Pengukuran dibersihkan.')});
$('mapGps').addEventListener('click',()=>{init();if(!navigator.geolocation)return msg('GPS tidak tersedia.');if(watch!==null){stop();return}gpsMode=true;$('mapGps').textContent='Hentikan GPS';msg('GPS aktif. Posisi kamu ditandai di peta; geser peta ke sudut sawah lalu tekan Tambah titik bidik.');watch=navigator.geolocation.watchPosition(pos=>{gpsPosition=[pos.coords.latitude,pos.coords.longitude];accuracy=pos.coords.accuracy;if(gpsMarker)gpsMarker.setLatLng(gpsPosition);else gpsMarker=L.circleMarker(gpsPosition,{radius:8,color:'#fff',weight:3,fillColor:'#1685d5',fillOpacity:1}).bindTooltip('Posisi GPS').addTo(map);$('mapAccuracy').textContent='±'+fmt(accuracy)+' m';if(points.length===0&&map.getZoom()<17)map.setView(gpsPosition,19)},e=>{stop();msg('GPS gagal: '+e.message)},{enableHighAccuracy:true,maximumAge:1000,timeout:15000})});

$('mapSave').addEventListener('click',save);$('mapLocate').addEventListener('click',()=>{init();centerGps()});
document.querySelector('.sidebar')?.addEventListener('click',e=>{if(e.target.closest('[data-nav="mapPanel"]'))setTimeout(()=>{init();map.invalidateSize()},100)});
window.addEventListener('resize',()=>map?.invalidateSize());
db.auth.onAuthStateChange(()=>load());load();
})();