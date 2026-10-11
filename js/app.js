/*! Caixa na Mão © 2026 Marcus Deleon™ – Tecnologia de Ponta. Todos os direitos reservados.
 *  Proibida a cópia, modificação ou distribuição sem autorização. Veja LICENSE. */

/*
 * Caixa na Mão — liga a tela aos cálculos e ao armazenamento.
 * Depende de dinheiro.js, calculos.js e armazenamento.js (carregados antes).
 */

const ENTRADAS = [
  { tipo: "dinheiro", rotulo: "Dinheiro", dica: "Em espécie · vai para a gaveta" },
  { tipo: "pix", rotulo: "Pix", dica: "Vai para o banco" },
  { tipo: "debito", rotulo: "Cartão de débito", dica: "Vai para o banco" },
  { tipo: "credito", rotulo: "Cartão de crédito", dica: "Cai no banco depois" },
  { tipo: "outras", rotulo: "Outras entradas", dica: "Transferência, adiantamento…", escolheLugar: true },
];

const SAIDAS = [
  { tipo: "materiais", rotulo: "Compras de materiais", dica: "Garrafas, gelo, ingredientes" },
  { tipo: "embalagens", rotulo: "Embalagens e descartáveis", dica: "Copos, canudos, sacolas, guardanapos" },
  { tipo: "fretes", rotulo: "Fretes e transporte", dica: "Ônibus, entregas, combustível" },
  { tipo: "pessoais", rotulo: "Despesas pessoais", dica: "Alimentação, retirada para casa" },
  { tipo: "taxas", rotulo: "Taxas e tarifas", dica: "Maquininha, banco", padrao: "banco" },
  { tipo: "outras", rotulo: "Outras despesas", dica: "Manutenção, doações, diversas" },
];

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ORDEM_FOLGAS = [1, 2, 3, 4, 5, 6, 0]; // Seg … Dom
const MSG_INVALIDO = "Valor não reconhecido. Use só números, com vírgula ou ponto nos centavos (ex.: 12,50).";

const $ = (id) => document.getElementById(id);

let dados = carregarDados();
let dataAtual = hojeISO();

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

function paraISO(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function deISO(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
}
function hojeISO() { return paraISO(new Date()); }
function somarDias(iso, n) {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return paraISO(d);
}
function dataCurta(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

function moeda(centavos) {
  return (centavos < 0 ? "− " : "") + "R$ " + formatarCentavos(Math.abs(centavos));
}

// ---------------------------------------------------------------------------
// Montagem das linhas de entradas e saídas
// ---------------------------------------------------------------------------

function htmlCampoValor(id, campo, somar = false) {
  return `
    <div class="valor-com-limpar">
      <div class="campo-valor">
        <span>R$</span>
        <input id="${id}" data-campo="${campo}" ${somar ? "data-soma" : ""} inputmode="numeric" autocomplete="off" placeholder="0,00" />
      </div>
      ${somar ? `<button type="button" class="somar-campo" aria-label="Somar outro valor" title="Somar outro valor">+</button>` : ""}
      <button type="button" class="limpar-campo" aria-label="Limpar valor">Limpar</button>
    </div>
    <p class="erro-campo" hidden></p>`;
}

function htmlAlternador(nome, rotulo) {
  return `
    <div class="alternador" role="radiogroup" aria-label="${rotulo}">
      <label><input type="radio" name="${nome}" value="gaveta" /><span>Gaveta</span></label>
      <label><input type="radio" name="${nome}" value="banco" /><span>Banco</span></label>
    </div>`;
}

function montarLinhas() {
  $("linhasEntradas").innerHTML = ENTRADAS.map((e) => `
    <div class="linha">
      <div class="linha-rotulo">
        <label for="ent-${e.tipo}">${e.rotulo}</label>
        <small>${e.dica}</small>
      </div>
      ${htmlCampoValor(`ent-${e.tipo}`, `entrada.${e.tipo}`, true)}
      <div class="linha-extra">
        <span class="texto-com-limpar">
          <input class="descricao" data-desc="entrada.${e.tipo}" maxlength="200" placeholder="Observação (opcional)" aria-label="Observação: ${e.rotulo}" />
          <button type="button" class="limpar-texto" aria-label="Limpar observação">Limpar</button>
        </span>
        ${e.escolheLugar ? htmlAlternador("outrasEntradasEm", "Onde entrou") : ""}
      </div>
    </div>`).join("");

  $("linhasSaidas").innerHTML = SAIDAS.map((s) => `
    <div class="linha">
      <div class="linha-rotulo">
        <label for="sai-${s.tipo}">${s.rotulo}</label>
        <small>${s.dica}</small>
      </div>
      ${htmlCampoValor(`sai-${s.tipo}`, `saida.${s.tipo}`, true)}
      <div class="linha-extra">
        <span class="texto-com-limpar">
          <input class="descricao" data-desc="saida.${s.tipo}" maxlength="200" placeholder="Observação (opcional)" aria-label="Observação: ${s.rotulo}" />
          <button type="button" class="limpar-texto" aria-label="Limpar observação">Limpar</button>
        </span>
        ${htmlAlternador(`pago-${s.tipo}`, `Pago com (${s.rotulo})`)}
      </div>
    </div>`).join("");

  $("gradeCedulas").innerHTML = VALORES_CEDULAS.map((v) => `
    <label class="cedula-rotulo" for="ced-${v}">R$ ${v / 100}</label>
    <input class="cedula-qtd" id="ced-${v}" data-cedula="${v}" inputmode="numeric" autocomplete="off"
           maxlength="5" placeholder="0" aria-label="Quantas notas de R$ ${v / 100}" />
    <span class="cedula-subtotal" id="sub-${v}">R$ 0,00</span>`).join("") + `
    <label class="cedula-rotulo" for="ced-moedas">Moedas</label>
    <div class="moedas">${htmlCampoValor("ced-moedas", "cedulas.moedas")}</div>`;

  $("listaFolgas").innerHTML = ORDEM_FOLGAS.map((d) => `
    <label class="folga">
      <input type="checkbox" value="${d}" />
      <span>${DIAS_SEMANA[d].slice(0, 3)}</span>
    </label>`).join("");
}

// ---------------------------------------------------------------------------
// Dia atual
// ---------------------------------------------------------------------------

function diaEstaVazio(dia) {
  return Object.keys(dia.entradas).length === 0
    && Object.keys(dia.saidas).length === 0
    && dia.contado === null
    && dia.anteriorManual === null
    && !dia.anotacoes
    && Object.values(dia.descricoes).every((t) => !t);
}

/** Lê o dia atual, aplica a mudança e grava (ou apaga, se ficou vazio). */
function alterarDia(mudanca) {
  const dia = lerDia(dados, dataAtual);
  mudanca(dia);
  if (diaEstaVazio(dia)) apagarDia(dados, dataAtual);
  else gravarDia(dados, dataAtual, dia);
  salvar();
}

function pagoComSelecionado(tipo) {
  const marcado = document.querySelector(`input[name="pago-${tipo}"]:checked`);
  return marcado ? marcado.value : "gaveta";
}

/** Guarda o valor (em centavos, ou null se vazio) de um campo data-campo. */
function aplicarCampo(campo, valor) {
  const [grupo, chave, sub] = campo.split(".");

  if (grupo === "temporada") {
    if (chave === "meta") dados.temporada.meta = valor;
    else dados.temporada.saldoInicial[sub] = valor ?? 0;
    salvar();
    return;
  }

  alterarDia((dia) => {
    if (grupo === "entrada") {
      if (valor === null) delete dia.entradas[chave];
      else dia.entradas[chave] = valor;
    } else if (grupo === "saida") {
      if (valor === null) delete dia.saidas[chave];
      else dia.saidas[chave] = { valor, pagoCom: pagoComSelecionado(chave) };
    } else if (grupo === "contado") {
      // Digitou (ou tocou em "Bateu"): a contagem por cédulas deixa de valer.
      dia.contado = valor;
      dia.cedulas = {};
    } else if (grupo === "cedulas") {
      dia.cedulas = { ...dia.cedulas };
      if (valor) dia.cedulas.moedas = valor; else delete dia.cedulas.moedas;
      dia.contado = totalCedulas(dia.cedulas) || null;
    } else if (grupo === "anterior" && !dia.anteriorManual
               && saldoAnteriorDe(dados, dataAtual).origem === "inicio-temporada") {
      // Primeiro dia: o saldo anterior é o saldo inicial da temporada,
      // e os dias seguintes passam a partir dele.
      dados.temporada.saldoInicial[chave] = valor ?? 0;
      preencherTemporada();
    } else if (grupo === "anterior") {
      // Ao ajustar à mão, o outro lado começa com o valor automático atual.
      const base = dia.anteriorManual || saldoAnteriorDe(dados, dataAtual).anterior;
      dia.anteriorManual = { ...base, [chave]: valor ?? 0 };
    }
  });
}

// ---------------------------------------------------------------------------
// Salvar
// ---------------------------------------------------------------------------

function salvar() {
  const ok = salvarDados(dados);
  $("avisoArmazenamento").hidden = ok;
  $("estadoSalvo").textContent = ok
    ? "Tudo é salvo automaticamente neste navegador."
    : "Atenção: não está salvando neste navegador.";
}

// ---------------------------------------------------------------------------
// Campos de valor: validação, botão Limpar e formatação
// ---------------------------------------------------------------------------

function partesDoCampo(input) {
  const caixa = input.closest(".campo-valor");
  const grupo = caixa.closest(".valor-com-limpar");
  return { caixa, limpar: grupo.querySelector(".limpar-campo"), erro: grupo.nextElementSibling };
}

function marcarValidade(input) {
  const { caixa, limpar, erro } = partesDoCampo(input);
  const valor = lerSoma(input.value);
  const valido = valor !== null;
  caixa.classList.toggle("invalido", !valido);
  input.setAttribute("aria-invalid", String(!valido));
  if (erro && erro.classList.contains("erro-campo")) {
    erro.hidden = valido;
    erro.textContent = valido ? "" : MSG_INVALIDO;
  }
  limpar.disabled = input.value === "";
  const somar = limpar.parentElement.querySelector(".somar-campo");
  if (somar) somar.disabled = input.value === "";
  const linha = input.closest(".linha");
  if (linha) linha.classList.toggle("vazia", input.value === "");
  return valor;
}

function mostrarValor(input, centavos) {
  input.value = centavos === null || centavos === undefined ? "" : formatarCentavos(centavos);
  marcarValidade(input);
}

/**
 * Vírgula flutuante: a cada tecla, refaz o valor só com os dígitos
 * ("171150" → "1.711,50") e deixa o cursor no fim.
 */
function aoDigitarValor(input, ev) {
  const apagando = Boolean(ev && ev.inputType && ev.inputType.startsWith("delete"));
  const ehSoma = "soma" in input.dataset && input.value.includes("+");
  const mascara = "soma" in input.dataset ? mascararSoma(input.value, apagando) : mascararCentavos(input.value);
  let valor = mascara.centavos;
  // Apagando até zerar ("0,01" → "0,00"), o campo fica vazio.
  if (valor === 0 && apagando && !ehSoma) valor = null;
  const ehAnterior = input.dataset.campo.startsWith("anterior.");
  input.value = valor === null ? (ehAnterior ? "0,00" : "") : mascara.texto;
  if (document.activeElement === input) input.setSelectionRange(input.value.length, input.value.length);
  marcarValidade(input);
  aplicarCampo(input.dataset.campo, valor);
  if (input.dataset.campo === "contado") preencherCedulas();
  if (input.dataset.campo === "cedulas.moedas") aposContarCedulas();
  atualizarTela();
}

// ---------------------------------------------------------------------------
// Contar por cédulas
// ---------------------------------------------------------------------------

function aoDigitarCedula(input) {
  input.value = input.value.replace(/\D/g, "").slice(0, 5);
  const qtd = Number(input.value) || 0;
  alterarDia((dia) => {
    dia.cedulas = { ...dia.cedulas };
    if (qtd > 0) dia.cedulas[input.dataset.cedula] = qtd;
    else delete dia.cedulas[input.dataset.cedula];
    dia.contado = totalCedulas(dia.cedulas) || null;
  });
  aposContarCedulas();
  atualizarTela();
}

/** Atualiza subtotais, total e o campo "Quanto tem de verdade" depois de mexer nas cédulas. */
function aposContarCedulas() {
  const dia = lerDia(dados, dataAtual);
  mostrarValor($("contado"), dia.contado);
  mostrarSubtotaisCedulas(dia.cedulas);
}

function mostrarSubtotaisCedulas(cedulas) {
  for (const v of VALORES_CEDULAS) {
    const qtd = cedulas[v] || 0;
    const sub = $(`sub-${v}`);
    sub.textContent = moeda(qtd * v);
    sub.classList.toggle("preenchido", qtd > 0);
  }
  $("totalCedulas").textContent = moeda(totalCedulas(cedulas));
}

/** Mostra a contagem salva do dia (ou campos vazios). */
function preencherCedulas() {
  const { cedulas } = lerDia(dados, dataAtual);
  for (const v of VALORES_CEDULAS) $(`ced-${v}`).value = cedulas[v] ? String(cedulas[v]) : "";
  mostrarValor($("ced-moedas"), cedulas.moedas ?? null);
  mostrarSubtotaisCedulas(cedulas);
  if (totalCedulas(cedulas) > 0) $("painelCedulas").open = true;
}

function ligarCamposDeValor() {
  document.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.matches("input[data-campo]")) aoDigitarValor(el, ev);
    else if (el.matches("input[data-cedula]")) aoDigitarCedula(el);
  });

  // Colar "12,50", "12.50" ou "1.000" entende o valor escrito, não só os dígitos.
  document.addEventListener("paste", (ev) => {
    const el = ev.target;
    if (!el.matches("input[data-campo]")) return;
    const valor = lerSoma(ev.clipboardData.getData("text"));
    if (valor === null) return; // deixa a máscara usar os dígitos
    ev.preventDefault();
    el.value = formatarCentavos(valor);
    aoDigitarValor(el);
  });

  document.addEventListener("focusout", (ev) => {
    const el = ev.target;
    if (!el.matches("input[data-campo]") || el.value.trim() === "") return;
    // Ao sair do campo, "50,00 + 30,00" vira "80,00".
    const valor = lerSoma(el.value);
    if (valor !== null) mostrarValor(el, valor);
  });

  document.addEventListener("keydown", (ev) => {
    const el = ev.target;
    if (ev.key === "Enter" && el.matches("input[data-cedula]")) {
      // Enter passa para a próxima nota (e por fim para as moedas).
      ev.preventDefault();
      const campos = [...document.querySelectorAll("input[data-cedula], #ced-moedas")];
      campos[campos.indexOf(el) + 1].focus();
      return;
    }
    if (ev.key !== "Enter" || !el.matches("input[data-campo]")) return;
    ev.preventDefault();
    const campos = [...document.querySelectorAll("input[data-campo]")].filter((c) => c.offsetParent !== null);
    const proximo = campos[campos.indexOf(el) + 1];
    if (proximo) proximo.focus(); else el.blur();
  });

  // O "+" não tira o foco do campo (no celular, o teclado continua aberto).
  document.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest(".somar-campo")) ev.preventDefault();
  });

  document.addEventListener("click", (ev) => {
    const botaoTexto = ev.target.closest(".limpar-texto");
    if (botaoTexto) {
      const campo = botaoTexto.parentElement.querySelector("input, textarea");
      campo.value = "";
      campo.dispatchEvent(new Event("input", { bubbles: true }));
      campo.focus();
      return;
    }
    const somar = ev.target.closest(".somar-campo");
    if (somar) {
      const input = somar.closest(".valor-com-limpar").querySelector("input");
      if (input.value.trim() && !/\+\s*$/.test(input.value)) {
        input.value += " +";
        aoDigitarValor(input);
      }
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      return;
    }
    const botao = ev.target.closest(".limpar-campo");
    if (!botao) return;
    const input = botao.closest(".valor-com-limpar").querySelector("input");
    input.value = "";
    aoDigitarValor(input);
    input.focus();
  });
}

// ---------------------------------------------------------------------------
// Outros campos
// ---------------------------------------------------------------------------

/** Botão "Limpar" das observações e anotações fica apagado quando o texto está vazio. */
function atualizarBotoesTexto() {
  document.querySelectorAll(".limpar-texto").forEach((botao) => {
    const campo = botao.parentElement.querySelector("input, textarea");
    botao.disabled = campo.value === "";
    botao.parentElement.classList.toggle("vazio", campo.value === "");
  });
  $("cartaoAnotacoes").classList.toggle("vazio", $("anotacoes").value.trim() === "");
}

function ligarOutrosCampos() {
  document.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.matches("input[data-desc]")) {
      alterarDia((dia) => {
        if (el.value.trim()) dia.descricoes[el.dataset.desc] = el.value;
        else delete dia.descricoes[el.dataset.desc];
      });
    } else if (el.id === "anotacoes") {
      alterarDia((dia) => { dia.anotacoes = el.value; });
    }
    if (el.matches("input[data-desc], #anotacoes")) atualizarBotoesTexto();
  });

  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.name === "outrasEntradasEm") {
      alterarDia((dia) => { dia.outrasEntradasEm = el.value; });
      atualizarTela();
    } else if (el.name && el.name.startsWith("pago-")) {
      const tipo = el.name.slice(5);
      alterarDia((dia) => { if (dia.saidas[tipo]) dia.saidas[tipo].pagoCom = el.value; });
      atualizarTela();
    } else if (el.closest("#listaFolgas")) {
      dados.temporada.folgas = [...document.querySelectorAll("#listaFolgas input:checked")].map((c) => Number(c.value));
      salvar();
      atualizarTela();
    } else if (el.id === "inicioTemporada" || el.id === "fimTemporada") {
      dados.temporada[el.id === "inicioTemporada" ? "inicio" : "fim"] = el.value;
      salvar();
      atualizarTela();
    }
  });

  $("usarAnteriorAutomatico").addEventListener("click", () => {
    alterarDia((dia) => { dia.anteriorManual = null; });
    preencherAnterior();
    atualizarTela();
  });
}

// ---------------------------------------------------------------------------
// Navegação entre dias
// ---------------------------------------------------------------------------

function irPara(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
  dataAtual = iso;
  preencherDia();
}

function ligarNavegacao() {
  $("data").addEventListener("change", (ev) => { if (ev.target.value) irPara(ev.target.value); });
  $("diaAnterior").addEventListener("click", () => irPara(somarDias(dataAtual, -1)));
  $("diaSeguinte").addEventListener("click", () => irPara(somarDias(dataAtual, 1)));
  $("irParaHoje").addEventListener("click", () => irPara(hojeISO()));
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

function ligarAcoes() {
  // Conferiu e bateu: preenche o contado com o que deveria ter na gaveta.
  $("caixaBateu").addEventListener("click", () => {
    const esperado = calcularData(dados, dataAtual).resultado.gavetaEsperada;
    mostrarValor($("contado"), esperado);
    aplicarCampo("contado", esperado);
    preencherCedulas();
    atualizarTela();
  });

  $("imprimir").addEventListener("click", () => window.print());

  const fazerBackup = () => {
    baixarBackup(dados);
    marcarBackupFeito();
    atualizarLembreteBackup();
  };
  $("exportar").addEventListener("click", fazerBackup);
  $("backupAgora").addEventListener("click", fazerBackup);

  $("importar").addEventListener("click", () => $("arquivoBackup").click());
  $("arquivoBackup").addEventListener("change", async (ev) => {
    const arquivo = ev.target.files[0];
    ev.target.value = "";
    if (!arquivo) return;
    try {
      const novos = lerBackup(await arquivo.text());
      const qtd = datasSalvas(novos).length;
      const ok = confirm(`Este backup tem ${qtd} dia(s) registrado(s).\n\nSubstituir TODOS os dados deste navegador pelos do backup?`);
      if (!ok) return;
      dados = novos;
      salvar();
      preencherTemporada();
      preencherDia();
      atualizarLembreteBackup();
    } catch (erro) {
      alert(erro.message);
    }
  });

  $("limparDia").addEventListener("click", () => {
    const dataTexto = deISO(dataAtual).toLocaleDateString("pt-BR");
    if (!confirm(`Apagar todos os valores de ${dataTexto}?`)) return;
    apagarDia(dados, dataAtual);
    salvar();
    preencherDia();
  });
}

// ---------------------------------------------------------------------------
// Preencher a tela
// ---------------------------------------------------------------------------

function preencherDia() {
  const dia = lerDia(dados, dataAtual);

  $("data").value = dataAtual;
  $("diaSemana").textContent = DIAS_SEMANA[deISO(dataAtual).getDay()].slice(0, 3);

  for (const e of ENTRADAS) mostrarValor($(`ent-${e.tipo}`), dia.entradas[e.tipo]);
  for (const s of SAIDAS) {
    const saida = dia.saidas[s.tipo];
    mostrarValor($(`sai-${s.tipo}`), saida ? saida.valor : null);
    const lugar = saida ? saida.pagoCom : (s.padrao || "gaveta");
    document.querySelector(`input[name="pago-${s.tipo}"][value="${lugar}"]`).checked = true;
  }
  document.querySelector(`input[name="outrasEntradasEm"][value="${dia.outrasEntradasEm}"]`).checked = true;

  document.querySelectorAll("input[data-desc]").forEach((el) => {
    el.value = dia.descricoes[el.dataset.desc] || "";
  });
  $("anotacoes").value = dia.anotacoes;
  atualizarBotoesTexto();

  mostrarValor($("contado"), dia.contado);
  $("painelCedulas").open = false;
  preencherCedulas();
  preencherAnterior();

  atualizarTela();
}

/** Mostra o saldo anterior em vigor (automático ou ajustado à mão). */
function preencherAnterior() {
  const { anterior } = saldoAnteriorDe(dados, dataAtual);
  mostrarValor($("anteriorGaveta"), anterior.gaveta);
  mostrarValor($("anteriorBanco"), anterior.banco);
}

function preencherTemporada() {
  const t = dados.temporada;
  mostrarValor($("metaTemporada"), t.meta);
  mostrarValor($("inicialGaveta"), t.saldoInicial.gaveta || null);
  mostrarValor($("inicialBanco"), t.saldoInicial.banco || null);
  $("inicioTemporada").value = t.inicio;
  $("fimTemporada").value = t.fim;
  document.querySelectorAll("#listaFolgas input").forEach((c) => {
    c.checked = t.folgas.includes(Number(c.value));
  });
}

/** Recalcula e mostra todos os resultados. */
function atualizarTela() {
  const { anterior, origemAnterior, resultado: r } = calcularData(dados, dataAtual);

  // Resumo
  const resultado = $("resResultado");
  resultado.textContent = moeda(r.resultadoDia);
  resultado.classList.toggle("negativo", r.resultadoDia < 0);
  $("resGaveta").textContent = moeda(r.saldoFinal.gaveta);
  $("resBanco").textContent = moeda(r.saldoFinal.banco);
  $("resTotal").textContent = moeda(r.saldoAcumulado);
  $("resAnterior").textContent = moeda(anterior.gaveta + anterior.banco);
  $("resAnteriorNota").textContent =
    origemAnterior === "manual" ? "Ajustado à mão"
    : origemAnterior === "inicio-temporada" ? "Início da temporada"
    : `Veio do dia ${dataCurta(origemAnterior)}`;
  $("resGaveta").classList.toggle("negativo", r.saldoFinal.gaveta < 0);
  $("resTotal").classList.toggle("negativo", r.saldoAcumulado < 0);

  // Totais
  $("totalEntradas").textContent = moeda(r.totalEntradas);
  $("totalSaidas").textContent = moeda(r.totalSaidas);

  // Conferência
  $("confAnterior").textContent = moeda(anterior.gaveta);
  $("confEntrou").textContent = moeda(r.entrouNaGaveta);
  $("confSaiu").textContent = moeda(r.saiuDaGaveta);
  $("confEsperado").textContent = moeda(r.gavetaEsperada);
  $("origemAnterior").textContent =
    origemAnterior === "manual" ? "Ajustado à mão"
    : origemAnterior === "inicio-temporada" ? "Veio do início da temporada"
    : `Veio do dia ${dataCurta(origemAnterior)}`;
  $("avisoAnteriorManual").hidden = origemAnterior !== "manual";
  $("dicaPrimeiroDia").hidden = origemAnterior !== "inicio-temporada";

  // "Bateu" só aparece antes de contar, para não esconder uma diferença já anotada.
  const bateu = $("caixaBateu");
  bateu.hidden = r.conferencia !== "nao-conferido" || r.gavetaEsperada < 0;
  bateu.textContent = `✓ Bateu, tem ${moeda(r.gavetaEsperada)} na gaveta`;

  const conf = $("conferencia");
  conf.dataset.estado = r.conferencia;
  conf.textContent = {
    "nao-conferido": "Conte a gaveta para conferir.",
    bateu: "✓ O caixa bateu!",
    sobrou: `Sobrou ${moeda(r.diferenca)} na gaveta. Confira se faltou anotar alguma entrada.`,
    faltou: `Faltou ${moeda(-r.diferenca)} na gaveta. Confira se faltou anotar alguma saída.`,
  }[r.conferencia];

  atualizarMeta(r);
  atualizarPeriodo();
}

function atualizarMeta(r) {
  const t = dados.temporada;
  const inicial = t.saldoInicial.gaveta + t.saldoInicial.banco;
  const temDatas = t.inicio && t.fim && t.fim >= t.inicio;
  const dias = temDatas ? contarDiasDeTrabalho(t.inicio, t.fim, t.folgas) : 0;
  const falta = t.meta === null ? null : t.meta - inicial;
  const metaDia = falta !== null && falta > 0 ? calcularMetaDiaria(falta, dias) : null;

  // Texto do painel da temporada
  const partes = [];
  if (t.meta !== null) partes.push(`Meta: ${moeda(t.meta)}`);
  if (temDatas) partes.push(`${dataCurta(t.inicio)} a ${dataCurta(t.fim)}`);
  $("resumoTemporada").textContent = partes.length ? partes.join(" · ") : "Defina a meta e as datas da temporada";

  let explicacao = "";
  if (t.meta !== null && !temDatas) explicacao = "Informe o início e o fim da temporada para calcular a meta por dia.";
  else if (t.meta !== null && dias === 0) explicacao = "Não há dias de trabalho entre essas datas.";
  else if (falta !== null && falta <= 0) explicacao = "O saldo inicial já alcança a meta da temporada.";
  else if (metaDia !== null) {
    const ultimoSalvo = datasSalvas(dados).filter((d) => d <= t.fim).pop();
    const saldoAgora = ultimoSalvo ? calcularData(dados, ultimoSalvo).resultado.saldoAcumulado : inicial;
    const pct = Math.max(0, Math.min(100, Math.round((saldoAgora / t.meta) * 100)));
    explicacao = `${dias} dias de trabalho → precisa de ${moeda(metaDia)} de resultado por dia. `
      + `Até agora: ${moeda(saldoAgora)} de ${moeda(t.meta)} (${pct}%).`;
  }
  $("calculoMeta").textContent = explicacao;

  // Barra da meta do dia
  const caixa = $("metaDia");
  caixa.hidden = metaDia === null;
  if (metaDia === null) return;
  const pctDia = Math.max(0, Math.round((r.resultadoDia / metaDia) * 100));
  $("metaValor").textContent = moeda(metaDia);
  $("metaPercentual").textContent = `${pctDia}%`;
  $("metaBarra").style.width = Math.min(100, pctDia) + "%";
  caixa.querySelector(".meta-barra").setAttribute("aria-valuenow", String(Math.min(100, pctDia)));
  caixa.classList.toggle("alcancada", pctDia >= 100);
}

// ---------------------------------------------------------------------------
// Resumo da semana e do mês
// ---------------------------------------------------------------------------

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Semana de segunda a domingo, ou o mês, que contém a data. */
function limitesDoPeriodo(iso, tipo) {
  if (tipo === "mes") {
    const d = deISO(iso);
    return {
      inicio: paraISO(new Date(d.getFullYear(), d.getMonth(), 1)),
      fim: paraISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
      nome: `${MESES[d.getMonth()]} de ${d.getFullYear()}`,
    };
  }
  const recuo = (deISO(iso).getDay() + 6) % 7; // segunda = 0
  const inicio = somarDias(iso, -recuo);
  const fim = somarDias(inicio, 6);
  return { inicio, fim, nome: `Semana de ${dataCurta(inicio)} a ${dataCurta(fim)}` };
}

function textoGaveta(dia) {
  if (dia.conferencia === "bateu") return `<span class="gaveta-bateu">✓</span>`;
  if (dia.conferencia === "sobrou") return `<span class="gaveta-sobrou">+${moeda(dia.diferenca)}</span>`;
  if (dia.conferencia === "faltou") return `<span class="gaveta-faltou">−${moeda(-dia.diferenca)}</span>`;
  return `<span class="gaveta-nao" title="Gaveta não conferida">—</span>`;
}

function atualizarPeriodo() {
  if (!$("painelPeriodo").open) return;
  const tipo = document.querySelector('input[name="periodo"]:checked').value;
  const { inicio, fim, nome } = limitesDoPeriodo(dataAtual, tipo);
  const p = resumirPeriodo(dados, inicio, fim);

  $("periodoNome").textContent = nome;
  $("perEntradas").textContent = moeda(p.totalEntradas);
  $("perSaidas").textContent = moeda(p.totalSaidas);
  $("perResultado").textContent = moeda(p.resultado);
  $("perResultado").classList.toggle("negativo", p.resultado < 0);
  $("perDias").textContent = String(p.dias.length);
  $("perMedia").textContent = p.media === null ? "—" : moeda(p.media);
  $("perMedia").classList.toggle("negativo", p.media !== null && p.media < 0);
  $("perMelhor").textContent = p.melhor ? `${dataCurta(p.melhor.data)} · ${moeda(p.melhor.resultado)}` : "—";

  $("periodoVazio").hidden = p.dias.length > 0;
  $("periodoTabela").hidden = p.dias.length === 0;
  document.querySelector(".periodo-dica").hidden = p.dias.length === 0;
  const maior = Math.max(1, ...p.dias.map((d) => Math.abs(d.resultado)));
  $("periodoLinhas").innerHTML = p.dias.map((d) => {
    const largura = Math.round((Math.abs(d.resultado) / maior) * 100);
    const semana = DIAS_SEMANA[deISO(d.data).getDay()].slice(0, 3);
    return `
      <tr data-data="${d.data}" class="${d.data === dataAtual ? "atual" : ""}" tabindex="0">
        <td>${semana} ${dataCurta(d.data)}</td>
        <td class="col-extra">${moeda(d.entradas)}</td>
        <td class="col-extra">${moeda(d.saidas)}</td>
        <td class="resultado-celula">
          <div class="barra ${d.resultado < 0 ? "negativa" : ""}" style="width:${largura}%"></div>
          <span class="${d.resultado < 0 ? "negativo" : ""}">${moeda(d.resultado)}</span>
        </td>
        <td>${textoGaveta(d)}</td>
      </tr>`;
  }).join("");

  atualizarMetaPeriodo();
}

/** "Faltam R$ X em N dias de trabalho → R$ Y por dia", a partir do dia escolhido. */
function atualizarMetaPeriodo() {
  const t = dados.temporada;
  const caixa = $("periodoMeta");
  const temDatas = t.inicio && t.fim && t.fim >= t.inicio;
  caixa.hidden = t.meta === null || !temDatas;
  caixa.classList.remove("alcancada");
  if (caixa.hidden) return;

  const ultimoSalvo = datasSalvas(dados).filter((d) => d <= dataAtual && d <= t.fim).pop();
  const saldoAgora = ultimoSalvo
    ? calcularData(dados, ultimoSalvo).resultado.saldoAcumulado
    : t.saldoInicial.gaveta + t.saldoInicial.banco;
  const falta = t.meta - saldoAgora;
  const de = [somarDias(dataAtual, 1), t.inicio].sort()[1];
  const diasRestantes = de <= t.fim ? contarDiasDeTrabalho(de, t.fim, t.folgas) : 0;

  if (falta <= 0) {
    caixa.textContent = `Meta da temporada alcançada: ${moeda(saldoAgora)} de ${moeda(t.meta)}!`;
    caixa.classList.add("alcancada");
  } else if (diasRestantes === 0) {
    caixa.textContent = `A temporada terminou. Ficaram faltando ${moeda(falta)} para a meta de ${moeda(t.meta)}.`;
  } else {
    caixa.textContent = `Meta da temporada: faltam ${moeda(falta)} em ${diasRestantes} dias de trabalho `
      + `→ ${moeda(Math.ceil(falta / diasRestantes))} por dia.`;
  }
}

function ligarPeriodo() {
  $("painelPeriodo").addEventListener("toggle", atualizarPeriodo);
  document.querySelectorAll('input[name="periodo"]').forEach((r) => r.addEventListener("change", atualizarPeriodo));
  const abrirDia = (ev) => {
    const linha = ev.target.closest("tr[data-data]");
    if (!linha) return;
    if (ev.type === "keydown" && ev.key !== "Enter") return;
    irPara(linha.dataset.data);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  $("periodoLinhas").addEventListener("click", abrirDia);
  $("periodoLinhas").addEventListener("keydown", abrirDia);
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

// Lembrete de backup
const DIAS_PARA_LEMBRAR_BACKUP = 7;

function atualizarLembreteBackup() {
  const ultimo = lerUltimoBackup();
  const diasRegistrados = datasSalvas(dados).length;
  let dias = null;
  if (ultimo) {
    const meiaNoite = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    dias = Math.round((meiaNoite(new Date()) - meiaNoite(new Date(ultimo))) / 86400000);
  }

  const quando = dias === null ? null : dias <= 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias`;
  const atrasado = dias === null ? diasRegistrados >= 3 : dias >= DIAS_PARA_LEMBRAR_BACKUP;

  const rodape = $("ultimoBackup");
  rodape.textContent = quando ? `Último backup: ${quando}.` : "Nenhum backup feito ainda.";
  rodape.classList.toggle("atrasado", atrasado);

  $("avisoBackup").hidden = !atrasado;
  $("avisoBackupTexto").textContent = quando
    ? `Seu último backup foi ${quando}. Faça um novo para não perder seus registros.`
    : `Você já tem ${diasRegistrados} dias registrados e nenhum backup. Faça um para não perder seus registros.`;
}

// Relógio digital no topo
function atualizarRelogio() {
  const agora = new Date();
  const dois = (n) => String(n).padStart(2, "0");
  const relogio = $("relogio");
  relogio.firstChild.textContent = `${dois(agora.getHours())}:${dois(agora.getMinutes())}`;
  relogio.lastChild.textContent = `:${dois(agora.getSeconds())}`;
  relogio.dateTime = agora.toISOString();
}

montarLinhas();
atualizarLembreteBackup();
// Confere de novo ao voltar para o app (pode ter virado o dia).
document.addEventListener("visibilitychange", () => { if (!document.hidden) atualizarLembreteBackup(); });
atualizarRelogio();
setInterval(atualizarRelogio, 1000);
ligarCamposDeValor();
ligarOutrosCampos();
ligarNavegacao();
ligarAcoes();
ligarPeriodo();
preencherTemporada();
preencherDia();
$("painelTemporada").open = dados.temporada.meta === null && datasSalvas(dados).length === 0;

// App instalável e sem internet (só funciona em http/https, não ao abrir o arquivo direto).
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* segue funcionando sem cache */ });
}
// Pede ao navegador para não apagar os dados quando faltar espaço.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
