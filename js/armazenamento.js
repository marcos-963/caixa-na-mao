/*! Caixa na Mão © 2026 Marcus Deleon™ – Tecnologia de Ponta. Todos os direitos reservados.
 *  Proibida a cópia, modificação ou distribuição sem autorização. Veja LICENSE. */

/*
 * Caixa na Mão — salvar os dias, passar o saldo de um dia para o outro e backup.
 *
 * Os dados ficam no navegador (localStorage), num único objeto:
 *
 *   {
 *     versao: 1,
 *     temporada: {
 *       meta: 900000,                         // centavos
 *       inicio: "2026-12-01", fim: "2027-02-28",
 *       folgas: [1],                          // dias da semana sem trabalho (0 = domingo)
 *       saldoInicial: { gaveta: 0, banco: 0 } // com quanto a temporada começou
 *     },
 *     dias: {
 *       "2026-12-01": {
 *         entradas: { dinheiro, pix, debito, credito, outras },       // centavos
 *         outrasEntradasEm: "gaveta" | "banco",
 *         saidas: { materiais: { valor, pagoCom: "gaveta" | "banco" }, ... },
 *         descricoes: { "entrada.dinheiro": "texto", "saida.materiais": "texto", ... },
 *         contado: 42000 | null,              // dinheiro contado na gaveta
 *         cedulas: { "5000": 3, "1000": 7, moedas: 350 }, // contagem por notas (opcional)
 *         anteriorManual: { gaveta, banco } | null, // saldo anterior digitado à mão
 *         anotacoes: "texto"
 *       }
 *     }
 *   }
 *
 * O saldo anterior NÃO é guardado: é sempre recalculado a partir dos dias
 * anteriores. Assim, corrigir um dia antigo corrige todos os seguintes.
 */

/** Link com "?demo": app de demonstração, com dados fictícios guardados à parte. */
const MODO_DEMO = new URLSearchParams(location.search).has("demo");
const CHAVE_ARMAZENAMENTO = MODO_DEMO ? "caixa-na-mao-demo" : "caixa-na-mao-v1";
const VERSAO_DADOS = 1;
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

function dadosVazios() {
  return {
    versao: VERSAO_DADOS,
    temporada: { meta: null, inicio: "", fim: "", folgas: [], saldoInicial: { gaveta: 0, banco: 0 } },
    dias: {},
  };
}

function diaVazio() {
  return {
    entradas: {},
    outrasEntradasEm: "gaveta",
    saidas: {},
    descricoes: {},
    contado: null,
    cedulas: {},
    anteriorManual: null,
    anotacoes: "",
  };
}

// ---------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------

/** Lê os dados salvos. Se não houver nada (ou estiver corrompido), começa do zero. */
function carregarDados() {
  try {
    const texto = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    return texto ? validarDados(JSON.parse(texto)) : dadosVazios();
  } catch {
    return dadosVazios();
  }
}

/** Salva os dados. Devolve false se o navegador não deixou (aba anônima, sem espaço...). */
function salvarDados(dados) {
  try {
    localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(dados));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Dias
// ---------------------------------------------------------------------------

function lerDia(dados, data) {
  return { ...diaVazio(), ...(dados.dias[data] || {}) };
}

function gravarDia(dados, data, dia) {
  if (!FORMATO_DATA.test(data)) throw new Error("Data inválida: " + data);
  dados.dias[data] = { ...diaVazio(), ...dia };
  return dados;
}

function apagarDia(dados, data) {
  delete dados.dias[data];
  return dados;
}

/** Datas salvas, em ordem. */
function datasSalvas(dados) {
  return Object.keys(dados.dias).filter((d) => FORMATO_DATA.test(d)).sort();
}

/** Transforma um dia salvo no formato que calcularDia() espera. */
function paraCalculo(dia, anterior) {
  const saidas = {};
  for (const [tipo, s] of Object.entries(dia.saidas || {})) {
    saidas[tipo] = { valor: s.valor || 0, pagoCom: s.pagoCom === "banco" ? "banco" : "gaveta" };
  }
  return {
    anterior,
    entradas: dia.entradas || {},
    outrasEntradasEm: dia.outrasEntradasEm,
    saidas,
    contado: dia.contado,
  };
}

/**
 * Calcula todos os dias em ordem, levando o saldo final de um dia
 * para o saldo anterior do próximo.
 * Devolve { "AAAA-MM-DD": { anterior, origemAnterior, resultado } }.
 */
function calcularTemporada(dados) {
  const saldoInicial = { gaveta: 0, banco: 0, ...(dados.temporada.saldoInicial || {}) };
  const porData = {};
  let saldo = saldoInicial;
  let origem = "inicio-temporada";

  for (const data of datasSalvas(dados)) {
    const dia = lerDia(dados, data);
    const anterior = dia.anteriorManual ? { gaveta: 0, banco: 0, ...dia.anteriorManual } : saldo;
    const resultado = calcularDia(paraCalculo(dia, anterior));
    porData[data] = { anterior, origemAnterior: dia.anteriorManual ? "manual" : origem, resultado };
    saldo = resultado.saldoFinal;
    origem = data;
  }
  return porData;
}

/**
 * Saldo anterior de uma data (salva ou não): o saldo final do último dia salvo antes dela.
 * Devolve { anterior: { gaveta, banco }, origem } onde origem é a data de onde veio,
 * "inicio-temporada" ou "manual".
 */
function saldoAnteriorDe(dados, data) {
  const dia = dados.dias[data];
  if (dia && dia.anteriorManual) {
    return { anterior: { gaveta: 0, banco: 0, ...dia.anteriorManual }, origem: "manual" };
  }
  const temporada = calcularTemporada(dados);
  const antes = datasSalvas(dados).filter((d) => d < data);
  if (!antes.length) {
    return { anterior: { gaveta: 0, banco: 0, ...(dados.temporada.saldoInicial || {}) }, origem: "inicio-temporada" };
  }
  const ultima = antes[antes.length - 1];
  return { anterior: temporada[ultima].resultado.saldoFinal, origem: ultima };
}

/** Calcula uma data com o saldo anterior certo. */
function calcularData(dados, data) {
  const { anterior, origem } = saldoAnteriorDe(dados, data);
  return { anterior, origemAnterior: origem, resultado: calcularDia(paraCalculo(lerDia(dados, data), anterior)) };
}

/**
 * Resumo dos dias registrados entre duas datas (inclusive).
 * Devolve { dias: [{ data, entradas, saidas, resultado, conferencia, diferenca }],
 *           totalEntradas, totalSaidas, resultado, media, melhor }.
 * media e melhor são null quando não há dias.
 */
function resumirPeriodo(dados, inicio, fim) {
  const temporada = calcularTemporada(dados);
  const dias = datasSalvas(dados)
    .filter((d) => d >= inicio && d <= fim)
    .map((data) => {
      const r = temporada[data].resultado;
      return {
        data,
        entradas: r.totalEntradas,
        saidas: r.totalSaidas,
        resultado: r.resultadoDia,
        conferencia: r.conferencia,
        diferenca: r.diferenca,
      };
    });
  const soma = (campo) => dias.reduce((t, d) => t + d[campo], 0);
  const resultado = soma("resultado");
  return {
    dias,
    totalEntradas: soma("entradas"),
    totalSaidas: soma("saidas"),
    resultado,
    media: dias.length ? Math.round(resultado / dias.length) : null,
    melhor: dias.length ? dias.reduce((m, d) => (d.resultado > m.resultado ? d : m)) : null,
  };
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

/** Texto do arquivo de backup. */
function gerarBackup(dados) {
  return JSON.stringify({ app: "caixa-na-mao", geradoEm: new Date().toISOString(), ...dados }, null, 2);
}

/** Nome do arquivo de backup, ex.: "caixa-na-mao-backup-2026-12-01.json". */
function nomeDoBackup(hoje = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `caixa-na-mao-backup-${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(hoje.getDate())}.json`;
}

const CHAVE_ULTIMO_BACKUP = "caixa-na-mao-ultimo-backup";

/** Data/hora (ISO) do último backup exportado neste navegador, ou null. */
function lerUltimoBackup() {
  try {
    return localStorage.getItem(CHAVE_ULTIMO_BACKUP);
  } catch {
    return null;
  }
}

function marcarBackupFeito(quando = new Date()) {
  try {
    localStorage.setItem(CHAVE_ULTIMO_BACKUP, quando.toISOString());
  } catch { /* sem armazenamento: o aviso de cima já avisa */ }
}

/** Baixa o backup como arquivo .json. */
function baixarBackup(dados) {
  const blob = new Blob([gerarBackup(dados)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nomeDoBackup();
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** Lê o texto de um backup. Lança um Error com mensagem em português se não for válido. */
function lerBackup(texto) {
  let bruto;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new Error("Este arquivo não é um backup do Caixa na Mão (não é JSON).");
  }
  if (!bruto || bruto.app !== "caixa-na-mao") {
    throw new Error("Este arquivo não é um backup do Caixa na Mão.");
  }
  if (bruto.versao > VERSAO_DADOS) {
    throw new Error("Este backup foi feito numa versão mais nova do Caixa na Mão.");
  }
  return validarDados(bruto);
}

// ---------------------------------------------------------------------------
// Validação: só aceita o que o app sabe usar; o resto é descartado.
// ---------------------------------------------------------------------------

const _valCentavos = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
const _valCentavosOuNull = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);
const _valTexto = (v, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const _valLugar = (v) => (v === "banco" ? "banco" : "gaveta");
const _valSaldo = (v) => ({ gaveta: _valCentavos(v && v.gaveta), banco: _valCentavos(v && v.banco) });

function validarDados(bruto) {
  const dados = dadosVazios();
  if (!bruto || typeof bruto !== "object") return dados;

  const t = bruto.temporada || {};
  dados.temporada = {
    meta: _valCentavosOuNull(t.meta),
    inicio: FORMATO_DATA.test(t.inicio) ? t.inicio : "",
    fim: FORMATO_DATA.test(t.fim) ? t.fim : "",
    folgas: Array.isArray(t.folgas) ? [...new Set(t.folgas.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : [],
    saldoInicial: _valSaldo(t.saldoInicial),
  };

  for (const [data, d] of Object.entries(bruto.dias || {})) {
    if (!FORMATO_DATA.test(data) || !d || typeof d !== "object") continue;
    const dia = diaVazio();
    for (const tipo of TIPOS_ENTRADA) {
      if (d.entradas && d.entradas[tipo] != null) dia.entradas[tipo] = _valCentavos(d.entradas[tipo]);
    }
    dia.outrasEntradasEm = _valLugar(d.outrasEntradasEm);
    for (const tipo of TIPOS_SAIDA) {
      const s = d.saidas && d.saidas[tipo];
      if (s) dia.saidas[tipo] = { valor: _valCentavos(s.valor), pagoCom: _valLugar(s.pagoCom) };
    }
    for (const [campo, valor] of Object.entries(d.descricoes || {})) {
      if (/^(entrada|saida)\.[a-z]+$/.test(campo)) dia.descricoes[campo] = _valTexto(valor, 200);
    }
    dia.contado = _valCentavosOuNull(d.contado);
    const c = d.cedulas || {};
    for (const valor of VALORES_CEDULAS) {
      if (Number.isInteger(c[valor]) && c[valor] > 0 && c[valor] <= 99999) dia.cedulas[valor] = c[valor];
    }
    if (_valCentavos(c.moedas) > 0) dia.cedulas.moedas = c.moedas;
    dia.anteriorManual = d.anteriorManual ? _valSaldo(d.anteriorManual) : null;
    dia.anotacoes = _valTexto(d.anotacoes);
    dados.dias[data] = dia;
  }
  return dados;
}
