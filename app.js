/* ==========================================================================
   Apontamento de Campo — VIAR Bloco 1
   Versão OFFLINE / instalável: dados no aparelho (localStorage); aba Dados para exportar/importar.
   ========================================================================== */

const EQUIPES_PADRAO = ["Reciclagem", "Fresagem", "Drenagem", "Pavimentação", "Terraplenagem", "Apoio/Logística"];
const EVENTOS = ["Chuva", "Baixada", "Folga", "Manutenção", "Devolvido"];
const TIPOS_EQUIP = [
  "Trator de esteira", "Motoniveladora", "Rolo compactador", "Retroescavadeira",
  "Escavadeira hidráulica", "Caminhão pipa", "Caminhão basculante", "Vibroacabadora",
  "Fresadora", "Recicladora", "Carregadeira", "Pá carregadeira", "Outro",
];

let state = {
  equipes: [],
  equipamentos: [],
  apontamentos: [],
  aptForm: null,
  aptEditingId: null,
  equipEditingId: null,
  teamEditingId: null,
  relModo: "dia",
};

/* -------------------------------------------------------------- utils */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const fmtDate = (d) => {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};
const fmtNum = (v, casas = 1) =>
  (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const $ = (id) => document.getElementById(id);

const equipLabel = (eq) => {
  if (!eq) return "";
  const principal = eq.prefixo || eq.placa || eq.tipo || "Equipamento";
  const extra = [eq.prefixo ? eq.placa : "", eq.tipo].filter(Boolean).join(" · ");
  return extra ? `${principal} (${extra})` : principal;
};
const nomesEquipes = () => state.equipes.map((e) => e.nome);
const horasDe = (r) => {
  const hi = parseFloat(r.horimetroInicial), hf = parseFloat(r.horimetroFinal);
  return !isNaN(hi) && !isNaN(hf) && hf >= hi ? hf - hi : null;
};
const statusTxt = (r) => (r.status === "Inoperante" ? (r.evento ? `Inoperante — ${r.evento}` : "Inoperante") : "Operante");

function showBanner(msg, isError) {
  const b = $("banner");
  b.textContent = msg;
  b.classList.add("show");
  b.style.background = isError ? "#FBE4E4" : "#FFF4D6";
  b.style.borderColor = isError ? "#C53030" : "#FFC000";
}
function hideBanner() { $("banner").classList.remove("show"); }

/* -------------------------------------------------------------- storage (localStorage) */
const LS_EQUIP = "campo_equipamentos";
const LS_APONT = "campo_apontamentos";
const LS_EQUIPES = "campo_equipes";
function lsGet(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function lsSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); return true; }
  catch (e) { showBanner("Não foi possível salvar neste aparelho (armazenamento cheio ou bloqueado pelo navegador). Tente fotos menores ou remova equipamentos antigos.", true); return false; }
}
async function loadAll() {
  state.equipes = lsGet(LS_EQUIPES);
  state.equipamentos = lsGet(LS_EQUIP);
  state.apontamentos = lsGet(LS_APONT);
  hideBanner();
}
async function saveEquipes() { lsSet(LS_EQUIPES, state.equipes); }
async function saveEquipamentos() { lsSet(LS_EQUIP, state.equipamentos); }
async function saveApontamentos() { lsSet(LS_APONT, state.apontamentos); }


/* -------------------------------------------------------------- migração de dados antigos */
function migrar() {
  let mudou = false;
  state.equipamentos.forEach((e) => {
    if ("nome" in e) {
      if (!e.prefixo) e.prefixo = e.nome;
      delete e.nome; mudou = true;
    }
    ["valorLocacaoMes", "status"].forEach((k) => { if (k in e) { delete e[k]; mudou = true; } });
  });
  state.apontamentos.forEach((a) => {
    if ("clima" in a) { delete a.clima; mudou = true; }
    if (a.status === "Inoperante" && a.evento === undefined) { a.evento = ""; mudou = true; }
    if (a.status !== "Inoperante" && a.evento) { a.evento = ""; mudou = true; }
  });
  // equipes: semente padrão + qualquer equipe usada nos dados
  const existentes = new Set(state.equipes.map((t) => t.nome.toLowerCase()));
  const precisa = [];
  if (state.equipes.length === 0) precisa.push(...EQUIPES_PADRAO);
  [...state.equipamentos, ...state.apontamentos].forEach((x) => { if (x.equipe) precisa.push(x.equipe); });
  precisa.forEach((nome) => {
    if (!existentes.has(nome.toLowerCase())) {
      existentes.add(nome.toLowerCase());
      state.equipes.push({ id: slug(nome) || uid(), nome });
      mudou = true;
    }
  });
  return mudou;
}

async function iniciarDados() {
  await loadAll();
  if (migrar()) {
    await saveEquipes(); await saveEquipamentos(); await saveApontamentos();
  }
}

/* -------------------------------------------------------------- tabs */
const TABS = ["apontamento", "equipamentos", "equipes", "relatorio", "dados"];
function setupTabs() {
  document.querySelectorAll("nav.tabbar button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll("nav.tabbar button").forEach((b) => b.classList.toggle("active", b === btn));
      TABS.forEach((t) => { $(`tab-${t}`).hidden = t !== tab; });
      if (tab === "equipamentos") renderEquipList();
      if (tab === "equipes") renderEquipeList();
      if (tab === "relatorio") { renderRelatorioEquipeSelect(); renderRelatorioPreview(); }
      window.scrollTo({ top: 0 });
    });
  });
}

/* ============================================================
   APONTAMENTO
   ============================================================ */
function emptyAptForm() {
  return {
    data: todayISO(), equipe: nomesEquipes()[0] || "", equipamentoId: "",
    horimetroInicial: "", horimetroFinal: "", status: "Operante", evento: "", obs: "", fotoPainel: "",
  };
}

function resetAptForm() {
  state.aptEditingId = null;
  state.aptForm = emptyAptForm();
  renderEquipeSelect();
  renderEquipamentoSelect();
  syncAptFormToDom();
}

function renderEquipeSelect() {
  const sel = $("f_equipe_select");
  const nomes = nomesEquipes();
  if (state.aptForm.equipe && !nomes.includes(state.aptForm.equipe)) nomes.push(state.aptForm.equipe);
  if (nomes.length === 0) {
    sel.innerHTML = `<option value="">Cadastre uma equipe na aba Equipes</option>`;
  } else {
    sel.innerHTML = nomes.map((n) => `<option value="${esc(n)}" ${state.aptForm.equipe === n ? "selected" : ""}>${esc(n)}</option>`).join("");
  }
  sel.onchange = (e) => {
    state.aptForm.equipe = e.target.value;
    state.aptForm.equipamentoId = "";
    renderEquipamentoSelect();
  };
}

function renderEquipamentoSelect() {
  const wrap = $("f_equip_wrap");
  const daEquipe = state.equipamentos.filter((e) => e.equipe === state.aptForm.equipe);
  if (daEquipe.length === 0) {
    wrap.innerHTML = `<div class="warn-box">Nenhum equipamento cadastrado para esta equipe. Vá em "Equipamentos" e cadastre (ou importe o cadastro em lote).</div>`;
    return;
  }
  wrap.innerHTML = `<select id="f_equip_select">
      <option value="">Selecione o equipamento…</option>
      ${daEquipe.map((e) => `<option value="${e.id}" ${state.aptForm.equipamentoId === e.id ? "selected" : ""}>${esc(equipLabel(e))}</option>`).join("")}
    </select><div id="f_equip_foto"></div>`;
  $("f_equip_select").addEventListener("change", (ev) => {
    state.aptForm.equipamentoId = ev.target.value;
    renderFotoSelecionada();
  });
  renderFotoSelecionada();
}

function renderFotoSelecionada() {
  const box = $("f_equip_foto");
  if (!box) return;
  const eq = state.equipamentos.find((e) => e.id === state.aptForm.equipamentoId);
  box.innerHTML = eq && eq.foto ? `<img class="thumb-big" style="margin-top:8px;" src="${eq.foto}" alt="Foto do equipamento" />` : "";
}

function updateHorasBox() {
  const h = horasDe(state.aptForm);
  const box = $("horasBox");
  if (h !== null) {
    box.style.display = "flex";
    box.innerHTML = `⏱ Horas trabalhadas: <strong>&nbsp;${fmtNum(h, 1)} h</strong>`;
  } else {
    box.style.display = "none";
  }
}

function updateStatusButtons() {
  const inop = state.aptForm.status === "Inoperante";
  $("btnStatusOp").classList.toggle("active", !inop);
  $("btnStatusIn").classList.toggle("active", inop);
  $("eventoWrap").style.display = inop ? "block" : "none";
  $("f_evento").innerHTML = `<option value="">Selecione o evento…</option>` +
    EVENTOS.map((ev) => `<option ${state.aptForm.evento === ev ? "selected" : ""}>${esc(ev)}</option>`).join("");
}

function renderPainelPreview() {
  const f = state.aptForm.fotoPainel;
  $("f_painel_preview").innerHTML = f ? `<img class="thumb-big" src="${f}" alt="Foto do painel" />` : "";
  $("btnRemoverPainel").style.display = f ? "inline-flex" : "none";
}

function syncAptFormToDom() {
  $("f_painel").value = "";
  renderPainelPreview();
  $("f_data").value = state.aptForm.data;
  $("f_hi").value = state.aptForm.horimetroInicial;
  $("f_hf").value = state.aptForm.horimetroFinal;
  $("f_obs").value = state.aptForm.obs;
  updateStatusButtons();
  updateHorasBox();
  $("editingBanner").style.display = state.aptEditingId ? "flex" : "none";
}

function attachAptFormEvents() {
  $("f_data").addEventListener("change", (e) => { state.aptForm.data = e.target.value; });
  $("f_hi").addEventListener("input", (e) => { state.aptForm.horimetroInicial = e.target.value; updateHorasBox(); });
  $("f_hf").addEventListener("input", (e) => { state.aptForm.horimetroFinal = e.target.value; updateHorasBox(); });
  $("f_obs").addEventListener("input", (e) => { state.aptForm.obs = e.target.value; });
  $("f_evento").addEventListener("change", (e) => { state.aptForm.evento = e.target.value; });
  $("btnStatusOp").addEventListener("click", () => { state.aptForm.status = "Operante"; state.aptForm.evento = ""; updateStatusButtons(); });
  $("btnStatusIn").addEventListener("click", () => { state.aptForm.status = "Inoperante"; updateStatusButtons(); });
  $("btnCancelEdit").addEventListener("click", resetAptForm);
  $("f_painel").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try { state.aptForm.fotoPainel = await reduzirImagem(file, 800, 0.65); renderPainelPreview(); }
    catch (err) { alert(err.message || "Não foi possível usar essa imagem."); }
  });
  $("btnRemoverPainel").addEventListener("click", () => { state.aptForm.fotoPainel = ""; $("f_painel").value = ""; renderPainelPreview(); });

  $("btnSalvarApontamento").addEventListener("click", async () => {
    const f = state.aptForm;
    if (!f.equipamentoId || !f.data) { alert("Selecione a data e o equipamento antes de salvar."); return; }
    if (f.status === "Inoperante" && !f.evento) { alert("Equipamento inoperante: selecione o evento (Chuva, Baixada, Folga, Manutenção ou Devolvido)."); return; }
    const hi = parseFloat(f.horimetroInicial), hf = parseFloat(f.horimetroFinal);
    if (!isNaN(hi) && !isNaN(hf) && hf < hi) { alert("O horímetro final não pode ser menor que o inicial."); return; }
    const reg = { ...f, evento: f.status === "Inoperante" ? f.evento : "" };
    if (state.aptEditingId) {
      state.apontamentos = state.apontamentos.map((a) => (a.id === state.aptEditingId ? { ...reg, id: state.aptEditingId } : a));
    } else {
      state.apontamentos = [{ ...reg, id: uid() }, ...state.apontamentos];
    }
    await saveApontamentos();
    resetAptForm();
    renderAptList();
  });

  $("aptList").addEventListener("click", async (ev) => {
    const card = ev.target.closest(".apt-card");
    if (!card) return;
    const id = card.dataset.id;
    if (ev.target.closest(".btn-edit-apt")) {
      const a = state.apontamentos.find((x) => x.id === id);
      if (!a) return;
      state.aptEditingId = id;
      state.aptForm = { evento: "", fotoPainel: "", ...a };
      renderEquipeSelect();
      renderEquipamentoSelect();
      syncAptFormToDom();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (ev.target.closest(".btn-del-apt")) {
      if (!confirm("Remover este apontamento?")) return;
      state.apontamentos = state.apontamentos.filter((x) => x.id !== id);
      await saveApontamentos();
      renderAptList();
    }
  });
}

function renderAptList() {
  const equipMap = {};
  state.equipamentos.forEach((e) => (equipMap[e.id] = e));
  const lista = [...state.apontamentos].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  $("aptListTitle").textContent = `Apontamentos lançados (${lista.length})`;
  const el = $("aptList");
  if (lista.length === 0) { el.innerHTML = `<div class="empty-box">Nenhum apontamento lançado ainda.</div>`; return; }
  el.innerHTML = lista.map((a) => {
    const eq = equipMap[a.equipamentoId];
    const pill = a.status === "Inoperante"
      ? `<span class="pill red">Inoperante${a.evento ? " · " + esc(a.evento) : ""}</span>`
      : `<span class="pill green">Operante</span>`;
    const h = horasDe(a);
    const detalhes = (a.horimetroInicial !== "" || a.horimetroFinal !== "")
      ? `<span>Horímetro: ${esc(a.horimetroInicial) || "-"} → ${esc(a.horimetroFinal) || "-"} h</span>${h !== null ? `<span>⏱ ${fmtNum(h, 1)} h</span>` : ""}` : "";
    return `<div class="apt-card" data-id="${a.id}">
      <div class="apt-top">
        <div class="row-flex">
          ${eq && eq.foto ? `<img class="thumb" src="${eq.foto}" alt="" />` : ""}
          <div>
            <div class="apt-date">${fmtDate(a.data)}</div>
            <div class="apt-equip">${esc(eq ? equipLabel(eq) : "Equipamento removido")}</div>
            <div class="apt-team">👥 ${esc(a.equipe)}</div>
          </div>
        </div>
        ${pill}
      </div>
      <div class="apt-details">${detalhes}</div>
      ${a.obs ? `<div class="apt-obs">${esc(a.obs)}</div>` : ""}
      ${a.fotoPainel ? `<img class="thumb-big" style="margin-top:8px; max-height:120px;" src="${a.fotoPainel}" alt="Foto do painel" />` : ""}
      <div class="apt-actions">
        <button class="btn-small btn-edit-apt">✎ Editar</button>
        <button class="btn-small danger btn-del-apt">🗑 Excluir</button>
      </div>
    </div>`;
  }).join("");
}

/* ============================================================
   EQUIPES
   ============================================================ */
function renderEquipeList() {
  const el = $("equipeList");
  if (state.equipes.length === 0) { el.innerHTML = `<div class="empty-box">Nenhuma equipe cadastrada.</div>`; return; }
  const lista = [...state.equipes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  el.innerHTML = lista.map((t) => {
    const qtd = state.equipamentos.filter((e) => e.equipe === t.nome).length;
    if (state.teamEditingId === t.id) {
      return `<div class="team-row" data-id="${t.id}">
        <input type="text" class="team-input" value="${esc(t.nome)}" />
        <button class="btn-save-sm btn-team-save">✓</button>
        <button class="btn-cancel btn-team-cancel">✕</button>
      </div>`;
    }
    return `<div class="team-row" data-id="${t.id}">
      <div class="nm">${esc(t.nome)}<div class="ct">${qtd} equipamento(s)</div></div>
      <button class="btn-small btn-team-edit">✎ Renomear</button>
      <button class="btn-small danger btn-team-del">🗑</button>
    </div>`;
  }).join("");
  const inp = el.querySelector(".team-input");
  if (inp) inp.focus();
}

async function adicionarEquipe(nome) {
  nome = nome.trim();
  if (!nome) { alert("Informe o nome da equipe."); return false; }
  if (nomesEquipes().some((n) => n.toLowerCase() === nome.toLowerCase())) { alert("Já existe uma equipe com esse nome."); return false; }
  let id = slug(nome) || uid();
  if (state.equipes.some((t) => t.id === id)) id += "-" + uid();
  state.equipes.push({ id, nome });
  await saveEquipes();
  return true;
}

function setupEquipes() {
  $("btnAddEquipe").addEventListener("click", async () => {
    if (await adicionarEquipe($("t_nome").value)) {
      $("t_nome").value = "";
      renderEquipeList(); resetAptFormKeep();
    }
  });
  $("equipeList").addEventListener("click", async (ev) => {
    const row = ev.target.closest(".team-row");
    if (!row) return;
    const id = row.dataset.id;
    const t = state.equipes.find((x) => x.id === id);
    if (!t) return;
    if (ev.target.closest(".btn-team-edit")) { state.teamEditingId = id; renderEquipeList(); }
    else if (ev.target.closest(".btn-team-cancel")) { state.teamEditingId = null; renderEquipeList(); }
    else if (ev.target.closest(".btn-team-save")) {
      const novo = row.querySelector(".team-input").value.trim();
      if (!novo) { alert("Informe o nome da equipe."); return; }
      if (nomesEquipes().some((n) => n.toLowerCase() === novo.toLowerCase() && n !== t.nome)) { alert("Já existe uma equipe com esse nome."); return; }
      const antigo = t.nome;
      if (novo !== antigo) {
        t.nome = novo;
        state.equipamentos.forEach((e) => { if (e.equipe === antigo) e.equipe = novo; });
        state.apontamentos.forEach((a) => { if (a.equipe === antigo) a.equipe = novo; });
        if (state.aptForm.equipe === antigo) state.aptForm.equipe = novo;
        await saveEquipes(); await saveEquipamentos(); await saveApontamentos();
      }
      state.teamEditingId = null;
      renderEquipeList(); resetAptFormKeep(); renderAptList();
    }
    else if (ev.target.closest(".btn-team-del")) {
      const emUso = state.equipamentos.filter((e) => e.equipe === t.nome).length;
      if (emUso > 0) { alert(`Não dá para excluir "${t.nome}": há ${emUso} equipamento(s) nessa equipe. Mude esses equipamentos de equipe antes.`); return; }
      if (!confirm(`Excluir a equipe "${t.nome}"? Os apontamentos antigos dela continuam nos relatórios.`)) return;
      state.equipes = state.equipes.filter((x) => x.id !== id);
      await saveEquipes();
      renderEquipeList(); resetAptFormKeep();
    }
  });
}

// recarrega os selects de equipe/equipamento da tela de apontamento mantendo o que foi digitado
function resetAptFormKeep() {
  if (!nomesEquipes().includes(state.aptForm.equipe) && !state.aptEditingId) state.aptForm.equipe = nomesEquipes()[0] || "";
  renderEquipeSelect();
  renderEquipamentoSelect();
}

/* ============================================================
   EQUIPAMENTOS
   ============================================================ */
function emptyEquipForm() {
  return { tipo: TIPOS_EQUIP[0], equipe: nomesEquipes()[0] || "", prefixo: "", placa: "", modelo: "", locadora: "", inicioLocacao: todayISO(), obs: "", foto: "" };
}
let equipForm = emptyEquipForm();

function renderEquipList() {
  const el = $("equipList");
  const lista = [...state.equipamentos].sort((a, b) => (a.equipe || "").localeCompare(b.equipe || "", "pt-BR") || (a.prefixo || "").localeCompare(b.prefixo || "", "pt-BR"));
  if (lista.length === 0) {
    el.innerHTML = `<div class="empty-box">Nenhum equipamento cadastrado ainda. Cadastre um por um acima, ou cole uma lista no quadro de importação.</div>`;
    return;
  }
  el.innerHTML = lista.map((eq) => `<div class="apt-card" data-id="${eq.id}">
      <div class="apt-top">
        <div class="row-flex">
          ${eq.foto ? `<img class="thumb" src="${eq.foto}" alt="" />` : ""}
          <div>
            <div class="apt-equip">${esc(eq.prefixo || eq.placa || "(sem prefixo)")}</div>
            <div class="apt-date">${esc(eq.tipo)} · ${esc(eq.modelo) || "modelo n/i"}</div>
            <div class="apt-team">👥 ${esc(eq.equipe)}</div>
          </div>
        </div>
      </div>
      <div class="apt-details">
        <span>Placa: ${esc(eq.placa) || "-"}</span>
        <span>Locadora: ${esc(eq.locadora) || "-"}</span>
      </div>
      <div class="apt-actions">
        <button class="btn-small btn-edit-equip">✎ Editar</button>
        <button class="btn-small danger btn-del-equip">🗑 Excluir</button>
      </div>
    </div>`).join("");
}

function renderFotoModal() {
  const prev = $("e_foto_preview");
  prev.innerHTML = equipForm.foto ? `<img class="thumb-big" src="${equipForm.foto}" alt="Foto" />` : "";
  $("btnRemoverFoto").style.display = equipForm.foto ? "inline-flex" : "none";
}

function openEquipModal() {
  $("equipModalTitle").textContent = state.equipEditingId ? "Editar equipamento" : "Novo equipamento";
  $("e_tipo").innerHTML = TIPOS_EQUIP.map((t) => `<option ${equipForm.tipo === t ? "selected" : ""}>${esc(t)}</option>`).join("");
  const nomes = nomesEquipes();
  if (equipForm.equipe && !nomes.includes(equipForm.equipe)) nomes.push(equipForm.equipe);
  $("e_equipe_select").innerHTML = nomes.length
    ? nomes.map((n) => `<option value="${esc(n)}" ${equipForm.equipe === n ? "selected" : ""}>${esc(n)}</option>`).join("")
    : `<option value="">Cadastre uma equipe primeiro</option>`;
  $("e_prefixo").value = equipForm.prefixo;
  $("e_placa").value = equipForm.placa;
  $("e_modelo").value = equipForm.modelo;
  $("e_locadora").value = equipForm.locadora;
  $("e_inicio").value = equipForm.inicioLocacao;
  $("e_obs").value = equipForm.obs;
  $("e_foto").value = "";
  renderFotoModal();
  $("equipModalOverlay").style.display = "flex";
}
function closeEquipModal() { $("equipModalOverlay").style.display = "none"; }

// reduz a foto (lado maior 480px, JPEG) para caber no armazenamento
function reduzirImagem(file, maxLado = 480, qualidade = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagem não reconhecido."));
      img.onload = () => {
        const esc_ = Math.min(1, maxLado / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * esc_));
        c.height = Math.max(1, Math.round(img.height * esc_));
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", qualidade));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function setupEquipModalEvents() {
  $("btnNovoEquip").addEventListener("click", () => {
    if (state.equipes.length === 0) { alert("Cadastre ao menos uma equipe na aba Equipes antes de cadastrar equipamentos."); return; }
    state.equipEditingId = null;
    equipForm = emptyEquipForm();
    openEquipModal();
  });
  $("btnCloseEquipModal").addEventListener("click", closeEquipModal);
  $("btnCancelEquip").addEventListener("click", closeEquipModal);
  $("equipModalOverlay").addEventListener("click", (e) => { if (e.target.id === "equipModalOverlay") closeEquipModal(); });

  const mapa = { e_prefixo: "prefixo", e_placa: "placa", e_modelo: "modelo", e_locadora: "locadora", e_inicio: "inicioLocacao", e_obs: "obs" };
  Object.keys(mapa).forEach((id) => $(id).addEventListener("input", (e) => { equipForm[mapa[id]] = e.target.value; }));
  $("e_tipo").addEventListener("change", (e) => { equipForm.tipo = e.target.value; });
  $("e_equipe_select").addEventListener("change", (e) => { equipForm.equipe = e.target.value; });

  $("e_foto").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      equipForm.foto = await reduzirImagem(file);
      renderFotoModal();
    } catch (err) {
      alert(err.message || "Não foi possível usar essa imagem.");
    }
  });
  $("btnRemoverFoto").addEventListener("click", () => { equipForm.foto = ""; $("e_foto").value = ""; renderFotoModal(); });

  $("btnSalvarEquip").addEventListener("click", async () => {
    equipForm.prefixo = equipForm.prefixo.trim();
    equipForm.placa = equipForm.placa.trim();
    if (!equipForm.prefixo && !equipForm.placa) { alert("Informe o prefixo (ou a placa) do equipamento."); return; }
    if (!equipForm.equipe) { alert("Selecione a equipe."); return; }
    if (state.equipEditingId) {
      state.equipamentos = state.equipamentos.map((e) => (e.id === state.equipEditingId ? { ...equipForm, id: state.equipEditingId } : e));
    } else {
      state.equipamentos = [...state.equipamentos, { ...equipForm, id: uid() }];
    }
    await saveEquipamentos();
    closeEquipModal();
    renderEquipList();
    renderEquipamentoSelect();
  });

  $("equipList").addEventListener("click", async (ev) => {
    const card = ev.target.closest(".apt-card");
    if (!card) return;
    const id = card.dataset.id;
    if (ev.target.closest(".btn-edit-equip")) {
      const eq = state.equipamentos.find((x) => x.id === id);
      if (!eq) return;
      state.equipEditingId = id;
      equipForm = { foto: "", ...eq };
      openEquipModal();
    } else if (ev.target.closest(".btn-del-equip")) {
      if (!confirm("Remover este equipamento?")) return;
      state.equipamentos = state.equipamentos.filter((x) => x.id !== id);
      await saveEquipamentos();
      renderEquipList();
      renderEquipamentoSelect();
    }
  });
}

/* ============================================================
   IMPORTAR CADASTRO EM LOTE — colunas: Tipo, Equipe, Prefixo, Placa, Modelo, Locadora
   ============================================================ */
function parseLinhaCadastro(linha) {
  const partes = linha.includes("\t") ? linha.split("\t") : linha.split(/[;,]/);
  const get = (i) => (partes[i] !== undefined ? partes[i].trim() : "");
  const tipo = get(0);
  if (tipo.toLowerCase() === "tipo") return null; // cabeçalho
  const prefixo = get(2), placa = get(3);
  if (!prefixo && !placa) return null;
  return {
    id: uid(), tipo: tipo || TIPOS_EQUIP[0], equipe: get(1), prefixo, placa,
    modelo: get(4), locadora: get(5), inicioLocacao: todayISO(), obs: "", foto: "",
  };
}

async function importarCadastroColado() {
  const linhas = $("importCadastroText").value.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim().length > 0);
  if (linhas.length === 0) { alert("Cole ao menos uma linha com os dados do equipamento antes de importar."); return; }
  const novos = linhas.map(parseLinhaCadastro).filter(Boolean);
  if (novos.length === 0) { alert("Não consegui reconhecer nenhuma linha válida. Confira se as colunas Prefixo (3ª) ou Placa (4ª) estão preenchidas."); return; }
  let criadas = 0;
  for (const n of novos) {
    if (!n.equipe) n.equipe = nomesEquipes()[0] || "Sem equipe";
    const achada = state.equipes.find((t) => t.nome.toLowerCase() === n.equipe.toLowerCase());
    if (achada) n.equipe = achada.nome;
    else { await adicionarEquipe(n.equipe); criadas++; }
  }
  state.equipamentos = [...state.equipamentos, ...novos];
  await saveEquipamentos();
  $("importCadastroText").value = "";
  renderEquipList(); resetAptFormKeep();
  alert(`${novos.length} equipamento(s) importado(s)${criadas ? ` e ${criadas} equipe(s) nova(s) criada(s)` : ""}.`);
}

/* ============================================================
   RELATÓRIOS (diário ou por período) — PDF e Excel (CSV)
   ============================================================ */
function renderRelatorioEquipeSelect() {
  const sel = $("r_equipe");
  const atual = sel.value || "Todas";
  const nomes = ["Todas", ...nomesEquipes()];
  sel.innerHTML = nomes.map((n) => `<option value="${esc(n)}" ${n === atual ? "selected" : ""}>${n === "Todas" ? "Todas as equipes" : esc(n)}</option>`).join("");
  renderRelatorioEquipSelect();
}

function renderRelatorioEquipSelect() {
  const sel = $("r_equip");
  const atual = sel.value || "";
  const eqpe = $("r_equipe").value || "Todas";
  const lista = state.equipamentos
    .filter((e) => eqpe === "Todas" || e.equipe === eqpe)
    .sort((a, b) => (a.prefixo || "").localeCompare(b.prefixo || "", "pt-BR"));
  sel.innerHTML = `<option value="">Todos os equipamentos</option>` +
    lista.map((e) => `<option value="${e.id}" ${e.id === atual ? "selected" : ""}>${esc(equipLabel(e))}</option>`).join("");
}

function atualizarModoRelatorio() {
  const dia = state.relModo === "dia";
  $("btnModoDia").classList.toggle("active", dia);
  $("btnModoPeriodo").classList.toggle("active", !dia);
  $("r_dia_wrap").style.display = dia ? "block" : "none";
  $("r_periodo_wrap").style.display = dia ? "none" : "grid";
}

function setupRelatorioTab() {
  const hoje = todayISO();
  $("r_data").value = hoje;
  $("r_ini").value = hoje.slice(0, 8) + "01";
  $("r_fim").value = hoje;
  renderRelatorioEquipeSelect();
  atualizarModoRelatorio();
  $("btnModoDia").addEventListener("click", () => { state.relModo = "dia"; atualizarModoRelatorio(); renderRelatorioPreview(); });
  $("btnModoPeriodo").addEventListener("click", () => { state.relModo = "periodo"; atualizarModoRelatorio(); renderRelatorioPreview(); });
  ["r_data", "r_ini", "r_fim", "r_equip", "r_agrupar"].forEach((id) => $(id).addEventListener("change", renderRelatorioPreview));
  $("r_equipe").addEventListener("change", () => { renderRelatorioEquipSelect(); renderRelatorioPreview(); });
  $("btnGerarPdf").addEventListener("click", gerarRelatorioPdf);
  $("btnExportarExcel").addEventListener("click", exportarExcelCsv);
}

function relatorioDados() {
  let ini, fim;
  if (state.relModo === "dia") { ini = fim = $("r_data").value || todayISO(); }
  else { ini = $("r_ini").value || "0000-01-01"; fim = $("r_fim").value || "9999-12-31"; if (ini > fim) [ini, fim] = [fim, ini]; }
  const equipe = $("r_equipe").value || "Todas";
  const equipId = $("r_equip").value || "";
  const agrupar = $("r_agrupar").value || "equipe";
  const equipMap = {};
  state.equipamentos.forEach((e) => (equipMap[e.id] = e));
  const pref = (a) => equipMap[a.equipamentoId]?.prefixo || equipMap[a.equipamentoId]?.placa || "";
  const cmpData = (a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0);
  const registros = state.apontamentos
    .filter((a) => a.data >= ini && a.data <= fim && (equipe === "Todas" || a.equipe === equipe) && (!equipId || a.equipamentoId === equipId))
    .sort(agrupar === "equipamento"
      ? (a, b) => pref(a).localeCompare(pref(b), "pt-BR") || cmpData(a, b)
      : (a, b) => (a.equipe || "").localeCompare(b.equipe || "", "pt-BR") || cmpData(a, b) || pref(a).localeCompare(pref(b), "pt-BR"));
  // grupos: por equipe ou por equipamento
  const mapa = new Map();
  registros.forEach((a) => {
    const chave = agrupar === "equipamento" ? (a.equipamentoId || "?") : (a.equipe || "Sem equipe");
    if (!mapa.has(chave)) {
      const eq = equipMap[a.equipamentoId];
      mapa.set(chave, {
        titulo: agrupar === "equipamento" ? (eq ? (eq.prefixo || eq.placa || "(sem prefixo)") : "(equipamento removido)") : (a.equipe || "Sem equipe"),
        sub: agrupar === "equipamento" ? [eq && eq.prefixo ? eq.placa : "", eq?.tipo, `Equipe: ${eq?.equipe || a.equipe || "-"}`].filter(Boolean).join(" · ") : "",
        regs: [],
      });
    }
    mapa.get(chave).regs.push(a);
  });
  const grupos = [...mapa.values()].sort((x, y) => x.titulo.localeCompare(y.titulo, "pt-BR"));
  return { ini, fim, equipe, equipId, agrupar, equipMap, grupos, registros, periodo: state.relModo !== "dia" };
}

const somaHoras = (regs) => regs.reduce((s, r) => s + (horasDe(r) || 0), 0);
const descPeriodo = (d) => (d.ini === d.fim ? fmtDate(d.ini) : `${fmtDate(d.ini)} a ${fmtDate(d.fim)}`);
function resumoGrupo(regs) {
  const inop = regs.filter((r) => r.status === "Inoperante");
  const ev = {};
  inop.forEach((r) => { const k = r.evento || "sem evento"; ev[k] = (ev[k] || 0) + 1; });
  const evTxt = Object.entries(ev).map(([k, v]) => `${k}: ${v}`).join(", ");
  return `${regs.length} apontamento(s) · ${regs.length - inop.length} operante(s) · ${inop.length} inoperante(s)${evTxt ? ` (${evTxt})` : ""} · ${fmtNum(somaHoras(regs), 1)} h trabalhadas`;
}

function renderRelatorioPreview() {
  const d = relatorioDados();
  const el = $("r_preview");
  if (d.registros.length === 0) {
    el.innerHTML = `<div class="empty-box">Nenhum apontamento em ${descPeriodo(d)} para o filtro escolhido.</div>`;
    return;
  }
  el.innerHTML = d.grupos.map((g) => `<div class="card">
      <div style="font-weight:800; color:var(--black); margin-bottom:4px;">${esc(g.titulo)}</div>
      ${g.sub ? `<div class="stat">${esc(g.sub)}</div>` : ""}
      <div class="stat">${esc(resumoGrupo(g.regs))}</div>
    </div>`).join("");
}

function gerarRelatorioPdf() {
  const d = relatorioDados();
  if (d.registros.length === 0) { alert("Não há apontamentos para esse filtro. Confira a data/período e a equipe."); return; }
  const porEq = d.agrupar === "equipamento";
  let corpo = "";
  d.grupos.forEach((g) => {
    corpo += `<div class="print-team">
      <h2>${esc(g.titulo)}</h2>
      ${g.sub ? `<div class="resumo">${esc(g.sub)}</div>` : ""}
      <div class="resumo">${esc(resumoGrupo(g.regs))}</div>
      <table>
        <thead><tr>
          ${d.periodo || porEq ? "<th>Data</th>" : ""}<th>Equipe</th><th>Prefixo</th><th>Hor. inicial</th><th>Hor. final</th><th>Horas trab.</th><th>Status</th>
        </tr></thead>
        <tbody>
          ${g.regs.map((r) => {
            const eq = d.equipMap[r.equipamentoId];
            const h = horasDe(r);
            return `<tr>
              ${d.periodo || porEq ? `<td>${esc(fmtDate(r.data))}</td>` : ""}
              <td>${esc(r.equipe)}</td>
              <td>${esc(eq ? (eq.prefixo || eq.placa || "-") : "(removido)")}</td>
              <td>${r.horimetroInicial !== "" ? esc(r.horimetroInicial) : "-"}</td>
              <td>${r.horimetroFinal !== "" ? esc(r.horimetroFinal) : "-"}</td>
              <td>${h !== null ? fmtNum(h, 1) : "-"}</td>
              <td class="${r.status === "Inoperante" ? "inop" : "op"}">${esc(statusTxt(r))}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
  });

  const docHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Relatório ${esc(descPeriodo(d))} — Apontamento de Campo</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#1F2937; padding:24px; margin:0; }
  h1 { font-size:18px; margin:0; color:#000; }
  .sub { font-size:12.5px; color:#404040; margin-top:2px; }
  .filtros { font-size:12px; color:#404040; margin-top:6px; }
  hr { border:none; border-top:2px solid #000; margin:14px 0 18px; }
  h2 { font-size:14px; color:#000; background:#FFC000; display:inline-block; padding:4px 10px; border-radius:4px; margin:18px 0 4px; }
  .resumo { font-size:12px; color:#404040; margin-bottom:8px; }
  .print-team { break-inside: avoid; page-break-inside: avoid; }
  table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:6px; }
  th { background:#eee; text-align:left; padding:6px 8px; font-size:11px; text-transform:uppercase; }
  td { padding:5px 8px; border-top:1px solid #ddd; }
  td.inop { color:#C53030; font-weight:700; } td.op { color:#2F855A; font-weight:700; }
  .total { margin-top:16px; font-size:13px; font-weight:700; }
  .botoes { margin-top:22px; }
  .botoes button { background:#FFC000; color:#000; border:none; border-radius:8px; padding:10px 18px; font-size:14px; font-weight:800; cursor:pointer; }
  .aviso { font-size:12px; color:#6B7280; margin-top:10px; }
  @media print { .botoes, .aviso { display:none; } @page { margin:14mm; } }
</style></head>
<body>
  <h1>Dromos Infraestrutura — VIAR Bloco 1</h1>
  <div class="sub">Relatório ${d.periodo ? "por período" : "diário"} por ${porEq ? "equipamento" : "equipe"}</div>
  <div class="filtros">
    ${d.periodo ? "Período" : "Data"}: ${esc(descPeriodo(d))} &nbsp;·&nbsp; Equipe: ${esc(d.equipe)}${d.equipId ? ` &nbsp;·&nbsp; Equipamento: ${esc(d.equipMap[d.equipId] ? equipLabel(d.equipMap[d.equipId]) : "-")}` : ""} &nbsp;·&nbsp; Emitido em: ${esc(fmtDate(todayISO()))}
  </div>
  <hr/>
  ${corpo}
  <div class="total">Total geral: ${d.registros.length} apontamento(s) · ${fmtNum(somaHoras(d.registros), 1)} h trabalhadas</div>
  <div class="botoes"><button onclick="window.print()">🖨️ Imprimir / Salvar como PDF</button></div>
  <div class="aviso">Se o botão não abrir a caixa de impressão, use o menu do navegador (⋮ ou compartilhar) e escolha "Imprimir".</div>
</body></html>`;

  const url = URL.createObjectURL(new Blob([docHtml], { type: "text/html" }));
  const janela = window.open(url, "_blank");
  if (!janela) {
    alert("Não consegui abrir a nova aba do relatório — seu navegador pode ter bloqueado o pop-up. Permita pop-ups para este site e tente de novo.");
    return;
  }
  janela.addEventListener("load", () => { setTimeout(() => { try { janela.print(); } catch (e) {} }, 300); });
}

function csvCampo(v) {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportarExcelCsv() {
  const d = relatorioDados();
  if (d.registros.length === 0) { alert("Não há apontamentos para esse filtro. Confira a data/período e a equipe."); return; }
  const linhas = [["Data", "Equipe", "Prefixo", "Horímetro inicial (h)", "Horímetro final (h)", "Horas trabalhadas (h)", "Status", "Evento"]];
  d.registros.forEach((r) => {
    const eq = d.equipMap[r.equipamentoId];
    const h = horasDe(r);
    linhas.push([
      fmtDate(r.data), r.equipe || "", eq ? (eq.prefixo || eq.placa || "") : "(equipamento removido)",
      r.horimetroInicial !== "" ? String(r.horimetroInicial).replace(".", ",") : "",
      r.horimetroFinal !== "" ? String(r.horimetroFinal).replace(".", ",") : "",
      h !== null ? fmtNum(h, 1) : "",
      r.status || "", r.status === "Inoperante" ? (r.evento || "") : "",
    ]);
  });
  const csv = linhas.map((l) => l.map(csvCampo).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
  const equipeSlug = d.equipe === "Todas" ? "todas-equipes" : slug(d.equipe);
  const periodo = d.ini === d.fim ? d.ini : `${d.ini}_a_${d.fim}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = `apontamento_${d.agrupar === "equipamento" ? "por-equipamento_" : ""}${periodo}_${equipeSlug}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================================================
   DADOS (exportar / importar / consolidar entre aparelhos)
   ============================================================ */
function baixarArquivo(nome, conteudo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportarDados() {
  const payload = {
    tipo: "apontamento-campo-export", versao: 2, exportadoEm: new Date().toISOString(),
    equipes: state.equipes, equipamentos: state.equipamentos, apontamentos: state.apontamentos,
  };
  baixarArquivo(`apontamento-campo_${todayISO()}_${uid()}.json`, JSON.stringify(payload));
}
function mesclarPorId(existentes, novos) {
  const map = {};
  existentes.forEach((i) => (map[i.id] = i));
  novos.forEach((i) => (map[i.id] = i));
  return Object.values(map);
}
async function importarArquivos(fileList) {
  let tEq = 0, tAp = 0;
  for (const file of fileList) {
    try {
      const json = JSON.parse(await file.text());
      const eqs = Array.isArray(json.equipamentos) ? json.equipamentos : [];
      const aps = Array.isArray(json.apontamentos) ? json.apontamentos : [];
      const tms = Array.isArray(json.equipes) ? json.equipes : [];
      state.equipamentos = mesclarPorId(state.equipamentos, eqs);
      state.apontamentos = mesclarPorId(state.apontamentos, aps);
      tms.forEach((t) => { if (t && t.nome && !state.equipes.some((x) => x.nome.toLowerCase() === t.nome.toLowerCase())) state.equipes.push(t); });
      tEq += eqs.length; tAp += aps.length;
    } catch (e) {
      alert(`Não foi possível ler o arquivo "${file.name}". Confira se é um export válido deste app.`);
    }
  }
  migrar(); // aceita também arquivos exportados por versões antigas
  await saveEquipes(); await saveEquipamentos(); await saveApontamentos();
  alert(`Importação concluída: ${tEq} equipamento(s) e ${tAp} apontamento(s) processados (duplicados foram unificados).`);
  renderEquipList(); renderAptList(); renderRelatorioEquipeSelect(); renderRelatorioPreview(); resetAptFormKeep();
}
function setupDadosTab() {
  $("btnExportar").addEventListener("click", exportarDados);
  $("btnImportar").addEventListener("click", async () => {
    const input = $("fileImportar");
    if (!input.files || input.files.length === 0) { alert("Selecione ao menos um arquivo .json exportado antes de importar."); return; }
    await importarArquivos(Array.from(input.files));
    input.value = "";
  });
  $("btnLimparDados").addEventListener("click", async () => {
    if (!confirm("Isso vai apagar TODOS os equipamentos, apontamentos e equipes salvos neste aparelho. Exportou uma cópia antes? Deseja continuar?")) return;
    state.equipamentos = []; state.apontamentos = []; state.equipes = [];
    migrar(); // volta as equipes padrão
    await saveEquipes(); await saveEquipamentos(); await saveApontamentos();
    renderEquipList(); renderAptList(); renderRelatorioPreview(); resetAptFormKeep();
    alert("Dados deste aparelho apagados.");
  });
}


/* ============================================================
   INIT
   ============================================================ */
async function init() {
  setupTabs();
  await iniciarDados();
  state.aptForm = emptyAptForm();
  renderEquipeSelect();
  renderEquipamentoSelect();
  syncAptFormToDom();
  attachAptFormEvents();
  renderAptList();
  setupEquipes();
  setupEquipModalEvents();
  $("btnImportarCadastro").addEventListener("click", importarCadastroColado);
  setupRelatorioTab();
  setupDadosTab();
}
init();
