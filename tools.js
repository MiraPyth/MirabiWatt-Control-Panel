/* Tools di MirabiWatt (14/10/2026): il codice della vecchia pagina index.html, ora dentro la dashboard (vista «Tools»).
   Chiuso in una funzione per non scontrarsi con i nomi della dashboard; fuori solo le funzioni usate dai pulsanti. */
(function () {

        lucide.createIcons();

        function switchView(viewId) {
            document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
            document.getElementById(viewId).classList.add('active');
            if(viewId === 'view-kcal') { syncKcalFormWithStorage(); calculateKcal(); }
            if(viewId === 'view-ftp-cp') { calculateFtpCp(); }
            if(viewId === 'view-hydration') { calculateHydration(); }
            if(viewId === 'view-performance') { syncPerfFormWithStorage(); calculatePerformance(); }
            if(viewId === 'view-climb') { syncClimbFormWithStorage(); calculateClimb(); }
            if(viewId === 'view-training') { syncTrainingForm(); generateTrainingPlan(); }
        }

        function openModal(id) { document.getElementById(id).classList.add('active'); }
        function closeModal(id) { document.getElementById(id).classList.remove('active'); }

        const tools = [
            { id: 'kcal', name: 'KCAL Calculator', icon: 'activity', color: 'text-cyan-400', desc: "Calcola il dispendio energetico e l'intake." },
            { id: 'ftp_cp', name: 'FTP e CP Calculator', icon: 'zap', color: 'text-orange-400', desc: "Modelli per Critical Power e FTP." },
            { id: 'hydration', name: 'Hydration Calculator', icon: 'droplet', color: 'text-cyan-400', desc: "Strategie di idratazione e gel." },
            { id: 'performance', name: 'Performance Predictor', icon: 'trending-up', color: 'text-orange-400', desc: "Stima Potenza e resistenze." },
            { id: 'climb', name: 'Climb Predictor', icon: 'mountain', color: 'text-cyan-400', desc: "Attacco al KOM e Matrice VAM." },
            { id: 'training', name: 'Week Training', icon: 'calendar', color: 'text-orange-400', desc: "Template Settimanali (Polarized, SweetSpot)." }
        ];

        function renderTools() {
            const grid = document.getElementById('toolsGrid'); grid.innerHTML = '';
            tools.forEach(tool => {
                let action = `switchView('view-${tool.id === 'ftp_cp' ? 'ftp-cp' : tool.id}')`;
                grid.insertAdjacentHTML('beforeend', `
                    <div class="tool-card relative group bg-black/60 backdrop-blur-sm p-6 rounded-lg cursor-pointer overflow-hidden neon-border neon-hover transition-all" onclick="${action}">
                        <div class="scanline"></div>
                        <div class="relative z-10 flex flex-col items-center text-center">
                            <i data-lucide="${tool.icon}" class="w-10 h-10 mb-4 ${tool.color}"></i>
                            <h3 class="text-xl font-bold uppercase tracking-wider mb-2 neon-text">${tool.name}</h3>
                            <p class="text-sm text-cyan-100/70">${tool.desc}</p>
                        </div>
                    </div>`);
            });
            lucide.createIcons();
        }

        function loadUserData() {
            const sd = sessionStorage.getItem('mirabiwatt_user_data');
            if (sd) {
                const ud = JSON.parse(sd);
                ['nome','sesso','eta','peso','pesoBici','altezza','massaGrassa','livelloCiclista','oreSettimanali'].forEach(k => { if(ud[k]) document.getElementById(k).value = ud[k]; });
                if (ud.nome) document.getElementById('userBtnText').textContent = `DATI DI ${ud.nome.toUpperCase()}`;
            }
        }

        function saveUserData(e) {
            e.preventDefault(); const ud = {};
            ['nome','sesso','eta','peso','pesoBici','altezza','massaGrassa','livelloCiclista','oreSettimanali'].forEach(k => ud[k] = document.getElementById(k).value);
            sessionStorage.setItem('mirabiwatt_user_data', JSON.stringify(ud));
            document.getElementById('userBtnText').textContent = `DATI DI ${ud.nome.toUpperCase()}`;
            closeModal('userModal');
            if(document.getElementById('view-kcal').classList.contains('active')) { syncKcalFormWithStorage(); calculateKcal(); }
            if(document.getElementById('view-performance').classList.contains('active')) { syncPerfFormWithStorage(); calculatePerformance(); }
            if(document.getElementById('view-climb').classList.contains('active')) { syncClimbFormWithStorage(); calculateClimb(); }
            if(document.getElementById('view-training').classList.contains('active')) { syncTrainingForm(); generateTrainingPlan(); }
        }

        // --- CALCOLI BASE E COMUNI ---
        function getRequiredPowerForSpeed(speedKmh, gradientPct, pesoSistemico) {
            const vMps = speedKmh / 3.6;
            const pRoll = pesoSistemico * 9.81 * 0.004 * vMps;
            const pAero = 0.5 * 1.225 * 0.32 * Math.pow(vMps, 3);
            const pGrav = pesoSistemico * 9.81 * Math.sin(Math.atan(gradientPct / 100)) * vMps;
            const powerTotal = (pRoll + pAero + pGrav) / 0.97; 
            return powerTotal > 0 ? powerTotal : 0;
        }

        // Ricerca binaria per trovare la velocità dato il target di potenza
        function getSpeedForTargetPower(targetPower, gradientPct, pesoSistemico) {
            let min = 0.1;
            let max = 130.0;
            let mid = 0;
            for(let i=0; i<40; i++) { // 40 iterazioni bastano per una precisione enorme
                mid = (min + max) / 2;
                let p = getRequiredPowerForSpeed(mid, gradientPct, pesoSistemico);
                if(p > targetPower) max = mid;
                else min = mid;
            }
            return mid;
        }

        function formatTimeFromHours(hours) {
            const ts = Math.round(hours * 3600);
            const h = Math.floor(ts / 3600);
            const m = Math.floor((ts % 3600) / 60);
            const s = ts % 60;
            return h > 0 ? `${h}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s` : `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        }

        // --- KCAL ---
        function syncKcalFormWithStorage() {
            const sd = sessionStorage.getItem('mirabiwatt_user_data');
            if(sd) {
                const ud = JSON.parse(sd);
                ['sesso','eta','peso','altezza'].forEach(k => { if(ud[k]) document.getElementById('kcal-'+k).value = ud[k]; });
                if(ud.massaGrassa) document.getElementById('kcal-bf').value = ud.massaGrassa;
            }
        }
        function calculateKcal() {
            const p = parseFloat(document.getElementById('kcal-peso').value)||0; if(p===0)return;
            const s = document.getElementById('kcal-sesso').value, e = parseFloat(document.getElementById('kcal-eta').value)||0;
            const a = parseFloat(document.getElementById('kcal-altezza').value)||0, bf = parseFloat(document.getElementById('kcal-bf').value)||0;
            const vita = parseFloat(document.getElementById('kcal-vita').value)||1.2;
            const ore = parseFloat(document.getElementById('kcal-ore').value)||0, watt = parseFloat(document.getElementById('kcal-watt').value)||0;

            const bmr = bf > 0 ? 370 + (21.6*(p*(1-(bf/100)))) : (s==='M' ? (10*p)+(6.25*a)-(5*e)+5 : (10*p)+(6.25*a)-(5*e)-161);
            const bike = ore > 0 ? (watt > 0 ? watt*ore*3.6 : 500*ore) : 0;
            const tdee = (bmr * vita) + bike;
            
            const pro = p * 2.2, fat = p * 1.0;
            let choKc = tdee - (pro*4) - (fat*9); if(choKc<0) choKc=0;

            document.getElementById('res-tdee').innerText = Math.round(tdee); document.getElementById('res-bmr').innerText = Math.round(bmr);
            document.getElementById('res-burn').innerText = Math.round(bike); document.getElementById('res-cho').innerText = Math.round(choKc/4)+'g';
            document.getElementById('res-pro').innerText = Math.round(pro)+'g'; document.getElementById('res-fat').innerText = Math.round(fat)+'g';
        }

        // --- FTP/CP ---
        let calcMode = 'ftp';
        function switchCalcMode(m) {
            calcMode = m;
            document.getElementById('btn-mode-ftp').className = m==='ftp' ? "flex-1 py-3 bg-cyan-900/50 neon-border font-bold uppercase text-cyan-400" : "flex-1 py-3 bg-black/50 border border-cyan-900 font-bold uppercase text-cyan-600";
            document.getElementById('btn-mode-cp').className = m==='cp' ? "flex-1 py-3 bg-orange-900/50 neon-border-orange font-bold uppercase text-orange-400" : "flex-1 py-3 bg-black/50 border border-cyan-900 font-bold uppercase text-cyan-600";
            document.getElementById('ftpForm').classList.toggle('hidden', m!=='ftp'); document.getElementById('cpForm').classList.toggle('hidden', m!=='cp');
            document.getElementById('res-main-label').innerText = m==='ftp' ? "Functional Threshold Power (FTP)" : "Critical Power (CP)";
            document.getElementById('res-main-val').className = m==='ftp' ? "text-6xl font-extrabold neon-text" : "text-6xl font-extrabold neon-text-orange";
            document.getElementById('res-wprime-container').classList.toggle('hidden', m!=='cp');
            document.getElementById('desc-ftp').classList.toggle('hidden', m!=='ftp');
            document.getElementById('desc-cp').classList.toggle('hidden', m!=='cp');
            calculateFtpCp();
        }
        function calculateFtpCp() {
            let tp = 0, hr = 0;
            if (calcMode === 'ftp') {
                const d = parseFloat(document.getElementById('ftp-durata').value)||20, w = parseFloat(document.getElementById('ftp-watt').value)||0; hr = parseFloat(document.getElementById('ftp-bpm').value)||0;
                if(w>0) tp = w * (d>=60 ? 1.0 : (d>20 ? 0.95+((d-20)/40)*0.05 : 0.95-((20-d)/20)*0.05));
            } else {
                const db = parseFloat(document.getElementById('cp-durata-breve').value)||3, wb = parseFloat(document.getElementById('cp-watt-breve').value)||0;
                const dl = parseFloat(document.getElementById('cp-durata-lunga').value)||12, wl = parseFloat(document.getElementById('cp-watt-lunga').value)||0; hr = parseFloat(document.getElementById('cp-bpm-lunga').value)||0;
                if(wb>0 && wl>0 && dl>db) { const t1=db*60, t2=dl*60; tp = ((wl*t2)-(wb*t1))/(t2-t1); document.getElementById('res-wprime-val').innerText = (((wb*t1)-(tp*t1))/1000).toFixed(1); }
            }
            document.getElementById('res-main-val').innerText = Math.round(tp)||0;
            const pCont = document.getElementById('zone-power-container');
            if(!tp||tp<=0) pCont.innerHTML = '<div class="text-cyan-500/50 col-span-2">Inserisci dati.</div>';
            else {
                const z=[{n:"Z1",m:0,mx:0.55,c:"text-gray-400"},{n:"Z2",m:0.56,mx:0.75,c:"text-blue-400"},{n:"Z3",m:0.76,mx:0.90,c:"text-green-400"},{n:"Z4",m:0.91,mx:1.05,c:"text-yellow-400"},{n:"Z5",m:1.06,mx:1.20,c:"text-orange-400"},{n:"Z6",m:1.21,mx:1.50,c:"text-red-400"},{n:"Z7",m:1.51,mx:9.99,c:"text-purple-400"}];
                pCont.innerHTML = z.map(i=>`<div class="flex justify-between bg-black/40 p-2 border border-cyan-900"><span class="${i.c} font-bold">${i.n}</span><span class="text-cyan-100 font-mono">${i.m===1.51?'>'+Math.round(tp*1.51):Math.round(tp*i.m)+'-'+Math.round(tp*i.mx)} W</span></div>`).join('');
            }
            const hrW = document.getElementById('hr-zones-wrapper'), hrC = document.getElementById('zone-hr-container');
            if(!hr||hr<=0) hrW.classList.add('hidden');
            else {
                hrW.classList.remove('hidden');
                const hz=[{n:"Z1",m:0,mx:0.81},{n:"Z2",m:0.82,mx:0.89},{n:"Z3",m:0.90,mx:0.93},{n:"Z4",m:0.94,mx:0.99},{n:"Z5a",m:1.00,mx:1.02},{n:"Z5b",m:1.03,mx:1.05},{n:"Z5c",m:1.06,mx:2.0}];
                hrC.innerHTML = hz.map(i=>`<div class="flex justify-between bg-black/40 p-2 border border-orange-900"><span class="text-orange-300 font-bold">${i.n}</span><span class="text-orange-100 font-mono">${i.m===1.06?'>'+Math.round(hr*1.06):Math.round(hr*i.m)+'-'+Math.round(hr*i.mx)} BPM</span></div>`).join('');
            }
        }

        // --- HYDRATION ---
        function calculateHydration() {
            const ratio = document.querySelector('input[name="hyd-ratio"]:checked')?.value || '2:1';
            const vol = parseFloat(document.getElementById('hyd-volume').value) || 750, inC = document.getElementById('hyd-carbs');
            const max = Math.round(vol * 0.5); inC.max = max;
            let carbs = parseFloat(inC.value) || 0;
            if (carbs > max) { carbs = max; inC.value = max; document.getElementById('hyd-warning').innerText=`Limite! Max ${max}g`; document.getElementById('hyd-warning').classList.remove('hidden'); }
            else document.getElementById('hyd-warning').classList.add('hidden'); 
            
            const salt = parseFloat(document.getElementById('hyd-salt').value) || 0;
            document.getElementById('hyd-salt-val').innerText = salt.toFixed(1) + 'g';

            const malto = ratio === '2:1' ? (carbs/3)*2 : carbs/1.8, fruct = ratio === '2:1' ? carbs/3 : malto*0.8;
            document.getElementById('res-malto').innerText = Math.round(malto) + 'g'; document.getElementById('res-fruct').innerText = Math.round(fruct) + 'g'; document.getElementById('res-nacl').innerText = salt.toFixed(1) + 'g';

            const conc = (carbs / vol) * 100; document.getElementById('res-conc-percent').innerText = conc.toFixed(1) + '%';
            const bdg = document.getElementById('res-tonicity'), bB = document.getElementById('bottle-ui'), bC = document.getElementById('bottle-cap-ui');
            if (conc < 6) { bdg.innerText="Ipotonica"; bdg.className="text-center py-2 rounded font-bold uppercase border border-blue-500 bg-blue-900/20 text-blue-300 mt-2"; bB.style.borderColor="#3b82f6"; bC.style.borderColor="#3b82f6"; document.getElementById('desc-tonicity-text').innerHTML="Ideale per rapido svuotamento gastrico in climi roventi.";}
            else if (conc <= 8) { bdg.innerText="Isotonica"; bdg.className="text-center py-2 rounded font-bold uppercase border border-green-500 bg-green-900/20 text-green-300 mt-2"; bB.style.borderColor="#22c55e"; bC.style.borderColor="#22c55e"; document.getElementById('desc-tonicity-text').innerHTML="Il Golden Standard: equilibrio perfetto tra idratazione ed energia.";}
            else if (conc <= 15) { bdg.innerText="Ipertonica"; bdg.className="text-center py-2 rounded font-bold uppercase border border-red-500 bg-red-900/20 text-red-300 mt-2"; bB.style.borderColor="#ef4444"; bC.style.borderColor="#ef4444"; document.getElementById('desc-tonicity-text').innerHTML="Lenta da digerire, alta energia. Attenzione a disturbi GI.";}
            else { bdg.innerText="Hyper-Gel"; bdg.className="text-center py-2 rounded font-bold uppercase border border-purple-500 bg-purple-900/20 text-purple-300 mt-2"; bB.style.borderColor="#a855f7"; bC.style.borderColor="#a855f7"; document.getElementById('desc-tonicity-text').innerHTML="Saturazione estrema. Devi assolutamente bere da una seconda borraccia con acqua liscia per digerirlo!";}

            document.getElementById('desc-ratio-21').classList.toggle('hidden', ratio!=='2:1');
            document.getElementById('desc-ratio-108').classList.toggle('hidden', ratio!=='1:0.8');

            const fr = carbs / max;
            document.getElementById('liq-malto').style.height = Math.max(2, (malto/carbs)*(fr*85)) + '%'; document.getElementById('liq-fruct').style.height = Math.max(2, (fruct/carbs)*(fr*85)) + '%';
        }

        // --- PERFORMANCE ---
        function syncPerfFormWithStorage() {
            const sd = sessionStorage.getItem('mirabiwatt_user_data');
            if(sd) { const ud = JSON.parse(sd); if(ud.peso) document.getElementById('perf-peso-atleta').value = ud.peso; if(ud.pesoBici) document.getElementById('perf-peso-bici').value = ud.pesoBici; }
        }
        function calculatePerformance() {
            const pA = parseFloat(document.getElementById('perf-peso-atleta').value)||0, pB = parseFloat(document.getElementById('perf-peso-bici').value)||8.5;
            const dist = parseFloat(document.getElementById('perf-distanza').value)||0, elev = parseFloat(document.getElementById('perf-dislivello').value)||0, vKmh = parseFloat(document.getElementById('perf-speed').value)||0;
            if(pA===0 || vKmh===0) return;
            const pSist = pA + pB, grad = dist > 0 ? (elev/(dist*1000))*100 : 0, vMps = vKmh / 3.6;
            const pR = pSist * 9.81 * 0.004 * vMps, pAe = 0.5 * 1.225 * 0.32 * Math.pow(vMps, 3), pG = pSist * 9.81 * Math.sin(Math.atan(grad/100)) * vMps;
            const pFin = ((pR+pAe+pG)/0.97)>0 ? (pR+pAe+pG)/0.97 : 0;
            document.getElementById('res-perf-watt').innerText = Math.round(pFin); document.getElementById('res-perf-wkg').innerText = (pFin/pA).toFixed(2)+' W/kg';
            document.getElementById('res-perf-time').innerText = dist>0 ? formatTimeFromHours(dist/vKmh) : "00:00";
            if(pR+pAe+pG > 0) {
                const tot = Math.max(5,pR) + Math.max(5,pAe) + Math.max(0,pG);
                document.getElementById('bar-rolling').style.width = (Math.max(5,pR)/tot)*100+'%'; document.getElementById('bar-aero').style.width = (Math.max(5,pAe)/tot)*100+'%'; document.getElementById('bar-gravity').style.width = (Math.max(0,pG)/tot)*100+'%';
            }
        }

        // --- CLIMB & STRAVA ---
        let currentClimbIsStrava = false;
        function syncClimbFormWithStorage() {
            const sd = sessionStorage.getItem('mirabiwatt_user_data');
            if(sd) { const ud = JSON.parse(sd); if(ud.peso) document.getElementById('climb-peso-atleta').value = ud.peso; if(ud.pesoBici) document.getElementById('climb-peso-bici').value = ud.pesoBici; }
        }
        function switchClimbMode(m) {
            document.getElementById('climb-graphic-container').classList.add('hidden'); currentClimbIsStrava = false;
            document.getElementById('btn-mode-strava').className = m==='strava' ? "flex-1 py-2 bg-orange-900/50 neon-border-orange font-bold uppercase text-orange-400 text-xs flex justify-center items-center gap-2" : "flex-1 py-2 bg-black/50 border border-cyan-900 hover:border-cyan-500 font-bold uppercase text-cyan-600 transition-all text-xs flex justify-center items-center gap-2";
            document.getElementById('btn-mode-manual').className = m==='manual' ? "flex-1 py-2 bg-cyan-900/50 neon-border font-bold uppercase text-cyan-400 text-xs" : "flex-1 py-2 bg-black/50 border border-cyan-900 hover:border-cyan-500 font-bold uppercase text-cyan-600 transition-all text-xs";
            document.getElementById('climb-strava-form').classList.toggle('hidden', m!=='strava');
        }

        async function fetchStravaSegment() {
            const match = document.getElementById('climb-strava-id').value.match(/(\d+)/);
            if(!match) return alert("Inserisci un ID numerico o un link di un segmento Strava valido.");
            const segmentId = match[0];
            
            const loadingUI = document.getElementById('strava-loading');
            loadingUI.classList.remove('hidden');

            try {
                // Modifica questo URL col nome del tuo proxy
                const response = await fetch(`https://strava-proxy.tiziano-speranza.workers.dev/api/segment/${segmentId}`);
                if (!response.ok) throw new Error('Errore o Segmento non trovato su Strava');
                const data = await response.json();

                document.getElementById('climb-dist').value = (data.distance / 1000).toFixed(2);
                document.getElementById('climb-elev').value = data.total_elevation_gain.toFixed(0);
                
                currentClimbIsStrava = true;
                calculateClimb(); 
            } catch (error) {
                console.error(error);
                alert("Errore nella comunicazione con il Proxy Cloudflare o segmento inesistente.");
            } finally {
                loadingUI.classList.add('hidden');
            }
        }

        function renderElevationProfile(dist, elev, grad, isStrava) {
            const c = document.getElementById('climb-graphic-container'), wId = document.getElementById('svg-wrapper'), bdg = document.getElementById('graphic-badge');
            if(!c) return; c.classList.remove('hidden');
            const w = 1000, h = 200, padY = 30;
            let pD = `M 0,${h} `, tD = `M 0,${h-10} `;

            if(isStrava) {
                bdg.innerText = "STRAVA SEGMENT DATA"; bdg.className = "ml-auto text-[9px] bg-orange-900/50 px-2 py-1 rounded text-orange-400 border border-orange-500/50";
                const pts = 25;
                for(let i=0; i<=pts; i++) {
                    let sX = (w/pts)*i, bY = (h-10) - ((h-padY)*(i/pts)), ns = (i>0&&i<pts) ? (Math.sin(i*1.5)*15)+(Math.cos(i*0.5)*5) : 0;
                    let fY = i===0?h-10:(i===pts?padY:bY+ns);
                    pD += `L ${sX},${fY} `; tD += i===0 ? `M ${sX},${fY} ` : `L ${sX},${fY} `;
                }
                pD += `L ${w},${h} Z`;
            } else {
                bdg.innerText = "MANUAL GENERATED"; bdg.className = "ml-auto text-[9px] bg-cyan-900/50 px-2 py-1 rounded text-cyan-200 border border-cyan-500/50";
                let eY = grad < 2.5 ? h-40 : padY;
                pD += `L 0,${h-10} L ${w},${eY} L ${w},${h} Z`; tD = `M 0,${h-10} L ${w},${eY}`;
            }
            const col = isStrava ? '#fb923c' : '#38bdf8', shd = 'transparent';
            wId.innerHTML = `<svg viewBox="0 0 ${w} ${h}" class="w-full h-full" preserveAspectRatio="none"><defs><linearGradient id="gradPath" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${col}" stop-opacity="0.6"/><stop offset="100%" stop-color="${col}" stop-opacity="0.0"/></linearGradient></defs><line x1="0" y1="${h/4}" x2="${w}" y2="${h/4}" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="5,5" /><line x1="0" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="5,5" /><line x1="0" y1="${(h/4)*3}" x2="${w}" y2="${(h/4)*3}" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="5,5" /><path d="${pD}" fill="url(#gradPath)" class="animate-[fadeIn_0.5s_ease-out]" /><path d="${tD}" fill="none" stroke="${col}" stroke-width="4" style="filter: drop-shadow(0px -2px 5px ${shd});" /><text x="10" y="20" fill="rgba(255,255,255,0.8)" font-size="14" font-family="monospace" font-weight="bold">Start</text><circle cx="10" cy="${h-10}" r="4" fill="white" /><text x="${w-10}" y="20" fill="${col}" font-size="16" font-family="monospace" font-weight="bold" text-anchor="end">${elev}m D+</text><circle cx="${w}" cy="${padY}" r="4" fill="${col}" style="filter: drop-shadow(0px 0px 5px ${col});" /><rect x="${w/2 - 70}" y="${h-22}" width="140" height="18" fill="black" rx="4" stroke="${col}" stroke-opacity="0.5" /><text x="${w/2}" y="${h-9}" fill="rgba(255,255,255,0.9)" font-size="12" font-family="monospace" font-weight="bold" text-anchor="middle">${dist} km @ ${grad.toFixed(1)}%</text></svg>`;
        }

        function calculateClimb() {
            const iD = document.getElementById('climb-dist'), iE = document.getElementById('climb-elev');
            const dist = parseFloat(iD.value)||0, elev = parseFloat(iE.value)||0;
            const pA = parseFloat(document.getElementById('climb-peso-atleta').value)||0, pB = parseFloat(document.getElementById('climb-peso-bici').value)||8.5;
            
            // Attacco al KOM target watt
            const tWatt = parseFloat(document.getElementById('climb-target-watt').value) || 0;

            iD.oninput = () => { currentClimbIsStrava=false; calculateClimb(); }; 
            iE.oninput = () => { currentClimbIsStrava=false; calculateClimb(); };

            const komBox = document.getElementById('kom-result-box');
            if(dist===0||elev===0||pA===0) {
                document.getElementById('climb-graphic-container').classList.add('hidden');
                komBox.classList.add('hidden');
                return;
            }

            const grad = (elev/(dist*1000))*100; document.getElementById('climb-grad').value = grad.toFixed(1);
            const isClimb = grad >= 3.0, pSist = pA + pB;
            
            renderElevationProfile(dist, elev, grad, currentClimbIsStrava);
            document.getElementById('climb-metric-header').innerText = isClimb ? 'VAM (m/h)' : 'Velocità Stima';
            
            // Logica Attacco al KOM (Inversa: trova il tempo partendo dai Watt)
            if(tWatt > 0) {
                const speedKmh = getSpeedForTargetPower(tWatt, grad, pSist);
                const timeHours = dist / speedKmh;
                document.getElementById('res-climb-kom-time').innerText = formatTimeFromHours(timeHours);
                document.getElementById('res-climb-kom-speed').innerText = speedKmh.toFixed(1) + ' km/h';
                document.getElementById('res-climb-kom-vam').innerText = isClimb ? Math.round(speedKmh * (grad*10)) + ' VAM' : '- VAM';
                komBox.classList.remove('hidden');
            } else {
                komBox.classList.add('hidden');
            }

            // Matrice Predittiva Generale
            const tbody = document.getElementById('climb-table-body'); tbody.innerHTML = '';
            if (isClimb) {
                const vams = [{n:"Cicloturista",v:600,c:"text-gray-400"},{n:"Amatore Base",v:800,c:"text-blue-400"},{n:"Allenato",v:1000,c:"text-green-400"},{n:"Granfondista",v:1200,c:"text-yellow-400"},{n:"Elite",v:1400,c:"text-orange-400"},{n:"Pro",v:1600,c:"text-red-400"},{n:"Alieno",v:1800,c:"text-purple-400"}];
                vams.forEach(i => { const tH = elev/i.v; const w = getRequiredPowerForSpeed(dist/tH, grad, pSist); tbody.insertAdjacentHTML('beforeend', `<tr class="border-b border-cyan-900/30 table-row-hover"><td class="p-3 ${i.c} font-bold text-xs uppercase">${i.n}</td><td class="p-3 text-white">${formatTimeFromHours(tH)}</td><td class="p-3 text-cyan-300 font-bold">${i.v} <span class="text-[10px] text-cyan-600">m/h</span></td><td class="p-3 text-orange-400 font-bold">${Math.round(w)} W</td><td class="p-3 text-orange-200">${(w/pA).toFixed(2)} W/kg</td></tr>`); });
            } else {
                const spds = [{n:"Recupero",v:25,c:"text-gray-400"},{n:"Endurance",v:30,c:"text-blue-400"},{n:"Tempo",v:35,c:"text-green-400"},{n:"Soglia",v:40,c:"text-yellow-400"},{n:"Fuga Pro",v:45,c:"text-red-400"},{n:"Volata",v:55,c:"text-purple-400"}];
                spds.forEach(i => { const w = getRequiredPowerForSpeed(i.v, grad, pSist); tbody.insertAdjacentHTML('beforeend', `<tr class="border-b border-cyan-900/30 table-row-hover"><td class="p-3 ${i.c} font-bold text-xs uppercase">${i.n}</td><td class="p-3 text-white">${formatTimeFromHours(dist/i.v)}</td><td class="p-3 text-cyan-300 font-bold">${i.v} <span class="text-[10px] text-cyan-600">km/h</span></td><td class="p-3 text-orange-400 font-bold">${Math.round(w)} W</td><td class="p-3 text-orange-200">${(w/pA).toFixed(2)} W/kg</td></tr>`); });
            }
        }

        // --- WEEK TRAINING TEMPLATES ---
        const workoutLibrary = { rest: { id: 'rest', t: "Riposo / Off", c: "intensity-rest", d: "Off o Stretching", tss: 0 }, endurance: { id: 'endurance', t: "Z2 Endurance", c: "intensity-z2", d: "Passeggiata aerobica", tss: 45 }, sweetspot: { id: 'sweetspot', t: "Sweet Spot", c: "intensity-z3", d: "Intervalli Sub-Soglia", tss: 75 }, tempo: { id: 'tempo', t: "Z3 Tempo", c: "intensity-z3", d: "Sforzo costante", tss: 60 }, seiler: { id: 'seiler', t: "Seiler 4x8m", c: "intensity-z5", d: "4x8m @ 105% FTP", tss: 85 }, ronnestad: { id: 'ronnestad', t: "Rønnestad 30/15", c: "intensity-z6", d: "Micro-intervalli VO2", tss: 90 }, openers: { id: 'openers', t: "Openers", c: "intensity-z4", d: "Attivazione neurale", tss: 50 }, longride: { id: 'longride', t: "Lungo Aerobico", c: "intensity-z2", d: "Volume e Resistenza", tss: 50 }, sprint: { id: 'sprint', t: "Sprint Ana", c: "intensity-z6", d: "Ripetute brevi max", tss: 75 }, race: { id: 'race', t: "Gara / Evento", c: "intensity-z6", d: "Pacing libero All-Out", tss: 100 } };
        const workoutVariants = { rest: [ "Riposo totale", "Passeggiata leggera a piedi (30m)", "Stretching, Yoga e Foam Roller" ], endurance: [ "Z2 Costante", "Z2 con variazioni di cadenza agili", "Z2 + 3 sprint brevi" ], sweetspot: [ "3x15m @ 90% FTP", "2x20m @ 88% FTP", "4x10m @ 92%" ], tempo: [ "3x20m @ 80% FTP", "Lavoro intero @ 85% FTP", "Over/Under: 3x(10m Z3 / 2m Z4)" ], seiler: [ "4x8m @ 105% FTP", "Progressione: 100%, 102%, 105%, 108%", "Fast Start: Primi 30s @ 120%" ], ronnestad: [ "3 serie da 13x(30/15s)", "Variante: 2 serie da 15x(40/20s)", "Hill: 3 serie da 10x(30/15s) in salita" ], openers: [ "3x1m Z5 + 3x30s Z6", "Sprints: 5x15s All-out", "Progressione: 2x5m (Z2->Z4)" ], longride: [ "Distanza pura Z2", "Lungo collinare in Z3", "Z2 + Ultima mezz'ora ritmo gara" ], sprint: [ "5x15s Max", "Micro-sprint: 10x10s", "Attacchi: 3x(30s Z6 + 2m Z4)" ], race: [ "Gara Target A", "Gara B / Allenante", "Uscita competitiva di gruppo" ] };
        function syncTrainingForm() { const sd = sessionStorage.getItem('mirabiwatt_user_data'); let liv = "Intermedio", ore = 8; if(sd) { const ud = JSON.parse(sd); if(ud.livelloCiclista) liv = ud.livelloCiclista; if(ud.oreSettimanali) ore = parseFloat(ud.oreSettimanali); } document.getElementById('lbl-train-level').innerText = liv; document.getElementById('lbl-train-vol').innerText = ore + " Ore/Sett"; }
        function showWorkoutVariations(workId, dayName, hrs) { if(hrs <= 0 && workId !== 'rest') return; const work = workoutLibrary[workId]; const vars = workoutVariants[workId] || workoutVariants['endurance']; document.getElementById('workout-modal-subtitle').innerText = `${dayName} - ${work.t} (${hrs > 0 ? hrs.toFixed(1)+'h' : 'Libero'})`; document.getElementById('workout-variants-list').innerHTML = vars.map((v, idx) => `<div class="p-3 bg-black/50 border border-cyan-800 rounded hover:border-cyan-400 transition-colors cursor-pointer" onclick="closeModal('workoutModal')"><span class="text-[10px] text-cyan-500 uppercase font-bold block mb-1">Opzione ${idx+1}</span><span class="text-sm text-cyan-100">${v}</span></div>`).join(''); openModal('workoutModal'); }

        function generateTrainingPlan() {
            const sd = sessionStorage.getItem('mirabiwatt_user_data');
            let livello = "Intermedio"; let oreTotali = 8;
            if(sd) { const ud = JSON.parse(sd); if(ud.livelloCiclista) livello = ud.livelloCiclista; if(ud.oreSettimanali) oreTotali = parseFloat(ud.oreSettimanali) || 8; }
            const template = document.getElementById('train-template').value;
            let volumeTarget = oreTotali; let htmlText = ""; const days = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
            let hDist = [0, volumeTarget*0.15, volumeTarget*0.1, volumeTarget*0.15, 0, volumeTarget*0.4, volumeTarget*0.2]; const plan = [];

            switch(template) {
                case 'base': htmlText = `<p><strong class="text-blue-400">Template Base / Endurance:</strong> Struttura classica per il periodo invernale o l'inizio stagione. Volume alto, quasi esclusivamente dedicato alla Zona 2 (FatMax).</p><p><strong class="text-green-400">Pro:</strong> Sviluppa un'enorme densità mitocondriale e capillarizzazione periferica senza affaticare il sistema nervoso centrale. Rischio di infortuni minimo.</p><p><strong class="text-red-400">Contro:</strong> Richiede moltissimo tempo a disposizione. Diventa noioso sui rulli e non aumenta l'esplosività o la VAM di picco.</p>`; hDist.forEach((hrs, i) => { let w = workoutLibrary.rest; if(hrs > 0) { if(i === 3) w = workoutLibrary.tempo; else if(i === 5 || i === 6) w = workoutLibrary.longride; else w = workoutLibrary.endurance; } plan.push({ day: days[i], hrs: hrs, work: w }); }); break;
                case 'polarized': htmlText = `<p><strong class="text-purple-400">Polarized Week (Seiler 80/20):</strong> Basato sugli studi di Stephen Seiler. L'80% delle sessioni (non del tempo) è a bassissima intensità (Z1/Z2), il 20% è altissima intensità (Z5/Z6). La Zona 3/4 (Tempo/SweetSpot) viene volutamente ignorata (il famoso "Black Hole").</p><p><strong class="text-green-400">Pro:</strong> Massimizza gli adattamenti del VO2 Max e preserva la freschezza per spingere fortissimo nei giorni Hard.</p><p><strong class="text-red-400">Contro:</strong> Le sessioni HIIT (come i 4x8 di Seiler o i Rønnestad) sono mentalmente e fisicamente devastanti. Non allena la resistenza a ritmi gara medi.</p>`; hDist.forEach((hrs, i) => { let w = workoutLibrary.rest; if(hrs > 0) { if(i === 1) w = (livello === 'Avanzato' || livello === 'Elite') ? workoutLibrary.ronnestad : workoutLibrary.seiler; else if(i === 4) w = workoutLibrary.seiler; else if(i === 5 || i === 6) w = workoutLibrary.longride; else w = workoutLibrary.endurance; } plan.push({ day: days[i], hrs: hrs, work: w }); }); plan[3].hrs = 0; plan[3].work = workoutLibrary.rest; plan[4].hrs = volumeTarget*0.15; plan[4].work = workoutLibrary.seiler; break;
                case 'sweetspot': htmlText = `<p><strong class="text-yellow-400">Sweet Spot / Threshold Week:</strong> Il focus è sulla zona compresa tra l'88% e il 93% della FTP. L'obiettivo è spingere la soglia lattacida dal basso verso l'alto.</p><p><strong class="text-green-400">Pro:</strong> Miglior rapporto "Bang for the Buck" (costo/beneficio). Innalza pesantemente la FTP e genera tantissimo TSS in relativamente poco tempo. Perfetto per le Granfondo.</p><p><strong class="text-red-400">Contro:</strong> Genera molta "fatica cronica". È facile finire in overtraining se non si inseriscono settimane di scarico dopo 2 o 3 settimane di carico consecutivo in Sweet Spot.</p>`; hDist.forEach((hrs, i) => { let w = workoutLibrary.rest; if(hrs > 0) { if(i === 1 || i === 3) w = workoutLibrary.sweetspot; else if(i === 5) w = workoutLibrary.longride; else if(i === 6) w = workoutLibrary.tempo; else w = workoutLibrary.endurance; } plan.push({ day: days[i], hrs: hrs, work: w }); }); break;
                case 'hiit': htmlText = `<p><strong class="text-orange-400">VO2 Max / HIIT Week:</strong> Settimana d'urto progettata per alzare il "tetto" aerobico (VO2 Max). Focus su intervalli brevi e violentissimi.</p><p><strong class="text-green-400">Pro:</strong> Innesca un rapido innalzamento della potenza anaerobica. Rompe lo stallo prestazionale quando la FTP non sale più (alzi il tetto per poter alzare i muri).</p><p><strong class="text-red-400">Contro:</strong> Il dolore è garantito. Il rischio di esaurimento è altissimo. Da usare al massimo per 2-3 settimane consecutive durante il periodo di "Build".</p>`; hDist.forEach((hrs, i) => { let w = workoutLibrary.rest; if(hrs > 0) { if(i === 1) w = workoutLibrary.ronnestad; else if(i === 3) w = workoutLibrary.sprint; else if(i === 5) w = workoutLibrary.seiler; else w = workoutLibrary.endurance; } plan.push({ day: days[i], hrs: hrs, work: w }); }); break;
                case 'timecrunched': volumeTarget = Math.min(oreTotali, 6.0); hDist = [0, volumeTarget*0.3, 0, volumeTarget*0.3, 0, volumeTarget*0.4, 0]; htmlText = `<p><strong class="text-red-400">Time-Crunched Week (Carmichael):</strong> Template ottimizzato per atleti che lavorano e hanno pochissimo tempo (<6 ore a settimana). Il volume spazzatura viene rimosso del tutto a favore di altissima densità.</p><p><strong class="text-green-400">Pro:</strong> Permette di sviluppare una forma "Race-Winning" e ottima FTP pur avendo a malapena il tempo di uscire nel weekend.</p><p><strong class="text-red-400">Contro:</strong> La forma (fitness) sviluppata è molto "fragile". Decade rapidamente dopo poche settimane di stop, a causa della mancanza cronica di capillarizzazione data dalle lunghe distanze aerobiche.</p>`; hDist.forEach((hrs, i) => { let w = workoutLibrary.rest; if(hrs > 0) { if(i === 1) w = workoutLibrary.seiler; else if(i === 3) w = workoutLibrary.sweetspot; else if(i === 5) w = workoutLibrary.longride; } plan.push({ day: days[i], hrs: hrs, work: w }); }); break;
                case 'recovery': volumeTarget = oreTotali * 0.5; hDist = [0, volumeTarget*0.3, 0, volumeTarget*0.3, 0, volumeTarget*0.4, 0]; htmlText = `<p><strong class="text-gray-400">Recovery / Settimana di Scarico:</strong> Il volume è tagliato del 50% e l'intensità è strettamente limitata alla Z1/Z2 (Recupero Attivo).</p><p><strong class="text-green-400">Pro:</strong> È il momento in cui si migliora davvero! Permette al corpo di attuare la "Supercompensazione", smaltendo la fatica accumulata nei blocchi precedenti e ricostruendo i tessuti.</p><p><strong class="text-red-400">Contro:</strong> Psicologicamente difficile per molti atleti che si sentono "lenti" o pensano di perdere l'allenamento. Richiede molta disciplina per non spingere sui pedali.</p>`; hDist.forEach((hrs, i) => { let w = workoutLibrary.rest; if(hrs > 0) w = workoutLibrary.endurance; plan.push({ day: days[i], hrs: hrs, work: w }); }); break;
                case 'taper': volumeTarget = oreTotali * 0.6; htmlText = `<p><strong class="text-cyan-400">Tapering / Settimana Pre-Gara:</strong> L'obiettivo è scaricare la Fatica pur mantenendo intatta la Forma (Fitness). Il volume si riduce drasticamente, ma l'intensità resta alta con lavori brevi.</p><p><strong class="text-green-400">Pro:</strong> Porta l'atleta al picco di forma (Form = Fitness - Fatigue). Sistema nervoso pronto ed esplosivo per la gara della Domenica.</p><p><strong class="text-red-400">Contro:</strong> I primissimi giorni della settimana le gambe possono sembrare "vuote" o bloccate a causa della brusca variazione ormonale di scarico.</p>`; hDist.forEach((hrs, i) => { let w = workoutLibrary.rest; if(hrs > 0) { if(i === 1) w = workoutLibrary.openers; else if(i === 3) w = workoutLibrary.tempo; else if(i === 5) w = workoutLibrary.openers; else if(i === 6) w = workoutLibrary.race; else w = workoutLibrary.endurance; } plan.push({ day: days[i], hrs: hrs, work: w }); }); break;
            }

            let totalTss = 0; plan.forEach(p => { totalTss += (p.hrs * p.work.tss); });
            document.getElementById('res-train-vol').innerText = volumeTarget.toFixed(1) + 'h';
            document.getElementById('res-train-tss').innerText = Math.round(totalTss);
            document.getElementById('train-science-desc').innerHTML = htmlText;
            document.getElementById('calendar-grid').innerHTML = plan.map(p => `<div class="day-card ${p.work.c}" onclick="showWorkoutVariations('${p.work.id}', '${p.day}', ${p.hrs})"><div class="day-header text-cyan-500 flex justify-between items-center">${p.day} <i data-lucide="info" class="w-3 h-3 text-cyan-500/50 hover:text-cyan-300"></i></div><div class="text-[10px] text-gray-400 mb-1">${p.hrs > 0 ? p.hrs.toFixed(1) + 'h' : '0h'}</div><div class="text-sm font-bold text-white leading-tight mb-2">${p.work.t}</div><div class="text-[10px] text-cyan-200/70 mt-auto">${p.hrs > 0 ? p.work.d : ''}</div></div>`).join('');
            lucide.createIcons();
        }

        document.addEventListener('DOMContentLoaded', () => { renderTools(); loadUserData(); });
    
        // il vecchio indirizzo index.html (e chi apre /#strumenti) arriva qui
        document.addEventListener('DOMContentLoaded', () => { if (location.hash === '#strumenti' && window.switchDashView) window.switchDashView('view-tools'); });
        Object.assign(window, { calculateClimb, calculateFtpCp, calculateHydration, calculateKcal, calculatePerformance, closeModal, fetchStravaSegment, generateTrainingPlan, openModal, saveUserData, showWorkoutVariations, switchCalcMode, switchClimbMode, switchView });
})();
