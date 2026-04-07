// ══════════════════════════════════════════════════════════════════════════════
//  AUTOMO_MOBILE.gs — Web App Mobile para FinControl 360 v3
//  07/04/2026 — CORRIGIDO: bancos col L, cartoes col U, info cartao S-X
//
//  DEPLOY:
//  1. Apps Script STANDALONE (1gO62H2vvAiHHQcqUs5AVf2vi0SgrEuYuz7yXKjXrdX9GOe9VJKUDx0Xp)
//  2. Arquivo AUTOMO_MOBILE > Ctrl+A > Delete > Cole > Ctrl+S
//  3. Implantar > Gerenciar implantacoes > Lapis > Nova versao > Implantar
//  4. URL no iPhone > Safari > Compartilhar > Tela de Inicio
//
//  MAPA CADASTROS (row 8+):
//  C(3)=Categorias, D(4)=Tipos, I(9)=Status, L(12)=Bancos,
//  S(19)=Banco cartao, T(20)=Nome cartao, U(21)=Display "Banco - Nome",
//  W(23)=Dia Fechamento, X(24)=Dia Vencimento
// ══════════════════════════════════════════════════════════════════════════════

var SS_ID = '1gLT93M40c0Ki-lJK79cCrUmpn9W8vI3lVB1S478ME9k';

function doGet(e) {
  return HtmlService.createHtmlOutput(_mobileHTML())
    .setTitle('FinControl 360')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no');
}

// ═══════════════════════════════════════════════════════════════
//  CADASTROS — le bancos, cartoes, categorias, status
// ═══════════════════════════════════════════════════════════════
function webGetCadastros() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName('Cadastros');
  if (!sh) return {categorias:[],bancos:[],cartoes:[],status:[],tipos:[]};
  var lr = sh.getLastRow();
  if (lr < 8) return {categorias:[],bancos:[],cartoes:[],status:[],tipos:[]};

  function col(c) {
    var v = [];
    try {
      var d = sh.getRange(8, c, lr - 7, 1).getValues();
      for (var i = 0; i < d.length; i++) {
        var s = String(d[i][0] || '').trim();
        // Filtrar CellImage e objetos que nao sao texto
        if (s !== '' && s.indexOf('CellImage') === -1 && s !== '[object Object]') v.push(s);
      }
    } catch(e) {}
    return v;
  }

  // Bancos — ler col M(13) que tem nome texto puro (col L tem IMAGE = CellImage)
  var bancos = [];
  try {
    var dB = sh.getRange(8, 13, lr - 7, 1).getValues(); // M = nome do banco
    for (var bi = 0; bi < dB.length; bi++) {
      var nomeBanco = String(dB[bi][0] || '').trim();
      if (nomeBanco === '' || nomeBanco.indexOf('CellImage') >= 0) continue;
      bancos.push(nomeBanco);
    }
  } catch(e) {}
  // Deduplica
  var bancosUnicos = [];
  for (var bu = 0; bu < bancos.length; bu++) {
    if (bancosUnicos.indexOf(bancos[bu]) === -1) bancosUnicos.push(bancos[bu]);
  }

  return {
    categorias: col(3),   // C
    tipos: col(4),        // D
    status: col(9),       // I
    bancos: bancosUnicos, // M
    cartoes: _getCartoes(sh, lr) // U ou S+T
  };
}

function _getCartoes(sh, lr) {
  var cartoes = [];
  try {
    // Tentar col U(21) primeiro
    var dU = sh.getRange(8, 21, lr - 7, 1).getValues();
    for (var i = 0; i < dU.length; i++) {
      var s = String(dU[i][0] || '').trim();
      if (s !== '' && s.indexOf('CellImage') === -1 && s !== '[object Object]') cartoes.push(s);
    }
  } catch(e) {}

  // Se col U veio vazia, montar a partir de S(19)+T(20)
  if (cartoes.length === 0) {
    try {
      var dST = sh.getRange(8, 19, lr - 7, 2).getValues(); // S-T
      for (var j = 0; j < dST.length; j++) {
        var banco = String(dST[j][0] || '').trim();
        var nome = String(dST[j][1] || '').trim();
        if (banco === '' || banco.indexOf('CellImage') >= 0) continue;
        if (nome === '' || nome.indexOf('CellImage') >= 0) continue;
        cartoes.push(banco + ' - ' + nome);
      }
    } catch(e) {}
  }

  // Deduplica
  var unicos = [];
  for (var k = 0; k < cartoes.length; k++) {
    if (unicos.indexOf(cartoes[k]) === -1) unicos.push(cartoes[k]);
  }
  return unicos;
}

// ═══════════════════════════════════════════════════════════════
//  KPIs do mes
// ═══════════════════════════════════════════════════════════════
function webResumoMensal(mes, ano) {
  var ss = SpreadsheetApp.openById(SS_ID);
  var tRec=0,tDesp=0,tCred=0,nLanc=0;

  var shL = ss.getSheetByName('Lancamentos') || ss.getSheetByName('Lançamentos');
  if (shL && shL.getLastRow() >= 2) {
    var dL = shL.getRange(2, 2, shL.getLastRow()-1, 9).getValues();
    for (var i = 0; i < dL.length; i++) {
      if (!dL[i][0]) continue;
      var dt = new Date(dL[i][0]); if (isNaN(dt.getTime())) continue;
      if (dt.getMonth()+1 !== mes || dt.getFullYear() !== ano) continue;
      nLanc++;
      var tp = String(dL[i][7] || '').toLowerCase().trim();
      var vl = parseFloat(dL[i][8]) || 0;
      if (tp === 'entrada' || tp === 'receita') tRec += vl; else tDesp += vl;
    }
  }

  var shC = ss.getSheetByName('Credito') || ss.getSheetByName('Crédito');
  if (shC && shC.getLastRow() >= 8) {
    var dC = shC.getRange(8, 2, shC.getLastRow()-7, 9).getValues();
    for (var ci = 0; ci < dC.length; ci++) {
      var vc = dC[ci][8]; if (!vc) continue;
      var dv = new Date(vc); if (isNaN(dv.getTime())) continue;
      if (dv.getMonth()+1 === mes && dv.getFullYear() === ano) tCred += parseFloat(dC[ci][6]) || 0;
    }
  }

  var shCr = ss.getSheetByName('Gerenciamento de crise');
  var tCrise=0, tCrPago=0;
  if (shCr && shCr.getLastRow() >= 8) {
    var dCr = shCr.getRange(8, 1, shCr.getLastRow()-7, 20).getValues();
    for (var cri = 0; cri < dCr.length; cri++) {
      var vd = parseFloat(dCr[cri][8]) || 0; tCrise += vd;
      if (String(dCr[cri][11] || '').toLowerCase().indexOf('pago') >= 0) tCrPago += vd;
    }
  }

  return {receitas:tRec, despesas:tDesp, credito:tCred, saldo:tRec-tDesp-tCred, lancamentos:nLanc, crise:tCrise, crisePago:tCrPago};
}

// Achar proxima linha vazia escaneando coluna especifica (nunca usar getLastRow)
function _proxLinha(sh, colScan, minRow) {
  var last = sh.getMaxRows();
  if (last < minRow) return minRow;
  var scanSize = Math.min(last - minRow + 1, 5000);
  if (scanSize <= 0) return minRow;
  var vals = sh.getRange(minRow, colScan, scanSize, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (!vals[i][0] || String(vals[i][0]).trim() === '') return minRow + i;
  }
  return minRow + vals.length;
}

// ═══════════════════════════════════════════════════════════════
//  GRAVAR — Lancamento (B:M, NUNCA col F)
// ═══════════════════════════════════════════════════════════════
function webSalvarLanc(dados) {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName('Lancamentos') || ss.getSheetByName('Lançamentos');
  if (!sh) return {ok:false, erro:'Aba nao encontrada'};
  var lr = _proxLinha(sh, 4, 2); // scan col D (Descricao), dados row 2+

  var dtL = dados.data ? new Date(dados.data + 'T12:00:00') : new Date();
  var dtV = dados.vencimento ? new Date(dados.vencimento + 'T12:00:00') : dtL;

  // Extrair apenas o banco (sem a conta) para col G
  var bancoDisplay = String(dados.banco || '');

  sh.getRange(lr, 2).setValue(dtL);
  sh.getRange(lr, 3).setValue(dtV);
  sh.getRange(lr, 4).setValue(dados.descricao || '');
  sh.getRange(lr, 5).setValue(dados.parcela || '');
  // col 6 = F = Logo IMAGE — NUNCA MEXER
  sh.getRange(lr, 7).setValue(bancoDisplay);
  sh.getRange(lr, 8).setValue(dados.categoria || '');
  sh.getRange(lr, 9).setValue(dados.tipo || 'Saída');
  sh.getRange(lr, 10).setValue(parseFloat(dados.valor) || 0);
  sh.getRange(lr, 11).setValue(dados.status || 'Pendente');
  sh.getRange(lr, 13).setValue('MOB-' + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMddHHmmss'));

  return {ok:true, linha:lr};
}

// ═══════════════════════════════════════════════════════════════
//  GRAVAR — Credito (B,D,E,F,G,H,I — NUNCA col J)
// ═══════════════════════════════════════════════════════════════
function webSalvarCred(dados) {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName('Credito') || ss.getSheetByName('Crédito');
  if (!sh) return {ok:false, erro:'Aba nao encontrada'};
  var lr = _proxLinha(sh, 5, 8); // scan col E (Descricao), dados row 8+

  var dtC = dados.data ? new Date(dados.data + 'T12:00:00') : new Date();
  var vlrTotal = parseFloat(dados.valor) || 0;
  var numParc = parseInt(dados.parcelas) || 1;
  var vlrParc = numParc > 0 ? vlrTotal / numParc : vlrTotal;

  sh.getRange(lr, 2).setValue(dtC);
  // col C(3) = vazio
  sh.getRange(lr, 4).setValue(dados.cartao || ''); // D = Cartao (ex: "Itaú - Personalite")
  sh.getRange(lr, 5).setValue(dados.descricao || ''); // E = Descricao
  sh.getRange(lr, 6).setValue(dados.categoria || ''); // F = Categoria
  sh.getRange(lr, 7).setValue(vlrTotal);              // G = Valor Total
  sh.getRange(lr, 8).setValue(vlrParc);               // H = Valor Parcela
  sh.getRange(lr, 9).setValue(String(numParc));        // I = Parcela (TEXT!)
  // col J(10) = Vencimento — NAO MEXER, calculado pelo trigger

  return {ok:true, linha:lr, parcelas:numParc};
}

// ═══════════════════════════════════════════════════════════════
//  GRAVAR — Conta a Pagar
// ═══════════════════════════════════════════════════════════════
function webSalvarCP(dados) {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName('CONTAS A PAGAR');
  if (!sh) return {ok:false, erro:'Aba nao encontrada'};
  var lr = _proxLinha(sh, 4, 2); // scan col D (Descricao), dados row 2+

  var dtL = dados.data ? new Date(dados.data + 'T12:00:00') : new Date();
  var dtV = dados.vencimento ? new Date(dados.vencimento + 'T12:00:00') : dtL;

  sh.getRange(lr, 2).setValue(dtL);
  sh.getRange(lr, 3).setValue(dtV);
  sh.getRange(lr, 4).setValue(dados.descricao || '');
  sh.getRange(lr, 5).setValue(dados.parcela || '');
  sh.getRange(lr, 6).setValue(dados.banco || '');
  sh.getRange(lr, 8).setValue(dados.categoria || '');
  sh.getRange(lr, 9).setValue(dados.tipo || 'Saída');
  sh.getRange(lr, 10).setValue(parseFloat(dados.valor) || 0);
  sh.getRange(lr, 11).setValue(dados.status || 'Pendente');

  return {ok:true, linha:lr};
}

// ═══════════════════════════════════════════════════════════════
//  HTML MOBILE — Interface completa
// ═══════════════════════════════════════════════════════════════
function _mobileHTML() {
  var s = '';
  s += '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">';
  s += '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">';
  s += '<meta name="apple-mobile-web-app-capable" content="yes">';
  s += '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">';
  s += '<meta name="theme-color" content="#0a0a0f">';
  s += '<title>FinControl 360</title>';
  s += '<style>';

  // Reset & base
  s += '*{margin:0;padding:0;box-sizing:border-box}';
  s += 'body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;background:#0a0a0f;color:#e6edf3;';
  s += '-webkit-tap-highlight-color:transparent;padding-bottom:100px;min-height:100vh}';

  // Header
  s += '.hdr{background:linear-gradient(180deg,#111820 0%,#0d1117 100%);padding:env(safe-area-inset-top,16px) 16px 14px;';
  s += 'border-bottom:1px solid #1b2332}';
  s += '.hdr h1{font-size:20px;font-weight:800;letter-spacing:2px}';
  s += '.hdr .a{color:#8b949e}.hdr .g{color:#3fb950}';
  s += '.hdr .sub{font-size:10px;color:#484f58;margin-top:2px}';

  // KPIs
  s += '.kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:12px 14px}';
  s += '.kpi{background:#12171e;border:1px solid #1b2332;border-radius:12px;padding:12px 10px}';
  s += '.kpi .lb{font-size:9px;color:#636e7b;text-transform:uppercase;letter-spacing:.5px;font-weight:600}';
  s += '.kpi .vl{font-size:17px;font-weight:800;margin-top:3px;letter-spacing:-.3px}';
  s += '.kpi.r .vl{color:#3fb950}.kpi.d .vl{color:#f85149}.kpi.c .vl{color:#bc8cff}.kpi.s .vl{color:#58a6ff}';

  // Alert banner
  s += '.alrt{margin:0 14px 8px;border-radius:12px;padding:12px;display:none}';
  s += '.alrt.on{display:block}';
  s += '.alrt.danger{background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.3)}';
  s += '.alrt.warn{background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.3)}';
  s += '.alrt.info{background:rgba(88,166,255,.06);border:1px solid rgba(88,166,255,.2)}';
  s += '.alrt .at{font-size:12px;font-weight:800;margin-bottom:4px}';
  s += '.alrt.danger .at{color:#ff6b6b}.alrt.warn .at{color:#ffd700}.alrt.info .at{color:#58a6ff}';
  s += '.alrt .ad{font-size:10px;color:#8b949e;line-height:1.4}';
  s += '.alrt .ai{font-size:10px;margin-top:4px;padding:3px 6px;background:rgba(255,255,255,.05);border-radius:6px;color:#e6edf3}';

  // Tabs
  s += '.tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px 14px}';
  s += '.tab{background:#12171e;border:1.5px solid #1b2332;border-radius:12px;padding:12px 4px;text-align:center;';
  s += 'font-size:10px;color:#636e7b;cursor:pointer;transition:all .15s;font-weight:700}';
  s += '.tab.on{background:rgba(88,166,255,.08);border-color:#58a6ff;color:#58a6ff}';
  s += '.tab .ic{font-size:22px;display:block;margin-bottom:4px}';

  // Form
  s += '.fm{padding:0 14px 14px}';
  s += '.dest{background:rgba(88,166,255,.06);border:1px solid rgba(88,166,255,.2);border-radius:10px;';
  s += 'padding:8px 12px;margin-bottom:12px;font-size:11px;color:#58a6ff;text-align:center;font-weight:600}';
  s += 'label{display:block;font-size:9px;color:#636e7b;margin:10px 0 4px;text-transform:uppercase;letter-spacing:.5px;font-weight:700}';
  s += 'input,select{width:100%;padding:12px;background:#12171e;color:#e6edf3;border:1.5px solid #1b2332;';
  s += 'border-radius:10px;font-size:15px;-webkit-appearance:none;appearance:none;transition:border .15s}';
  s += 'select{background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath d=\'M3 5l3 3 3-3\' fill=\'none\' stroke=\'%23636e7b\' stroke-width=\'1.5\'/%3E%3C/svg%3E");';
  s += 'background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}';
  s += 'input:focus,select:focus{border-color:#58a6ff;outline:none;box-shadow:0 0 0 3px rgba(88,166,255,.1)}';
  s += '.row{display:flex;gap:10px}.row>div{flex:1}';

  // Button
  s += '.btn{width:100%;padding:16px;border:none;border-radius:14px;font-size:16px;font-weight:800;';
  s += 'cursor:pointer;margin-top:16px;transition:all .15s;letter-spacing:.5px}';
  s += '.btn-ok{background:linear-gradient(135deg,#238636,#2ea043);color:#fff}';
  s += '.btn-ok:active{transform:scale(.97);opacity:.9}';

  // Toast
  s += '.toast{position:fixed;bottom:24px;left:14px;right:14px;padding:16px;border-radius:14px;';
  s += 'font-size:14px;font-weight:700;text-align:center;transform:translateY(150px);transition:transform .3s;z-index:999}';
  s += '.toast.show{transform:translateY(0)}';
  s += '.toast.ok{background:#0d2818;color:#3fb950;border:1px solid #238636}';
  s += '.toast.er{background:#2d1214;color:#f85149;border:1px solid #da3633}';
  s += '.hide{display:none}';
  s += '.ld{text-align:center;padding:20px;color:#484f58;font-size:11px}';

  s += '</style></head><body>';

  // ── HEADER ──
  s += '<div class="hdr"><h1><span class="a">FIN</span><span class="g">CONTROL</span> <span style="color:#3fb950;font-size:14px">360\u00b0</span></h1>';
  s += '<div class="sub">Gestao Financeira</div></div>';

  // ── KPIs ──
  s += '<div class="kpis" id="kpis"><div class="ld">Carregando KPIs...</div></div>';

  // ── ALERTAS BANNER ──
  s += '<div class="alrt" id="alertBanner"></div>';

  // ── TABS ──
  s += '<div class="tabs">';
  s += '<div class="tab on" onclick="setTab(\'lanc\',this)"><span class="ic">&#128181;</span>Despesa</div>';
  s += '<div class="tab" onclick="setTab(\'rec\',this)"><span class="ic">&#128176;</span>Receita</div>';
  s += '<div class="tab" onclick="setTab(\'cart\',this)"><span class="ic">&#128179;</span>Cartao</div>';
  s += '<div class="tab" onclick="setTab(\'cp\',this)"><span class="ic">&#128197;</span>Conta</div>';
  s += '</div>';

  // ── FORM ──
  s += '<div class="fm">';
  s += '<div class="dest" id="dest">Destino: Lancamentos (Saida)</div>';

  // Data + Vencimento
  s += '<div class="row"><div><label>Data</label><input type="date" id="fData"></div>';
  s += '<div><label>Vencimento</label><input type="date" id="fVenc"></div></div>';

  // Descricao
  s += '<label>Descricao *</label><input id="fDesc" placeholder="Ex: Conta de luz, Amazon...">';

  // Valor + Parcela
  s += '<div class="row"><div><label>Valor *</label>';
  s += '<input type="number" id="fValor" step="0.01" placeholder="0,00" inputmode="decimal"></div>';
  s += '<div><label>Parcela</label><input id="fParc" placeholder="Ex: 1/3"></div></div>';

  // ── Banco (Lanc/CP/Rec) ──
  s += '<div id="secBanco">';
  s += '<label>Banco / Conta</label><select id="fBanco"><option value="">Selecione...</option></select>';
  s += '</div>';

  // ── Cartao (Credito) ──
  s += '<div id="secCart" class="hide">';
  s += '<label>Cartao</label><select id="fCartao"><option value="">Selecione...</option></select>';
  s += '<label>Numero de Parcelas</label><input type="number" id="fNParc" value="1" min="1" inputmode="numeric">';
  s += '</div>';

  // Categoria
  s += '<label>Categoria</label><select id="fCat"><option value="">Selecione...</option></select>';

  // Status
  s += '<label>Status</label><select id="fStatus"><option value="">Selecione...</option></select>';

  // Botao
  s += '<button class="btn btn-ok" onclick="salvar()">SALVAR</button>';
  s += '</div>';

  // Toast
  s += '<div class="toast" id="toast"></div>';

  // ── JAVASCRIPT ──
  s += '<script>';
  s += 'var tipo="lanc",cad={};';

  // Init
  s += 'function init(){';
  s += '  var h=new Date(),dd=h.getDate(),mm=h.getMonth()+1,yy=h.getFullYear();';
  s += '  var ds=yy+"-"+(mm<10?"0":"")+mm+"-"+(dd<10?"0":"")+dd;';
  s += '  document.getElementById("fData").value=ds;';
  s += '  google.script.run.withSuccessHandler(function(r){cad=r;popSelects();}).withFailureHandler(function(e){toast("Erro cadastros: "+e.message,"er");}).webGetCadastros();';
  s += '  loadKPIs();';
  s += '  loadAlertas();';
  s += '}';

  // Popula selects
  s += 'function popSelects(){';
  s += '  pop("fBanco",cad.bancos);';
  s += '  pop("fCartao",cad.cartoes);';
  s += '  pop("fCat",cad.categorias);';
  s += '  pop("fStatus",cad.status);';
  s += '}';
  s += 'function pop(id,arr){';
  s += '  var sel=document.getElementById(id);if(!arr)return;';
  s += '  for(var i=0;i<arr.length;i++){var o=document.createElement("option");o.value=arr[i];o.text=arr[i];sel.add(o);}';
  s += '}';

  // KPIs
  s += 'function loadKPIs(){';
  s += '  var h=new Date();';
  s += '  google.script.run.withSuccessHandler(function(r){';
  s += '    var h="";';
  s += '    h+="<div class=\\"kpi r\\"><div class=\\"lb\\">Receitas</div><div class=\\"vl\\">"+brl(r.receitas)+"</div></div>";';
  s += '    h+="<div class=\\"kpi d\\"><div class=\\"lb\\">Despesas</div><div class=\\"vl\\">"+brl(r.despesas)+"</div></div>";';
  s += '    h+="<div class=\\"kpi c\\"><div class=\\"lb\\">Cartao</div><div class=\\"vl\\">"+brl(r.credito)+"</div></div>";';
  s += '    h+="<div class=\\"kpi s\\"><div class=\\"lb\\">Saldo</div><div class=\\"vl\\">"+brl(r.saldo)+"</div></div>";';
  s += '    document.getElementById("kpis").innerHTML=h;';
  s += '  }).webResumoMensal(h.getMonth()+1,h.getFullYear());';
  s += '}';

  s += 'function brl(v){if(!v||v===0)return"R$ 0,00";var neg=v<0;var a=Math.abs(v);var p=a.toFixed(2).split(".");';
  s += 'var i=p[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g,".");return(neg?"-":"")+"R$ "+i+","+p[1];}';

  // Tab switch
  s += 'function setTab(t,el){';
  s += '  tipo=t;document.querySelectorAll(".tab").forEach(function(e){e.classList.remove("on");});el.classList.add("on");';
  s += '  var d=document.getElementById("dest"),sB=document.getElementById("secBanco"),sC=document.getElementById("secCart");';
  s += '  if(t==="lanc"){d.textContent="Destino: Lancamentos (Saida)";sB.classList.remove("hide");sC.classList.add("hide");}';
  s += '  else if(t==="rec"){d.textContent="Destino: Lancamentos (Entrada)";sB.classList.remove("hide");sC.classList.add("hide");}';
  s += '  else if(t==="cart"){d.textContent="Destino: Credito (Cartao)";sB.classList.add("hide");sC.classList.remove("hide");}';
  s += '  else if(t==="cp"){d.textContent="Destino: CONTAS A PAGAR";sB.classList.remove("hide");sC.classList.add("hide");}';
  s += '}';

  // Salvar
  s += 'function salvar(){';
  s += '  var desc=g("fDesc").trim(),valor=g("fValor");';
  s += '  if(!desc||!valor){toast("Preencha descricao e valor!","er");return;}';
  s += '  var d={data:g("fData"),vencimento:g("fVenc"),descricao:desc,valor:valor,';
  s += '    parcela:g("fParc"),banco:g("fBanco"),categoria:g("fCat"),status:g("fStatus"),';
  s += '    cartao:g("fCartao"),parcelas:g("fNParc")};';
  s += '  toast("Salvando...","ok");';
  s += '  if(tipo==="lanc"){d.tipo="Saída";google.script.run.withSuccessHandler(ok).withFailureHandler(er).webSalvarLanc(d);}';
  s += '  else if(tipo==="rec"){d.tipo="Entrada";google.script.run.withSuccessHandler(ok).withFailureHandler(er).webSalvarLanc(d);}';
  s += '  else if(tipo==="cart"){google.script.run.withSuccessHandler(ok).withFailureHandler(er).webSalvarCred(d);}';
  s += '  else if(tipo==="cp"){d.tipo="Saída";google.script.run.withSuccessHandler(ok).withFailureHandler(er).webSalvarCP(d);}';
  s += '}';

  s += 'function g(id){return document.getElementById(id).value;}';
  s += 'function ok(r){if(r&&r.ok){toast("Salvo na linha "+r.linha+"!","ok");limpar();loadKPIs();}else toast("Erro: "+(r?r.erro:"?"),"er");}';
  s += 'function er(e){toast("Erro: "+e.message,"er");}';

  s += 'function limpar(){g2("fDesc","");g2("fValor","");g2("fParc","");';
  s += '  var h=new Date(),dd=h.getDate(),mm=h.getMonth()+1,yy=h.getFullYear();';
  s += '  g2("fData",yy+"-"+(mm<10?"0":"")+mm+"-"+(dd<10?"0":"")+dd);g2("fVenc","");}';
  s += 'function g2(id,v){document.getElementById(id).value=v;}';

  s += 'function toast(msg,cls){var t=document.getElementById("toast");t.textContent=msg;t.className="toast "+cls+" show";';
  s += 'setTimeout(function(){t.className="toast";},3500);}';

  // Alertas
  s += 'function loadAlertas(){';
  s += '  google.script.run.withSuccessHandler(function(r){';
  s += '    var el=document.getElementById("alertBanner");';
  s += '    if(r.vencidas>0){';
  s += '      el.className="alrt danger on";';
  s += '      el.innerHTML="<div class=\\"at\\">&#9888; "+r.vencidas+" conta"+(r.vencidas>1?"s":"")+" VENCIDA"+(r.vencidas>1?"S":"")+"!</div>";';
  s += '      el.innerHTML+="<div class=\\"ad\\">Total em atraso: "+brl(r.totalVencido)+"</div>";';
  s += '      if(r.urgentes&&r.urgentes.length>0){var items="";for(var i=0;i<Math.min(r.urgentes.length,3);i++){items+=r.urgentes[i].desc+" ("+brl(r.urgentes[i].valor)+") ";}el.innerHTML+="<div class=\\"ai\\">"+items+"</div>";}';
  s += '    }else if(r.hoje>0){';
  s += '      el.className="alrt warn on";';
  s += '      el.innerHTML="<div class=\\"at\\">&#9201; "+r.hoje+" conta"+(r.hoje>1?"s":"")+" vence"+(r.hoje>1?"m":"")+" HOJE!</div>";';
  s += '      el.innerHTML+="<div class=\\"ad\\">Total: "+brl(r.totalHoje)+"</div>";';
  s += '    }else if(r.semana>0||r.amanha>0){';
  s += '      var qtd=r.amanha+r.semana;';
  s += '      el.className="alrt info on";';
  s += '      el.innerHTML="<div class=\\"at\\">&#128197; "+qtd+" conta"+(qtd>1?"s":"")+" nos proximos 7 dias</div>";';
  s += '      el.innerHTML+="<div class=\\"ad\\">Total: "+brl(r.totalSemana)+"</div>";';
  s += '    }';
  s += '  }).withFailureHandler(function(e){}).webAlertasContas();';
  s += '}';

  s += 'init();';
  s += '</script></body></html>';
  return s;
}
