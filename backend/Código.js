/** @OnlyCurrentDoc */

/**
 * Backend para o Sistema de Horas Voadas - Versão 2.5 (Foco em WebApp)
 * 
 * INSTRUÇÕES CRÍTICAS DE IMPLANTAÇÃO:
 * 1. Cole este código no editor.
 * 2. Clique em SALVAR (Disquete).
 * 3. Clique em IMPLANTAR -> GERENCIAR IMPLANTAÇÕES.
 * 4. Clique no LÁPIS da implantação ativa.
 * 5. Mude a versão para "NOVA VERSÃO".
 * 6. Certifique-se que "Quem tem acesso" é "QUALQUER PESSOA".
 * 7. Clique em IMPLANTAR.
 */

const SPREADSHEET_ID = '13oGd6Zt4AKKkHmOOjeEXkhS8MBZw9GwOkL9Y_rhwA-M';
const CAVOK_API_URL = 'https://voesafe.cavok.in/api/voos/';
const CAVOK_AUTH = 'Basic ' + Utilities.base64Encode('safe.ia@voesafe.com.br:Safeia1234%');
// Bases da SAFE. A aba Instrutores nasceu com Nome | Tipo; a coluna BASE e as
// de liberacao sao criadas por NOME no fim da aba, nunca por posicao, senao
// mexer na planilha a mao corrompe outra coluna.
const INVA_BASES = ['SJK', 'CPQ'];
// Quem ja estava cadastrado nao tem base gravada. Ler como SJK mantem todo
// mundo visivel na tela em vez de sumir num grupo orfao.
const INVA_BASE_PADRAO = 'SJK';
// A partir daqui o instrutor recebe a marca verde sozinho.
const INVA_META_HORAS = 100;
const INVA_COL_BASE = 'BASE';
const INVA_COL_LIBERADO = 'LIBERADO_OPR';
const INVA_COL_LIBERADO_EM = 'LIBERADO_EM';
const INVA_COL_LIBERADO_POR = 'LIBERADO_POR';
// Posicao do instrutor dentro da base. A ordem da lista E a ordem de
// prioridade de acionamento, decidida pela coordenacao, entao ela precisa
// viver na planilha: no navegador de cada um, dois coordenadores veriam
// prioridades diferentes e nenhuma seria a oficial.
// Zero (ou coluna ausente) significa "sem posicao definida" e vai para o FIM
// da lista, nao para o comeco: instrutor recem-cadastrado nao pode virar a
// primeira chamada por omissao.
const INVA_COL_ORDEM = 'ORDEM_PRIORIDADE';
// Nome(s) que o CAVOK usa para o instrutor quando difere do cadastro (ex:
// so o primeiro nome, sem sobrenome). Varios separados por virgula. Medido
// em 2026-08-25: "Luan Santana" no cadastro, "LUAN" no campo Instrutor dos
// voos, e a junta por nome exato deixava as horas dele sempre em zero no
// Fechamento de Horas / Instrutores. Vazio = usa so o nome do cadastro.
const INVA_COL_APELIDOS_CAVOK = 'APELIDOS_CAVOK';
// Instrutor que saiu da escola. NAO e remocao: a linha fica na aba e as horas
// seguem na aba Horas, senao o historico de quem voou de verdade se perderia e
// a reconciliacao do CAVOK continuaria trazendo voo dele sem ninguem para
// casar. Celula VAZIA significa ATIVO, e e isso que dispensa migracao: os
// instrutores que ja estavam cadastrados seguem todos ativos sem tocar em nada.
const INVA_COL_INATIVO = 'INATIVO';
const INVA_COL_INATIVO_EM = 'INATIVO_EM';
const INVA_COL_INATIVO_POR = 'INATIVO_POR';
// O motivo e opcional, mas e o unico campo que responde "por que esse nome
// saiu da lista" seis meses depois. Data e autor sao automaticos.
const INVA_COL_INATIVO_MOTIVO = 'INATIVO_MOTIVO';
const INVA_MOTIVO_INATIVO_MAX = 200;

// ── Etiquetas (molde Trello) ────────────────────────────────────────────
// O catalogo vive numa aba propria e cada instrutor guarda uma LISTA de ids
// na coluna ETIQUETAS. Guardar id, e nao o nome, e o que deixa renomear a
// etiqueta sem passar em todos os instrutores.
const INVA_ABA_ETIQUETAS = 'Etiquetas';
const INVA_COL_ETIQUETAS = 'ETIQUETAS';
const INVA_ETIQUETAS_HEADER = ['ID', 'NOME', 'COR', 'ORDEM'];
// Paleta FECHADA, e o que se guarda e a CHAVE, nunca o hex. O CSS escolhe o
// tom: cor digitada a mao sairia sem garantia de contraste, e ninguem veria
// isso na hora de escolher.
// Ampliada de 10 para 20 em 2026-08-11, a pedido do Victor: as etiquetas
// eram um tom pastel (fundo translucido) e ficavam discretas demais para o
// que uma etiqueta de qualificacao precisa fazer, que e chamar atencao. As
// 10 originais continuam com a mesma identidade de cor (verde e verde,
// vermelho e vermelho); so o CSS que desenha ficou mais vivido. As 10 novas
// preenchem familias de cor que faltavam (turquesa, indigo, marrom...).
const INVA_ETIQUETA_CORES = [
  'verde', 'limao', 'amarelo', 'mostarda', 'laranja', 'coral', 'vermelho',
  'vinho', 'rosa', 'fucsia', 'roxo', 'indigo', 'azul', 'marinho', 'ceu',
  'turquesa', 'oliva', 'marrom', 'preto', 'cinza'
];
const INVA_ETIQUETA_COR_PADRAO = 'cinza';
const INVA_ETIQUETA_NOME_MAX = 60;
// Semente do catalogo. CLT e Eventual entram porque o vinculo deixou de ser
// a coluna Tipo e virou etiqueta; os ids delas sao fixos e legiveis porque a
// migracao do Tipo antigo precisa apontar para eles.
const INVA_ETIQUETAS_SEMENTE = [
  { id: 'clt', nome: 'CLT', cor: 'azul' },
  { id: 'eventual', nome: 'Eventual', cor: 'laranja' },
  { id: 'mc01', nome: 'LIBERADO MC01', cor: 'verde' },
  { id: 'pmentor_sic', nome: 'LIBERADO P-MENTOR VFR/IFR SIC', cor: 'limao' },
  { id: 'restricao_missao', nome: 'RESTRIÇÃO MISSÃO', cor: 'vermelho' },
  { id: 'ifr_aatd', nome: 'LIBERADO IFR AATD', cor: 'ceu' },
  { id: 'ifr_pcatd', nome: 'LIBERADO IFR PCATD', cor: 'roxo' },
  { id: 'ifr_aviao', nome: 'LIBERADO IFR AVIÃO', cor: 'rosa' }
];

// ── Comentarios por instrutor ───────────────────────────────────────────
// Aba propria, uma linha por comentario, casada com o instrutor pelo NOME
// normalizado (mesma chave da aba Horas). Nao ha coluna nova em Instrutores:
// a lista e variavel e nao caberia numa celula sem virar texto colado.
//
// ⚠️ Renomear um instrutor na aba Instrutores orfana os comentarios dele,
// exatamente como ja orfana as horas. Se um dia houver renomeacao pela tela,
// ela precisa reescrever as duas abas.
const INVA_ABA_COMENTARIOS = 'Comentarios';
const INVA_COMENTARIOS_HEADER = ['ID', 'INSTRUTOR', 'AUTOR', 'DATA', 'TEXTO', 'ISO'];
// Um comentario e um recado de operacao, nao um relatorio. O teto existe para
// a celula nao virar um documento e para a resposta do get_data nao inchar.
const INVA_COMENTARIO_TEXTO_MAX = 1000;

// ── Instrutores de SOLO (migracao do Trello, 2026-08-11) ────────────────
// Categoria separada dos instrutores de voo: sem hora voada, sem sincronia
// com o CAVOK, sem liberacao por OPR e sem a flag verde de 100h, porque
// nenhuma hora e contabilizada para eles. O que sobra em comum e exatamente
// o que a tela usa para conferencia de qualificacao: cadastro pelo Hub,
// etiquetas (catalogo PROPRIO, por pedido do Victor: misturar com CLT/
// Eventual/LIBERADO IFR AVIAO faria os dois seletores mostrarem etiqueta
// que nao serve para aquele mundo), comentarios e ordem de prioridade por
// base. Tres abas NOVAS, todas criadas sozinhas na primeira escrita — ao
// contrario da aba Instrutores (legada, evoluiu coluna por coluna e por
// isso usa mapaColunasInstrutores_ por NOME), estas nascem sob controle
// total do codigo e podem usar POSICAO FIXA, no mesmo molde de Etiquetas e
// Comentarios.
const INVA_ABA_INSTRUTORES_SOLO = 'InstrutoresSolo';
// ⚠️ As 4 colunas de inativacao entraram DEPOIS, no fim: a aba ja existe em
// producao com 4 colunas, e como aqui a leitura e por POSICAO, inserir no meio
// desalinharia todas as linhas gravadas. Quem reconcilia o cabecalho da aba que
// ja existe e garantirCabecalhoSoloInva_, chamado so nas ESCRITAS.
const INVA_INSTRUTORES_SOLO_HEADER = [
  'NOME', 'BASE', 'ETIQUETAS', 'ORDEM_PRIORIDADE',
  'INATIVO', 'INATIVO_EM', 'INATIVO_POR', 'INATIVO_MOTIVO'
];
const INVA_SOLO_COL_NOME = 1;
const INVA_SOLO_COL_BASE = 2;
const INVA_SOLO_COL_ETIQUETAS = 3;
const INVA_SOLO_COL_ORDEM = 4;
const INVA_SOLO_COL_INATIVO = 5;
const INVA_SOLO_COL_INATIVO_EM = 6;
const INVA_SOLO_COL_INATIVO_POR = 7;
const INVA_SOLO_COL_INATIVO_MOTIVO = 8;
// Catalogo proprio, mesmo formato de Etiquetas (reusa INVA_ETIQUETAS_HEADER
// e a mesma paleta de cores). Sem semente: a operacao recria do zero o que
// tinha no Trello, e nao ha CLT/Eventual para migrar aqui.
const INVA_ABA_ETIQUETAS_SOLO = 'EtiquetasSolo';
const INVA_ABA_COMENTARIOS_SOLO = 'ComentariosSolo';

// Senha do botao LIBERADO POR OPR. O valor real fica na Propriedade do script
// LIBERACAO_OPR_SENHA (Configuracoes do projeto -> Propriedades do script),
// que pode ser trocada sem publicar versao nova. A constante abaixo e so o
// ultimo recurso: com as duas vazias o backend RECUSA toda liberacao, em vez
// de liberar geral.
const LIBERACAO_OPR_SENHA_PADRAO = '';

const FECHAMENTO_AERONAVES = [
  { base: 'SJK', tipo: 'PR-CRS', cotista: false },
  { base: 'SJK', tipo: 'PS-LOM', cotista: true },
  { base: 'SJK', tipo: 'PS-SFE', cotista: true },
  { base: 'SJK', tipo: 'PS-SFH', cotista: true },
  { base: 'SJK', tipo: 'PS-SFI', cotista: true },
  { base: 'CPQ', tipo: 'PS-SFJ', cotista: false },
  { base: 'CPQ', tipo: 'PS-SFL', cotista: false },
  { base: 'SJK', tipo: 'PS-SFP', cotista: false },
  { base: 'SJK', tipo: 'SM-SJK', cotista: false },
  { base: 'CPQ', tipo: 'SM-CPQ', cotista: false }
];

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'get_data') {
    return handleGetData();
  } else if (action === 'sync_cavok') {
    // Reconcilia a janela inteira e IGNORA o parametro date de proposito:
    // uma tela em cache ainda manda date=hoje, e cair no sync de um dia so
    // devolveria justamente o comportamento antigo que deixava voo de fora.
    return reconciliarVoosInva(Number(e.parameter.dias) || 0);
  } else if (action === 'diagnostico_horas') {
    // SO LEITURA. Separa, por instrutor, o SALDO INICIAL das linhas de voo
    // e quebra os voos por data. Serve para conferir rebase de saldo, onde
    // o total sozinho nao diz se houve recontagem.
    return diagnosticoHorasInva();
  } else if (action === 'sync_cavok_dia') {
    // Escape hatch de manutencao: forca UM dia especifico, sem reconciliar.
    return handleSyncCavok(e.parameter.date);
  } else if (action === 'get_month') {
    return handleGetMonth(e.parameter.ano, e.parameter.mes);
  } else if (action === 'get_horas_categoria') {
    // Fechamento de Horas / Instrutores (Hub): horas do mes por instrutor,
    // separadas em VFR/IFR/Simulador pela Fase do campo Missao. So leitura.
    return handleGetHorasCategoriaInva(e.parameter.ano, e.parameter.mes);
  }
  
  return createJsonResponse({status: 'error', message: 'Ação inválida'});
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    if (params.action === 'add_instructor') {
      return handleAddInstructor(params.data);
    }
    if (params.action === 'set_instructor_base') {
      return handleSetInstructorBase(params.data);
    }
    if (params.action === 'set_instructor_release') {
      return handleSetInstructorRelease(params.data);
    }
    if (params.action === 'set_instructor_order') {
      return handleSetInstructorOrder(params.data);
    }
    if (params.action === 'set_instructor_active') {
      return handleSetInstructorActive(params.data);
    }
    if (params.action === 'save_label') {
      return handleSaveLabel(params.data);
    }
    if (params.action === 'delete_label') {
      return handleDeleteLabel(params.data);
    }
    if (params.action === 'set_instructor_labels') {
      return handleSetInstructorLabels(params.data);
    }
    if (params.action === 'add_comment') {
      return handleAddComment(params.data);
    }
    if (params.action === 'delete_comment') {
      return handleDeleteComment(params.data);
    }
    // Instrutores de solo: mesmo formato de rota, mundo separado (sem
    // CAVOK, sem OPR, sem meta de horas). Ver o bloco INSTRUTORES DE SOLO.
    if (params.action === 'add_instructor_solo') {
      return handleAddInstructorSolo(params.data);
    }
    if (params.action === 'set_instructor_base_solo') {
      return handleSetInstructorBaseSolo(params.data);
    }
    if (params.action === 'set_instructor_order_solo') {
      return handleSetInstructorOrderSolo(params.data);
    }
    if (params.action === 'set_instructor_active_solo') {
      return handleSetInstructorActiveSolo(params.data);
    }
    if (params.action === 'save_label_solo') {
      return handleSaveLabelSolo(params.data);
    }
    if (params.action === 'delete_label_solo') {
      return handleDeleteLabelSolo(params.data);
    }
    if (params.action === 'set_instructor_labels_solo') {
      return handleSetInstructorLabelsSolo(params.data);
    }
    if (params.action === 'add_comment_solo') {
      return handleAddCommentSolo(params.data);
    }
    if (params.action === 'delete_comment_solo') {
      return handleDeleteCommentSolo(params.data);
    }
    // Manutenção: roda função de manutenção sem clique no editor.
    // ⚠️ A autenticação é o token em `data.chave`, guardado só em
    // Propriedade do script, e a lista de funções é fechada. Ver o
    // bloco MANUTENCAO no fim deste arquivo.
    if (params.action === 'manutencao') {
      return handleManutencaoInva(params.data);
    }
    return createJsonResponse({status: 'error', message: 'Ação inválida'});
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  }
}

/**
 * Função principal de Sincronização
 */
function handleSyncCavok(date) {
  const lock = LockService.getScriptLock();
  try {
    // Desde que passaram a existir DOIS gatilhos (23h e 05h) alem do botao
    // da tela, duas execucoes podem cair na mesma janela. A funcao le os IDs
    // ja gravados e so depois insere: sem trava, os dois runs leem antes de
    // qualquer insercao, nenhum enxerga o outro, e o mesmo voo entra duas
    // vezes. tryLock em vez de waitLock porque aqui recusar e melhor que
    // enfileirar: quem perdeu a trava nao tem nada para fazer, o outro run
    // ja esta trazendo os mesmos voos.
    if (!lock.tryLock(30000)) {
      return createJsonResponse({
        status: 'error',
        message: 'Uma sincronização já está em andamento. Tente de novo em instantes.'
      });
    }

    const now = new Date();
    // Proteção para execução logo após meia-noite
    if (now.getHours() === 0) {
      now.setDate(now.getDate() - 1);
    }
    
    const syncDate = date || Utilities.formatDate(now, "GMT-3", "yyyy-MM-dd");
    console.log("Iniciando Sincronização para: " + syncDate);
    
    const url = `${CAVOK_API_URL}?data=${syncDate}`;
    const options = {
      'method': 'get',
      'headers': { 'Authorization': CAVOK_AUTH },
      'muteHttpExceptions': true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const content = JSON.parse(response.getContentText());
    const flights = content.response;

    if (!Array.isArray(flights)) {
      throw new Error("Resposta da API não é uma lista válida");
    }

    // Abrir planilha explicitamente para garantir contexto do WebApp
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoursSheet = ss.getSheetByName('Horas');
    
    const excludedAircraft = ["PC-SJK", "PC-CPQ", "SM-SJK", "SM-CPQ"];
    
    const lastRow = hoursSheet.getLastRow();
    const existingIds = lastRow > 1 
      ? hoursSheet.getRange(2, 4, lastRow - 1, 1).getValues().flat().map(id => id.toString()) 
      : [];
    
    let addedCount = 0;
    flights.forEach(flight => {
      const flightIdStr = flight.Id.toString();
      const aircraft = flight.Aeronave;
      
      if (!existingIds.includes(flightIdStr) && !excludedAircraft.includes(aircraft)) {
        const horasDec = parseFloat((flight["Tempo total de voo"] / 60).toFixed(1));
        hoursSheet.appendRow([flight.Instrutor, flight.Data, horasDec, flightIdStr]);
        
        const row = hoursSheet.getLastRow();
        hoursSheet.getRange(row, 3).setNumberFormat('0.0');
        addedCount++;
      }
    });

    // Forçar salvamento das alterações antes de responder
    SpreadsheetApp.flush();

    return createJsonResponse({
      status: 'success', 
      message: `Sucesso! ${addedCount} voos novos de ${syncDate} foram adicionados.`
    });

  } catch (error) {
    console.error(error.toString());
    return createJsonResponse({status: 'error', message: "Falha no servidor: " + error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// ============================================================
// RECONCILIACAO DA JANELA
//
// O sync antigo so ACRESCENTAVA o que faltava do dia pedido, e isso
// deixava dois buracos:
//
//  a) voo do dia D lancado no dia D+1 depois das 05h nunca entrava,
//     porque nenhuma execucao futura olhava para o dia D de novo;
//  b) voo lancado ERRADO ficava errado para sempre, porque o codigo
//     pulava todo Id ja presente na planilha, mesmo com as horas
//     corrigidas no CAVOK depois.
//
// Aqui a cada execucao a janela inteira e comparada: insere o que
// falta, CORRIGE o que mudou e REMOVE o que sumiu do CAVOK.
// ============================================================

const INVA_FUSO = 'America/Sao_Paulo';
// Com uma execucao por dia, janela de N dias tolera lancamento atrasado
// ate as 05h de N-1 dias depois do voo. Propriedade do script
// INVA_JANELA_DIAS aumenta isso sem publicar versao nova.
const INVA_JANELA_DIAS_PADRAO = 3;
const INVA_AERONAVES_EXCLUIDAS = ['PC-SJK', 'PC-CPQ', 'SM-SJK', 'SM-CPQ'];

const INVA_GATILHOS = [
  { handler: 'atualizarHorasVoadasInvaDiario', hora: 5, descricao: 'reconcilia a janela' }
];
// Handlers de versoes anteriores. O instalador apaga gatilho de todos
// eles, senao o das 23h sobreviveria a mudanca e rodaria sozinho.
const INVA_HANDLERS_CONHECIDOS = [
  'atualizarHorasVoadasInvaDiario',
  'sincronizarVoosDeHojeInva'
];

function invaJanelaDias() {
  let bruto = null;
  try {
    bruto = PropertiesService.getScriptProperties().getProperty('INVA_JANELA_DIAS');
  } catch (ignore) {}
  const n = Number(bruto);
  // Teto de 15 dias: janela absurda vira 15 chamadas ao CAVOK por
  // execucao sem ganho nenhum, e um erro de digitacao nao pode virar isso.
  return (isFinite(n) && n >= 1 && n <= 15) ? Math.floor(n) : INVA_JANELA_DIAS_PADRAO;
}

/**
 * Data de corte do saldo inicial, na propriedade de script INVA_DATA_CORTE
 * (formato aaaa-mm-dd).
 *
 * ⚠️ E o que impede a reconciliacao de RECONTAR o que o saldo inicial ja
 * inclui. Quando se refaz o saldo com o total real ate um dia D, todo voo
 * ate D passa a estar dentro do saldo: se a janela continuasse olhando
 * para esses dias, ela inseriria de novo cada voo, somando em dobro.
 * Dia <= corte fica fora da janela, entao nao e consultado, nao e
 * inserido e nao pode ser removido.
 */
function invaDataCorte_() {
  let bruto = null;
  try {
    bruto = PropertiesService.getScriptProperties().getProperty('INVA_DATA_CORTE');
  } catch (ignore) {}
  return invaNormalizarData_(bruto);
}

/** Datas da janela, da mais antiga para a mais recente. */
function invaDatasDaJanela_(dias, referencia) {
  const base = referencia ? new Date(referencia) : new Date();
  const datas = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(base.getTime());
    d.setDate(d.getDate() - i);
    datas.push(Utilities.formatDate(d, INVA_FUSO, 'yyyy-MM-dd'));
  }
  return datas;
}

/**
 * Reduz a data a 'yyyy-MM-dd' venha ela como for. A coluna Data foi
 * gravada com appendRow do valor cru do CAVOK, entao pode ser texto ISO,
 * texto BR ou um Date que o Sheets converteu sozinho.
 *
 * Devolve '' quando nao reconhece. ⚠️ Quem chama NUNCA pode remover uma
 * linha com data ilegivel: sem saber o dia, nao da para dizer se ela esta
 * dentro da janela conferida.
 */
function invaNormalizarData_(valor) {
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, INVA_FUSO, 'yyyy-MM-dd');
  }
  const texto = String(valor || '').trim();
  let m = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  return '';
}

function invaChaveTexto_(valor) {
  return String(valor || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Compara a janela contra a planilha e aplica as tres correcoes.
 *
 * ⚠️ A REMOCAO E A PARTE PERIGOSA. Ela so acontece para voo cuja data
 * caiu numa consulta que o CAVOK respondeu com sucesso (datasOk). Se a
 * API falhar, vier ilegivel ou fora do formato para um dia, aquele dia
 * inteiro fica intocado: uma instabilidade do CAVOK apagaria voos de
 * verdade, e dado apagado aqui nao volta.
 */
function reconciliarVoosInva(dias, referencia, simular) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(30000)) {
      return createJsonResponse({
        status: 'error',
        message: 'Uma sincronização já está em andamento. Tente de novo em instantes.'
      });
    }

    const corte = invaDataCorte_();
    const janelaBruta = invaDatasDaJanela_(dias > 0 ? dias : invaJanelaDias(), referencia);
    // Comparacao de texto funciona porque as duas datas estao em aaaa-mm-dd.
    const janela = corte ? janelaBruta.filter(data => data > corte) : janelaBruta;

    if (!janela.length) {
      return createJsonResponse({
        status: 'success',
        message: 'Nada a conferir: toda a janela está em ou antes da data de corte (' + corte + '), ' +
          'e esses dias já estão dentro do saldo inicial.',
        data: {
          janela: [], corte: corte, conferidos: [], inseridos: 0, inseridosPorData: {},
          atualizados: 0, removidos: 0, duplicatasRemovidas: 0, falhas: [], correcoes: []
        }
      });
    }

    // 1. Uma chamada por dia da janela, todas de uma vez.
    const respostas = UrlFetchApp.fetchAll(janela.map(data => ({
      url: CAVOK_API_URL + '?data=' + encodeURIComponent(data),
      method: 'get',
      headers: { Authorization: CAVOK_AUTH },
      followRedirects: true,
      muteHttpExceptions: true
    })));

    const esperados = {};
    const datasOk = {};
    const falhas = [];

    respostas.forEach((resposta, i) => {
      const data = janela[i];
      const codigo = resposta.getResponseCode();
      if (codigo < 200 || codigo >= 300) {
        falhas.push(data + ' (HTTP ' + codigo + ')');
        return;
      }
      let conteudo;
      try {
        conteudo = JSON.parse(resposta.getContentText());
      } catch (erro) {
        falhas.push(data + ' (resposta ilegível)');
        return;
      }
      const voos = conteudo && conteudo.response;
      if (!Array.isArray(voos)) {
        falhas.push(data + ' (formato inesperado)');
        return;
      }
      // So a partir daqui o dia e considerado CONFERIDO.
      datasOk[data] = true;

      voos.forEach(voo => {
        const id = String(voo.Id == null ? '' : voo.Id).trim();
        if (!id) return;
        // Mesma comparacao crua do codigo antigo, de proposito: mudar o
        // criterio agora faria a reconciliacao remover horas que a versao
        // anterior tinha inserido, e o total mudaria sem ninguem pedir.
        if (INVA_AERONAVES_EXCLUIDAS.indexOf(voo.Aeronave) >= 0) return;
        esperados[id] = {
          instrutor: voo.Instrutor,
          data: voo.Data,
          dataNorm: invaNormalizarData_(voo.Data) || data,
          horas: arredondarUmaCasa(Number(voo['Tempo total de voo'] || 0) / 60)
        };
      });
    });

    if (!Object.keys(datasOk).length) {
      return createJsonResponse({
        status: 'error',
        message: 'O CAVOK não respondeu para nenhum dia da janela. Nada foi alterado. ' + falhas.join('; ')
      });
    }

    // 2. Estado atual da planilha.
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoursSheet = ss.getSheetByName('Horas');
    const ultimaLinha = hoursSheet.getLastRow();
    const valores = ultimaLinha > 1
      ? hoursSheet.getRange(2, 1, ultimaLinha - 1, 4).getValues()
      : [];
    // getDisplayValues na coluna da data: se o Sheets converteu o texto em
    // Date, o valor cru pode vir deslocado pelo fuso. O que a pessoa ve na
    // celula e a leitura confiavel.
    const datasExibidas = ultimaLinha > 1
      ? hoursSheet.getRange(2, 2, ultimaLinha - 1, 1).getDisplayValues()
      : [];

    const naPlanilha = {};
    const linhasParaRemover = [];
    let duplicatas = 0;

    valores.forEach((linha, i) => {
      const numeroLinha = i + 2;
      const id = String(linha[3] == null ? '' : linha[3]).trim();
      const rotuloData = invaChaveTexto_(linha[1]);
      // Saldo inicial e qualquer linha manual sem Id ficam de fora da
      // reconciliacao: elas nao vieram do CAVOK e nao podem sumir.
      if (!id || invaChaveTexto_(id) === 'SISTEMA' || rotuloData === 'SALDO INICIAL') return;

      const dataNorm = invaNormalizarData_(datasExibidas[i][0]) || invaNormalizarData_(linha[1]);

      if (naPlanilha[id]) {
        // Mesmo voo em duas linhas: e sempre erro, some duas vezes no
        // total do instrutor. Mantem a primeira e marca a repetida.
        linhasParaRemover.push(numeroLinha);
        duplicatas++;
        return;
      }
      naPlanilha[id] = {
        linha: numeroLinha,
        instrutor: linha[0],
        horas: Number(linha[2] || 0),
        dataNorm: dataNorm
      };
    });

    // 3. Diferencas.
    const inserir = [];
    const atualizar = [];
    const porDataInserida = {};
    Object.keys(esperados).forEach(id => {
      const esperado = esperados[id];
      const atual = naPlanilha[id];
      if (!atual) {
        inserir.push([esperado.instrutor, esperado.data, esperado.horas, id]);
        // Quebra por dia: e o que distingue "os voos de hoje, que nenhuma
        // execucao cobriu ainda" de "voo esquecido de dois dias atras", e
        // portanto se o gatilho diario esta funcionando.
        porDataInserida[esperado.dataNorm] = (porDataInserida[esperado.dataNorm] || 0) + 1;
        return;
      }
      const mudouInstrutor = invaChaveTexto_(atual.instrutor) !== invaChaveTexto_(esperado.instrutor);
      // Tolerancia porque os dois lados passam por divisao e arredondamento.
      const mudouHoras = Math.abs(Number(atual.horas) - esperado.horas) > 0.001;
      const mudouData = !!atual.dataNorm && atual.dataNorm !== esperado.dataNorm;
      if (mudouInstrutor || mudouHoras || mudouData) {
        atualizar.push({
          linha: atual.linha,
          valores: [esperado.instrutor, esperado.data, esperado.horas, id],
          instrutor: esperado.instrutor,
          data: esperado.dataNorm,
          de: atual.horas,
          para: esperado.horas
        });
      }
    });

    Object.keys(naPlanilha).forEach(id => {
      if (esperados[id]) return;
      const atual = naPlanilha[id];
      if (!atual.dataNorm) return;      // data ilegivel: nunca remove
      if (!datasOk[atual.dataNorm]) return; // fora do que foi conferido: nunca remove
      linhasParaRemover.push(atual.linha);
    });

    // 4. Aplicar. Atualizar ANTES de remover, senao os numeros de linha
    //    guardados acima deixam de valer. Remover de baixo para cima pelo
    //    mesmo motivo.
    linhasParaRemover.sort((a, b) => b - a);

    if (!simular) {
      atualizar.forEach(item => {
        hoursSheet.getRange(item.linha, 3).setNumberFormat('0.0');
        hoursSheet.getRange(item.linha, 1, 1, 4).setValues([item.valores]);
      });

      linhasParaRemover.forEach(numeroLinha => {
        hoursSheet.deleteRow(numeroLinha);
      });

      inserir.forEach(valoresNovos => {
        hoursSheet.appendRow(valoresNovos);
        hoursSheet.getRange(hoursSheet.getLastRow(), 3).setNumberFormat('0.0');
      });

      SpreadsheetApp.flush();
    }

    const removidos = linhasParaRemover.length;
    const partes = [];
    partes.push(inserir.length + (inserir.length === 1 ? ' voo novo' : ' voos novos'));
    if (atualizar.length) partes.push(atualizar.length + (atualizar.length === 1 ? ' corrigido' : ' corrigidos'));
    if (removidos) partes.push(removidos + (removidos === 1 ? ' removido' : ' removidos'));

    let mensagem = (simular ? 'ENSAIO, nada foi gravado. ' : '') +
      'Janela de ' + janela.length + ' dias conferida: ' + partes.join(', ') + '.';
    if (falhas.length) {
      mensagem += ' Não foi possível conferir ' + falhas.join('; ') +
        ', e nada foi removido nesses dias.';
    }

    return createJsonResponse({
      status: 'success',
      message: mensagem,
      data: {
        janela: janela,
        corte: corte,
        conferidos: Object.keys(datasOk),
        inseridos: inserir.length,
        inseridosPorData: porDataInserida,
        atualizados: atualizar.length,
        removidos: removidos,
        duplicatasRemovidas: duplicatas,
        falhas: falhas,
        correcoes: atualizar.slice(0, 20).map(a => ({
          linha: a.linha,
          instrutor: a.instrutor,
          data: a.data,
          de: a.de,
          para: a.para
        }))
      }
    });
  } catch (erro) {
    console.error(erro.toString());
    return createJsonResponse({ status: 'error', message: 'Falha na reconciliação: ' + erro.toString() });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function dataDeHojeCavok() {
  return Utilities.formatDate(new Date(), INVA_FUSO, 'yyyy-MM-dd');
}

function dataAnteriorCavok() {
  const agora = new Date();
  agora.setDate(agora.getDate() - 1);
  return Utilities.formatDate(agora, INVA_FUSO, 'yyyy-MM-dd');
}

/**
 * Sobra da versao de dois gatilhos. Se algum acionador antigo escapar da
 * faxina do instalador, ele cai aqui e faz a coisa certa em vez de rodar
 * o sync estreito de um dia so.
 */
function sincronizarVoosDeHojeInva() {
  return atualizarHorasVoadasInvaDiario();
}

/**
 * O gatilho diario. O NOME NAO PODE MUDAR: um acionador ja instalado
 * aponta para esta funcao pelo nome, e renomear deixaria o gatilho
 * apontando para o vazio, falhando todo dia em silencio.
 */
function atualizarHorasVoadasInvaDiario() {
  const resultado = reconciliarVoosInva();
  console.log('Reconciliacao diaria INVA concluida.');
  return resultado;
}

/**
 * Instala o gatilho diario, apagando antes qualquer acionador dos
 * handlers conhecidos (inclusive o das 23h da versao anterior). E
 * idempotente: rodar de novo nao acumula, que e o jeito mais facil de
 * acabar com varias execucoes por dia.
 */
function instalarAtualizacaoDiariaInva() {
  let removidos = 0;
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (INVA_HANDLERS_CONHECIDOS.indexOf(trigger.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(trigger);
      removidos++;
    }
  });

  const criados = INVA_GATILHOS.map(g => {
    const trigger = ScriptApp.newTrigger(g.handler)
      .timeBased()
      .atHour(g.hora)
      .nearMinute(0)
      .everyDays(1)
      // Sem inTimezone o Google usa o fuso do projeto. Ele ja e o de Sao
      // Paulo, mas deixar explicito evita o gatilho andar de hora se o
      // fuso do projeto mudar um dia.
      .inTimezone(INVA_FUSO)
      .create();
    return {
      handler: g.handler,
      horario: (g.hora < 10 ? '0' : '') + g.hora + ':00',
      faz: g.descricao,
      triggerId: trigger.getUniqueId()
    };
  });

  const relatorio = {
    ok: true,
    fuso: INVA_FUSO,
    janelaDias: invaJanelaDias(),
    removidos: removidos,
    criados: criados
  };
  Logger.log(JSON.stringify(relatorio, null, 2));
  return relatorio;
}

/**
 * SO LEITURA: devolve, por instrutor, o SALDO INICIAL separado das linhas
 * de voo, com os voos quebrados por data. Nao escreve nada e nao cria aba.
 *
 * Existe porque o total do get_data nao distingue as duas metades, e num
 * rebase de saldo e exatamente essa distincao que revela recontagem.
 */
function diagnosticoHorasInva() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoursSheet = ss.getSheetByName('Horas');
    const ultimaLinha = hoursSheet.getLastRow();
    const valores = ultimaLinha > 1 ? hoursSheet.getRange(2, 1, ultimaLinha - 1, 4).getValues() : [];
    const datasExibidas = ultimaLinha > 1
      ? hoursSheet.getRange(2, 2, ultimaLinha - 1, 1).getDisplayValues()
      : [];

    const porInstrutor = {};
    const semData = [];

    valores.forEach((linha, i) => {
      const nome = String(linha[0] || '').trim();
      if (!nome) return;
      const numeroLinha = i + 2;
      const id = String(linha[3] == null ? '' : linha[3]).trim();
      const rotulo = invaChaveTexto_(linha[1]);
      const horas = Number(linha[2] || 0);

      if (!porInstrutor[nome]) {
        porInstrutor[nome] = { saldo: 0, linhasSaldo: 0, voosPorData: {}, totalVoos: 0 };
      }
      const alvo = porInstrutor[nome];

      if (rotulo === 'SALDO INICIAL' || invaChaveTexto_(id) === 'SISTEMA') {
        alvo.saldo = arredondarUmaCasa(alvo.saldo + horas);
        alvo.linhasSaldo++;
        return;
      }

      const data = invaNormalizarData_(datasExibidas[i][0]) || invaNormalizarData_(linha[1]);
      if (!data) {
        semData.push({ linha: numeroLinha, instrutor: nome, id: id, horas: horas });
        return;
      }
      alvo.voosPorData[data] = arredondarUmaCasa((alvo.voosPorData[data] || 0) + horas);
      alvo.totalVoos = arredondarUmaCasa(alvo.totalVoos + horas);
    });

    Object.keys(porInstrutor).forEach(nome => {
      const a = porInstrutor[nome];
      a.total = arredondarUmaCasa(a.saldo + a.totalVoos);
    });

    return createJsonResponse({
      status: 'success',
      data: {
        corte: invaDataCorte_(),
        janelaDias: invaJanelaDias(),
        instrutores: porInstrutor,
        linhasComDataIlegivel: semData
      }
    });
  } catch (erro) {
    return createJsonResponse({ status: 'error', message: erro.toString() });
  }
}

/**
 * Apaga as LINHAS DE VOO ate a data de corte, para quem vai refazer o
 * saldo inicial com o total real. Sem isso o saldo novo soma por cima das
 * linhas antigas e o total do instrutor sai inflado.
 *
 * NUNCA toca em: linha de SALDO INICIAL, linha sem CavokId (lancamento
 * manual) e linha com data ilegivel. Data ilegivel entra no relatorio para
 * ser resolvida a mao: apagar sem saber o dia seria chute.
 *
 * SEGURANCA: sem o segundo argumento e ENSAIO. Esquecer o argumento nao
 * apaga nada, que e o erro que a pessoa comete com pressa.
 *
 *   limparVoosAteInva('2026-07-29')        -> so relata
 *   limparVoosAteInva('2026-07-29', true)  -> apaga
 */
function limparVoosAteInva(dataCorte, aplicar) {
  const corte = invaNormalizarData_(dataCorte) || invaDataCorte_();
  if (!corte) {
    throw new Error('Informe a data de corte como aaaa-mm-dd, por exemplo limparVoosAteInva("2026-07-29").');
  }

  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(30000)) {
      throw new Error('Outra execução está mexendo na planilha. Tente de novo em instantes.');
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoursSheet = ss.getSheetByName('Horas');
    const ultimaLinha = hoursSheet.getLastRow();
    const valores = ultimaLinha > 1 ? hoursSheet.getRange(2, 1, ultimaLinha - 1, 4).getValues() : [];
    const datasExibidas = ultimaLinha > 1
      ? hoursSheet.getRange(2, 2, ultimaLinha - 1, 1).getDisplayValues()
      : [];

    const linhas = [];
    const porInstrutor = {};
    const semData = [];
    let saldosPreservados = 0;

    valores.forEach((linha, i) => {
      const numeroLinha = i + 2;
      const id = String(linha[3] == null ? '' : linha[3]).trim();
      const rotulo = invaChaveTexto_(linha[1]);
      if (rotulo === 'SALDO INICIAL' || invaChaveTexto_(id) === 'SISTEMA') {
        saldosPreservados++;
        return;
      }
      if (!id) return; // linha manual sem Id do CAVOK: nao e nossa para apagar

      const data = invaNormalizarData_(datasExibidas[i][0]) || invaNormalizarData_(linha[1]);
      if (!data) {
        semData.push('linha ' + numeroLinha + ' (' + linha[0] + ', Id ' + id + ')');
        return;
      }
      if (data > corte) return;

      linhas.push(numeroLinha);
      const nome = String(linha[0] || '(sem nome)');
      porInstrutor[nome] = porInstrutor[nome] || { linhas: 0, horas: 0 };
      porInstrutor[nome].linhas++;
      porInstrutor[nome].horas = arredondarUmaCasa(porInstrutor[nome].horas + Number(linha[2] || 0));
    });

    if (aplicar === true) {
      // De baixo para cima: apagar uma linha desloca todas as de baixo.
      linhas.slice().sort((a, b) => b - a).forEach(n => hoursSheet.deleteRow(n));
      SpreadsheetApp.flush();
    }

    const relatorio = {
      aplicado: aplicar === true,
      corte: corte,
      linhasDeVooAfetadas: linhas.length,
      saldosIniciaisPreservados: saldosPreservados,
      horasRemovidasPorInstrutor: porInstrutor,
      linhasComDataIlegivel: semData
    };
    Logger.log((aplicar === true ? '=== LIMPEZA APLICADA ===' : '=== ENSAIO, nada foi apagado ==='));
    Logger.log(JSON.stringify(relatorio, null, 2));
    return relatorio;
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/**
 * ENSAIO: mostra exatamente o que a reconciliacao faria, sem gravar nada.
 * Rode pelo editor antes da primeira execucao de verdade, principalmente
 * para ver quantas linhas ela pretende REMOVER.
 */
function simularReconciliacaoInva(dias) {
  const resposta = reconciliarVoosInva(Number(dias) || 0, null, true);
  const texto = resposta.getContent ? resposta.getContent() : null;
  // createTextOutput nao expoe o conteudo em toda versao do runtime, entao
  // o relatorio legivel sai pelo Logger de qualquer forma.
  Logger.log(texto || 'Rode e veja o retorno da funcao no painel de execucao.');
  return texto;
}

/** So lista. Use para conferir o que esta instalado de verdade. */
function listarGatilhosInva() {
  const lista = ScriptApp.getProjectTriggers().map(t => ({
    handler: t.getHandlerFunction(),
    tipo: String(t.getEventType()),
    id: t.getUniqueId()
  }));
  Logger.log('=== GATILHOS INSTALADOS (' + lista.length + ') ===');
  Logger.log(lista.length ? JSON.stringify(lista, null, 2) : 'nenhum');
  // O horario nao e legivel pela API: confira em Acionadores, no menu da
  // esquerda do editor. O que da para provar aqui e QUAL funcao roda.
  return lista;
}

function removerGatilhosInva() {
  let removidos = 0;
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (INVA_HANDLERS_CONHECIDOS.indexOf(trigger.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(trigger);
      removidos++;
    }
  });
  Logger.log('Gatilhos removidos: ' + removidos);
  return { ok: true, removidos: removidos };
}

function executarTesteInvaOnzeHoras() {
  const resultado = atualizarHorasVoadasInvaDiario();
  console.log('TESTE 11H concluído: ' + JSON.stringify(resultado));
  return resultado;
}

function instalarTesteInvaHojeOnzeHoras() {
  const handler = 'executarTesteInvaOnzeHoras';
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === handler) ScriptApp.deleteTrigger(trigger);
  });

  const agora = new Date();
  const execucao = new Date(agora);
  execucao.setHours(11, 0, 0, 0);
  if (execucao.getTime() <= agora.getTime()) {
    throw new Error('Já passou das 11:00 de hoje. O teste não foi agendado.');
  }

  const trigger = ScriptApp.newTrigger(handler)
    .timeBased()
    .at(execucao)
    .create();
  return {
    ok: true,
    handler,
    triggerId: trigger.getUniqueId(),
    execucao: Utilities.formatDate(
      execucao,
      'America/Sao_Paulo',
      'dd/MM/yyyy HH:mm:ss'
    )
  };
}

function handleGetMonth(ano, mes) {
  try {
    const competencia = validarCompetencia(ano, mes);
    const flights = buscarVoosMes(competencia.ano, competencia.mes);
    const consolidado = consolidarFechamento(flights);
    consolidado.ano = competencia.ano;
    consolidado.mes = competencia.mes;
    return createJsonResponse({
      status: 'success',
      data: consolidado
    });
  } catch (error) {
    console.error(error.toString());
    return createJsonResponse({
      status: 'error',
      message: 'Falha ao consultar o mês no CAVOK: ' + error.toString()
    });
  }
}

function validarCompetencia(ano, mes) {
  const anoNumero = Number(ano);
  const mesNumero = Number(mes);
  if (!anoNumero || anoNumero < 2020 || anoNumero > 2100) {
    throw new Error('Ano inválido.');
  }
  if (!mesNumero || mesNumero < 1 || mesNumero > 12) {
    throw new Error('Mês inválido.');
  }
  return { ano: anoNumero, mes: mesNumero };
}

function datasDoMes(ano, mes) {
  const ultimoDiaMes = new Date(ano, mes, 0).getDate();
  const hoje = new Date();
  const mesAtual = hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes;
  const ultimoDia = mesAtual ? Math.min(hoje.getDate(), ultimoDiaMes) : ultimoDiaMes;
  const datas = [];
  for (let dia = 1; dia <= ultimoDia; dia++) {
    datas.push([
      String(ano).padStart(4, '0'),
      String(mes).padStart(2, '0'),
      String(dia).padStart(2, '0')
    ].join('-'));
  }
  return datas;
}

function buscarVoosMes(ano, mes) {
  const datas = datasDoMes(ano, mes);
  const requests = datas.map(data => ({
    url: CAVOK_API_URL + '?data=' + encodeURIComponent(data),
    method: 'get',
    headers: { Authorization: CAVOK_AUTH },
    followRedirects: true,
    muteHttpExceptions: true
  }));
  const responses = UrlFetchApp.fetchAll(requests);
  const ids = {};
  const flights = [];

  responses.forEach((response, index) => {
    const code = response.getResponseCode();
    if (code < 200 || code >= 300) {
      throw new Error(`CAVOK indisponível para ${datas[index]} (HTTP ${code}).`);
    }
    const content = JSON.parse(response.getContentText());
    const dailyFlights = Array.isArray(content.response) ? content.response : [];
    dailyFlights.forEach(flight => {
      const id = String(flight.Id || '');
      if (id && ids[id]) return;
      if (id) ids[id] = true;
      flights.push(flight);
    });
  });
  return flights;
}

function normalizarAeronave(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
    .replace('SM-CPQ (CAMPINAS)', 'SM-CPQ')
    .replace('SM-SJK (SAO JOSE DOS CAMPOS)', 'SM-SJK')
    .replace('SM-SJK (SÃO JOSÉ DOS CAMPOS)', 'SM-SJK');
}

function arredondarUmaCasa(valor) {
  return Math.round((Number(valor) || 0) * 10) / 10;
}

// ============================================================
// FECHAMENTO DE HORAS / INSTRUTORES (2026-08-25, regra por equipamento
// desde 2026-09-03)
//
// Separa as horas voadas do mes nas quatro categorias de pagamento:
// VFR, IFR, Simulador AATD e Simulador PCATD.
//
// ⚠️⚠️ QUEM DECIDE SE E SIMULADOR E O EQUIPAMENTO (campo Aeronave), NAO
// o texto da Fase. A primeira versao classificava por uma lista fechada
// de nomes de fase, e medido em 2026-09-03 contra junho+julho+agosto isso
// deixava 240,7 HORAS de simulador sendo pagas como VFR (R$70): o CAVOK
// usa mais de dez textos de fase diferentes para simulador ("Simulador
// IFR", "Treinamento em Simulador", "Fase 1 - Mockup / Simulador",
// "Fase 2C - Navegacao"...), e nenhuma lista acompanha isso. O campo
// Aeronave, ao contrario, e factual: PC-SJK/PC-CPQ sao o PCATD e
// SM-SJK/SM-CPQ sao o AATD, o que bateu 100% nos tres meses conferidos.
//
// A regra, por decisao do financeiro em 2026-09-03:
//   1. Voo em equipamento de simulador paga simulador, com PRECEDENCIA
//      sobre as listas de fase (inclusive sobre as fases 3B, que antes
//      caiam em IFR).
//   2. PCATD paga menos que AATD (R$45 contra R$60), EXCETO os LAB IFR da
//      "Fase 3A - Mockup SIM IFR", que pagam AATD mesmo rodando no PCATD.
//
// ⚠️⚠️ NAO EXISTE LISTA DE FASE QUE TIRE UM VOO DO SIMULADOR, e uma
// tentativa disso foi removida em 2026-09-03 depois de errar em
// producao. A primeira versao supunha que certas fases num equipamento
// de simulador eram lancamento errado no CAVOK (Pre Solo, Treinamento
// de Voo, Cheque Final - FAP, Readaptacao, Treinamento Safe) e as
// mandava de volta para VFR. Medido contra 1187 voos de junho a
// setembro: eram 30,7h de simulador de verdade pagas como VFR, entre
// elas uma missao chamada literalmente "Treinamento em SM-AATD", que
// nomeia o proprio equipamento. E **todas** aquelas fases aparecem
// TAMBEM em aviao de verdade ("Treinamento Safe > Aperfeicoamento
// Continuo" tem 11,9h em simulador e 44,6h em aviao), o que prova que
// o nome da fase nao carrega informacao nenhuma sobre o equipamento.
//
// Matricula brasileira e PP/PR/PS/PT/PU, entao `PC-` e `SM-` NUNCA
// podem ser aviao: nos 1187 voos os avioes eram todos PS-* e PT-*.
// Se um dia um voo de aviao de verdade aparecer lancado como SM-CPQ,
// ele paga simulador e o conserto e no CAVOK, na origem: e melhor
// pagar de menos um lancamento errado (e o instrutor reclamar) do que
// pagar de mais uma sessao de simulador de verdade em silencio.
//
// So leitura, sem gravar nada: reusa buscarVoosMes/validarCompetencia
// (mesmo mecanismo do get_month dos Cotistas) em vez de tocar na aba
// Horas ou na reconciliacao, que sao fragéis e cheias de invariantes.
//
// ⚠️ NAO reaproveita INVA_AERONAVES_EXCLUIDAS (SM-SJK/SM-CPQ ficam de
// fora dali para nao contar simulador na meta de 100h). Aqui e o oposto:
// e exatamente nesses equipamentos que o simulador acontece.
// ============================================================

/** Categorias de pagamento. SIMULADOR = AATD (nome mantido: e a chave do historico de valores no Hub). */
var INVA_CAT_VFR = 'VFR';
var INVA_CAT_IFR = 'IFR';
var INVA_CAT_SIM_AATD = 'SIMULADOR';
var INVA_CAT_SIM_PCATD = 'SIMULADOR_PCATD';

/** Prefixo da matricula do equipamento -> tipo de simulador. */
var INVA_PREFIXO_PCATD = 'PC-';
var INVA_PREFIXO_AATD = 'SM-';

/** A fase dos LAB IFR: paga AATD mesmo quando roda no PCATD. */
var INVA_FASE_MOCKUP_SIM_IFR_BRUTO = 'Fase 3A - Mockup SIM IFR';

/**
 * Fases de simulador, mantidas apenas como REDE DE SEGURANCA para o caso de
 * um voo de simulador ser lancado com matricula de aviao de verdade: a fase
 * diz FSTD, entao paga AATD. Nos tres meses conferidos isso nunca aconteceu
 * (nenhum voo classificado simulador estava fora de PC- ou SM-), e o
 * equipamento tem precedencia sobre esta lista.
 */
var INVA_FASES_SIMULADOR_BRUTO = [
  'Fase 3A - Mockup SIM IFR',
  'Fase 3A-1 - Manobras Básicas (FSTD)',
  'Fase 3A-2 - Uso de Rádio-Navegação (FSTD)',
  'Fase 3A-3 - Procedimentos IFR (FSTD)',
  'Fase 3A-4 - Contingências IFR (FSTD)',
  'Fase 3A-5 - Navegações IFR (FSTD)',
  'Avaliação Intermediária em FSTD'
];

/**
 * Fases que pagam IFR quando o voo NAO foi em equipamento de simulador.
 *
 * ⚠️ Comparar pela Fase INTEIRA normalizada, nunca por palavra-chave: "Fase
 * 3B-3 - SIM Multi Crew" tem "SIM" no nome. Desde 2026-09-03 essa fase paga
 * simulador quando roda no simulador (o equipamento manda), e IFR quando
 * roda no aviao, que e o que esta lista cobre.
 */
var INVA_FASES_IFR_BRUTO = [
  'Fase 3B-1 - Manobras Básicas',
  'Fase 3B-2 - Navegações e Procedimentos IFR',
  'Fase 3B-3 - SIM Multi Crew',
  'Avaliação final para cheque ANAC'
];

/**
 * Normaliza texto de Fase para comparacao: maiusculas, espacos colapsados
 * e qualquer variante de travessao/meia-risca reduzida a hifen comum.
 * Medido contra o CAVOK real (2026-08-25): a mesma API grava uma Fase com
 * travessão ("Fase 2B – Preparação...") e outras com hifen comum
 * ("Fase 3A - Mockup..."), entao nao dá pra confiar no tipo de traço.
 */
function invaNormalizarFaseTexto_(texto) {
  return String(texto || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[‐-―−]/g, '-');
}

var INVA_FASES_SIMULADOR = INVA_FASES_SIMULADOR_BRUTO.map(invaNormalizarFaseTexto_);
var INVA_FASES_IFR = INVA_FASES_IFR_BRUTO.map(invaNormalizarFaseTexto_);
var INVA_FASE_MOCKUP_SIM_IFR = invaNormalizarFaseTexto_(INVA_FASE_MOCKUP_SIM_IFR_BRUTO);

/**
 * Correcoes pontuais de categoria, por Id do voo no CAVOK. Vencem a regra
 * por fase e por equipamento. Uso restrito a voo que a regra classifica
 * errado e que nao tem como ser corrigido no CAVOK.
 *
 * ⚠️ A API de voos NAO traz o Tipo da etapa (VFR / IFR Real): o campo
 * "Tipo de voo financeiro" vem sempre "VFR", conferido em 2026-10-07. Por
 * isso uma missao que pode ser VFR ou IFR so e decidida pela fase, e o
 * caso real IFR precisa entrar aqui ate o CAVOK expor o Tipo na API.
 */
var INVA_CATEGORIA_POR_ID_VOO = {
  // Stephan, 07/09/2026, PS-SFP, 5,9h, "Treinamento Safe > Aperfeicoamento
  // Continuo". Etapa lancada como IFR Real no CAVOK; a fase sozinha paga VFR.
  // Pedido do Victor em 2026-10-07, so este voo.
  '19710': 'IFR'
};

/** Extrai o segundo pedaco de "[curso] > [Fase] > [Missao]". '' se nao houver. */
function invaExtrairFaseMissao_(missaoTexto) {
  var partes = String(missaoTexto || '').split('>');
  if (partes.length < 2) return '';
  return partes[1].trim();
}

/**
 * Missoes que pagam IFR pelo NOME da missao (o terceiro pedaco de
 * "[curso] > [Fase] > [Missao]"), qualquer que seja a fase.
 *
 * Existe porque a API de voos nao traz o Tipo da etapa (VFR / IFR Real), e
 * algumas missoes podem ser feitas nos dois. Decisao do Victor em
 * 2026-10-07: a operacao cria uma missao com o final "IFR" no CAVOK, e a
 * missao antiga, sem o final, continua pagando VFR.
 *
 * ⚠️ Comparacao pelo NOME INTEIRO, nunca por "termina com IFR": ja existem
 * missoes como "SIM 05 IFR - Navegacao IFR" que terminam em IFR e sao outra
 * coisa. Ignora caixa, acento e espaco sobrando.
 */
var INVA_MISSOES_IFR_BRUTO = [
  'Aperfeiçoamento Contínuo IFR'
];

function invaNormalizarMissaoTexto_(texto) {
  return invaNormalizarFaseTexto_(texto).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

var INVA_MISSOES_IFR = INVA_MISSOES_IFR_BRUTO.map(invaNormalizarMissaoTexto_);

/** Extrai o terceiro pedaco de "[curso] > [Fase] > [Missao]". '' se nao houver. */
function invaExtrairNomeMissao_(missaoTexto) {
  var partes = String(missaoTexto || '').split('>');
  if (partes.length < 3) return '';
  return partes.slice(2).join('>').trim();
}

/**
 * Tipo de simulador pela matricula do equipamento: 'PCATD', 'AATD' ou ''
 * (nao e simulador). Reusa o `normalizarAeronave`, que ja resolve as
 * variantes com o nome da cidade entre parenteses.
 */
function invaEquipamentoSimulador_(aeronave) {
  var matricula = normalizarAeronave(aeronave);
  if (matricula.indexOf(INVA_PREFIXO_PCATD) === 0) return 'PCATD';
  if (matricula.indexOf(INVA_PREFIXO_AATD) === 0) return 'AATD';
  return '';
}

/**
 * Categoria de pagamento de um voo: VFR, IFR, SIMULADOR (AATD) ou
 * SIMULADOR_PCATD. Ver o bloco de comentario no topo desta secao para o
 * porque de o equipamento ter precedencia sobre a Fase.
 */
function invaClassificarVooPagamento_(aeronave, missaoTexto) {
  var chaveFase = invaNormalizarFaseTexto_(invaExtrairFaseMissao_(missaoTexto));
  var equipamento = invaEquipamentoSimulador_(aeronave);

  // ⚠️ Nenhuma fase tira o voo daqui: o equipamento e o unico sinal
  // factual, e a lista de excecao que existia aqui errou em producao (ver
  // o bloco de comentario no topo desta secao).
  if (equipamento) {
    // Os LAB IFR pagam AATD mesmo rodando no PCATD.
    if (equipamento === 'PCATD' && chaveFase === INVA_FASE_MOCKUP_SIM_IFR) return INVA_CAT_SIM_AATD;
    return equipamento === 'PCATD' ? INVA_CAT_SIM_PCATD : INVA_CAT_SIM_AATD;
  }

  // Fora de equipamento de simulador: missao com nome IFR, depois a Fase.
  var chaveMissao = invaNormalizarMissaoTexto_(invaExtrairNomeMissao_(missaoTexto));
  if (chaveMissao && INVA_MISSOES_IFR.indexOf(chaveMissao) >= 0) return INVA_CAT_IFR;
  if (chaveFase && INVA_FASES_SIMULADOR.indexOf(chaveFase) >= 0) return INVA_CAT_SIM_AATD;
  if (chaveFase && INVA_FASES_IFR.indexOf(chaveFase) >= 0) return INVA_CAT_IFR;
  return INVA_CAT_VFR;
}

/**
 * Decimo de hora (1 casa) a partir de minutos inteiros, arredondando para o
 * mais proximo e, no empate exato (resto 3 na divisao por 6: minutos que
 * terminam em 3 ou 7 na casa de tempo, tipo 27min = 0,45h), para BAIXO.
 *
 * Medido contra o relatorio real do CAVOK em 2026-08-25 (Danilo Lira,
 * agosto/2026, 15 voos VFR): o `Math.round` padrao (arredonda empate pra
 * CIMA) so bate 11 dos 15, porque o CAVOK arredonda esses empates pra
 * baixo. Com esta regra, batem 14 dos 15: o unico que sobra e um voo de
 * navegacao com 3 pousos, que o CAVOK mostra abaixo do que a formula daria
 * (aparentemente um tratamento proprio dele pra perna multipla, que a API
 * de voos nao da pra reproduzir sozinha).
 *
 * Aritmetica inteira de proposito: nunca compara minutos/60 em ponto
 * flutuante contra 0,5 exato, que e onde esse tipo de checagem costuma
 * falhar por imprecisao.
 *
 * ⚠️ Local desta funcao, NAO reusa `arredondarUmaCasa` (arredonda pra
 * cima no empate): aquela e usada pelo Fechamento de Horas / Cotistas e
 * pela reconciliacao da aba Horas, e mudar a regra la mudaria numero ja
 * aceito em outro modulo sem ninguem ter pedido.
 */
/**
 * Mapa "nome como o CAVOK grava" (normalizado) -> nome do cadastro, lido da
 * coluna APELIDOS_CAVOK (varios separados por virgula). So leitura, nunca
 * cria a coluna: enquanto ela nao existir, o mapa sai vazio e cada voo usa
 * o proprio nome cru do CAVOK, exatamente o comportamento de antes.
 */
function invaApelidosCavok_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Instrutores');
  var colunas = mapaColunasInstrutores_(sheet, false);
  var colApelidos = colunas[INVA_COL_APELIDOS_CAVOK];
  var mapa = {};
  if (!colApelidos) return mapa;

  var dados = sheet.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    var nomeCanonico = String(dados[i][0] || '').trim();
    if (!nomeCanonico) continue;
    String(dados[i][colApelidos - 1] || '').split(',').forEach(function (apelido) {
      var chave = invaChaveTexto_(apelido);
      if (chave) mapa[chave] = nomeCanonico;
    });
  }
  return mapa;
}

/**
 * Manutencao: grava o(s) apelido(s) que o CAVOK usa para um instrutor
 * (coluna APELIDOS_CAVOK, criada se faltar), para quando o campo Instrutor
 * dos voos nao bate com o nome do cadastro. Args: [nomeCanonico, "apelido1,
 * apelido2"]. Nao mexe em nenhum outro instrutor nem em nenhuma outra
 * coluna.
 */
function invaDefinirApelidoCavok(nomeCanonico, apelidos) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Instrutores');
  var colunas = mapaColunasInstrutores_(sheet, true);
  var dados = sheet.getDataRange().getValues();
  var chaveAlvo = invaChaveTexto_(nomeCanonico);
  for (var i = 1; i < dados.length; i++) {
    if (invaChaveTexto_(dados[i][0]) !== chaveAlvo) continue;
    sheet.getRange(i + 1, colunas[INVA_COL_APELIDOS_CAVOK]).setValue(String(apelidos || '').trim());
    return { ok: true, linha: i + 1, instrutor: dados[i][0], apelidos: apelidos };
  }
  return { ok: false, motivo: 'Instrutor "' + nomeCanonico + '" nao encontrado no cadastro.' };
}

function invaDecimoHoraCavok_(minutos) {
  var m = Math.max(0, Math.round(Number(minutos) || 0));
  var q = Math.floor(m / 6);
  var r = m % 6;
  return r > 3 ? q + 1 : q;
}

/**
 * Horas voadas do mes por instrutor, separadas em VFR/IFR/Simulador, com a
 * lista de voos que compõe cada categoria: é o que sustenta a auditoria
 * ("Ver voos") do Fechamento de Horas / Instrutores no Hub: sem o detalhe
 * por voo não dá pra conferir por que um valor saiu do jeito que saiu.
 *
 * ⚠️ O total soma o DECIMO já arredondado de cada voo, não os minutos
 * brutos com um arredondamento só no fim. É assim que o CAVOK soma o dele
 * (confirmado voo a voo): somar minutos brutos e arredondar uma vez só
 * bate diferente do relatório de origem, mesmo usando a mesma regra de
 * empate.
 *
 * So leitura. `ano`/`mes` obrigatorios (mesma validacao do get_month).
 */
function handleGetHorasCategoriaInva(ano, mes) {
  try {
    var competencia = validarCompetencia(ano, mes);
    var flights = buscarVoosMes(competencia.ano, competencia.mes);
    var apelidos = invaApelidosCavok_();

    var porInstrutor = {};
    flights.forEach(function (voo) {
      var nomeCru = String(voo.Instrutor || '').trim();
      if (!nomeCru) return;
      // Resolve pelo apelido cadastrado ANTES de agrupar: sem isso, um
      // instrutor cujo nome no CAVOK nao bate com o cadastro (ex: so o
      // primeiro nome) fica com as horas dele presas numa chave que o
      // Fechamento de Horas / Instrutores nunca vai olhar.
      var nome = apelidos[invaChaveTexto_(nomeCru)] || nomeCru;
      var chave = invaChaveTexto_(nome);
      if (!porInstrutor[chave]) {
        porInstrutor[chave] = {
          instrutor: nome,
          vfrDecimos: 0, ifrDecimos: 0, simuladorDecimos: 0, simuladorPcatdDecimos: 0,
          voos: []
        };
      }
      var minutos = Math.max(0, Number(voo['Tempo total de voo']) || 0);
      var categoria = INVA_CATEGORIA_POR_ID_VOO[String(voo.Id)] ||
        invaClassificarVooPagamento_(voo.Aeronave, voo.Missao);
      var decimo = invaDecimoHoraCavok_(minutos);
      if (categoria === INVA_CAT_SIM_PCATD) porInstrutor[chave].simuladorPcatdDecimos += decimo;
      else if (categoria === INVA_CAT_SIM_AATD) porInstrutor[chave].simuladorDecimos += decimo;
      else if (categoria === INVA_CAT_IFR) porInstrutor[chave].ifrDecimos += decimo;
      else porInstrutor[chave].vfrDecimos += decimo;

      porInstrutor[chave].voos.push({
        data: voo.Data,
        categoria: categoria,
        horas: decimo / 10,
        aeronave: voo.Aeronave || '',
        missao: voo.Missao || ''
      });
    });

    var instrutores = Object.keys(porInstrutor).map(function (chave) {
      var item = porInstrutor[chave];
      var voosOrdenados = item.voos.slice().sort(function (a, b) {
        return String(a.data).localeCompare(String(b.data));
      });
      return {
        instrutor: item.instrutor,
        vfrHoras: item.vfrDecimos / 10,
        ifrHoras: item.ifrDecimos / 10,
        // `simuladorHoras` = AATD. Nome mantido porque e a chave do
        // historico de valores gravado no Hub: renomear orfanaria o que
        // ja foi registrado.
        simuladorHoras: item.simuladorDecimos / 10,
        simuladorPcatdHoras: item.simuladorPcatdDecimos / 10,
        voos: voosOrdenados
      };
    });

    return createJsonResponse({
      status: 'success',
      data: { ano: competencia.ano, mes: competencia.mes, instrutores: instrutores }
    });
  } catch (error) {
    console.error(error.toString());
    return createJsonResponse({
      status: 'error',
      message: 'Falha ao consultar horas por categoria: ' + error.toString()
    });
  }
}

function consolidarFechamento(flights) {
  const modelos = {};
  FECHAMENTO_AERONAVES.forEach(item => {
    modelos[item.tipo] = {
      base: item.base,
      tipo: item.tipo,
      minutos: 0,
      minutosCotista: item.cotista ? 0 : null
    };
  });

  let ignorados = 0;
  let excluidosSemAluno = 0;
  let excluidosAdministrativo = 0;
  let considerados = 0;

  flights.forEach(flight => {
    const modelo = modelos[normalizarAeronave(flight.Aeronave)];
    if (!modelo) {
      ignorados++;
      return;
    }
    const minutos = Math.max(0, Number(flight['Tempo total de voo']) || 0);
    modelo.minutos += minutos;
    considerados++;

    if (modelo.minutosCotista === null) return;
    const aluno = String(flight.Aluno || '').trim().toUpperCase();
    if (!aluno) {
      excluidosSemAluno += minutos;
    } else if (aluno === 'VOO ADMINISTRATIVO - SAFE') {
      excluidosAdministrativo += minutos;
    } else {
      modelo.minutosCotista += minutos;
    }
  });

  return {
    horas: FECHAMENTO_AERONAVES.map(item => {
      const modelo = modelos[item.tipo];
      return {
        base: modelo.base,
        tipo: modelo.tipo,
        horas: arredondarUmaCasa(modelo.minutos / 60),
        cotista_horas: modelo.minutosCotista === null
          ? null
          : arredondarUmaCasa(modelo.minutosCotista / 60)
      };
    }),
    resumoImportacao: {
      voosRecebidos: flights.length,
      voosConsiderados: considerados,
      voosIgnorados: ignorados,
      horasExcluidasSemAluno: arredondarUmaCasa(excluidosSemAluno / 60),
      horasExcluidasAdministrativo:
        arredondarUmaCasa(excluidosAdministrativo / 60)
    }
  };
}

// ============================================================
// BASE E LIBERACAO POR OPR
// ============================================================

/** "Liberado OPR" e "liberado opr" tem que virar a mesma chave. */
function normalizarHeaderInva_(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

/**
 * Devolve { HEADER: indice1Based } da aba Instrutores.
 *
 * Com criar=true, acrescenta no FIM da aba as colunas que faltarem, sem
 * deslocar Nome e Tipo. Com criar=false nao escreve nada: e o que o
 * handleGetData usa, porque leitura nao pode alterar a planilha (duas
 * leituras simultaneas criariam a mesma coluna duas vezes).
 */
function mapaColunasInstrutores_(sheet, criar) {
  const largura = Math.max(sheet.getLastColumn(), 1);
  const cabecalho = sheet.getRange(1, 1, 1, largura).getValues()[0];
  const mapa = {};
  cabecalho.forEach(function (nome, i) {
    const chave = normalizarHeaderInva_(nome);
    if (chave && !mapa[chave]) mapa[chave] = i + 1;
  });

  if (!criar) return mapa;

  const esperadas = [
    INVA_COL_BASE, INVA_COL_LIBERADO, INVA_COL_LIBERADO_EM, INVA_COL_LIBERADO_POR,
    INVA_COL_ETIQUETAS, INVA_COL_ORDEM, INVA_COL_APELIDOS_CAVOK,
    INVA_COL_INATIVO, INVA_COL_INATIVO_EM, INVA_COL_INATIVO_POR,
    INVA_COL_INATIVO_MOTIVO
  ];
  const novas = esperadas.filter(function (coluna) { return !mapa[coluna]; });
  if (!novas.length) return mapa;

  // ⚠️ Escrever fora do fim da ABA lanca, e nao ha ninguem para pegar o erro:
  // a aba tem 26 colunas por padrao e usa 8, entao na pratica sobra folga, mas
  // basta alguem ter apagado as colunas vazias para a PRIMEIRA inativacao ser
  // quem descobre isso. Alargar antes custa nada e a chamada e no-op quando ja
  // ha espaco.
  const faltam = (largura + novas.length) - sheet.getMaxColumns();
  if (faltam > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), faltam);

  let proxima = largura;
  novas.forEach(function (coluna) {
    proxima++;
    sheet.getRange(1, proxima).setValue(coluna);
    mapa[coluna] = proxima;
  });
  return mapa;
}

/** Devolve 'SJK', 'CPQ' ou '' (base desconhecida ou celula vazia). */
function normalizarBaseInva_(valor) {
  const texto = String(valor || '').trim().toUpperCase();
  return INVA_BASES.indexOf(texto) >= 0 ? texto : '';
}

/**
 * Le uma celula de SIM/NAO. O codigo grava booleano, mas alguem pode ter
 * digitado "SIM" ou "x" a mao: aceitar as duas formas evita marca que existe na
 * planilha e nao aparece na tela.
 *
 * ⚠️ Celula vazia e FALSO. Vale para a liberacao por OPR (nao liberado) e para
 * a inativacao (ativo), e e o que permite as duas colunas nascerem sem
 * migracao nenhuma.
 */
function invaCelulaVerdadeira_(valor) {
  if (valor === true) return true;
  const texto = String(valor || '').trim().toUpperCase();
  return ['TRUE', 'VERDADEIRO', 'SIM', 'X', '1'].indexOf(texto) >= 0;
}

/** Nome historico, mantido porque e o que o resto do arquivo chama. */
function liberacaoInvaAtiva_(valor) {
  return invaCelulaVerdadeira_(valor);
}

/** Instrutor fora da operacao. Coluna ausente ou celula vazia = ativo. */
function inativoInva_(valor) {
  return invaCelulaVerdadeira_(valor);
}

/** Numero da linha do instrutor na aba, ou 0 se nao existir. */
function linhaDoInstrutorInva_(sheet, nome) {
  const chave = String(nome || '').trim().toUpperCase();
  if (!chave) return 0;
  const linhas = sheet.getDataRange().getValues();
  for (let i = 1; i < linhas.length; i++) {
    if (String(linhas[i][0] || '').trim().toUpperCase() === chave) return i + 1;
  }
  return 0;
}

/**
 * A senha real vive na Propriedade do script LIBERACAO_OPR_SENHA. Sem senha
 * configurada a resposta e FALSE: um backend aberto ao anonimo nao pode
 * liberar geral so porque esqueceram de configurar.
 */
function verificarSenhaOprInva_(senha) {
  let esperada = '';
  try {
    esperada = PropertiesService.getScriptProperties()
      .getProperty('LIBERACAO_OPR_SENHA') || '';
  } catch (ignore) {
    esperada = '';
  }
  if (!esperada) esperada = LIBERACAO_OPR_SENHA_PADRAO;
  if (!esperada) return false;
  return String(senha || '') === String(esperada);
}

/**
 * Maior posicao ja usada numa base. Serve para quem chega (cadastro novo ou
 * mudanca de base) entrar no FIM da fila de prioridade em vez de aparecer no
 * meio dela por acaso.
 *
 * ⚠️ `ignorarLinha` existe para a REATIVACAO: o instrutor que volta ainda tem
 * o numero velho na celula, e sem exclui-lo do maximo ele herdaria a posicao de
 * si mesmo e saltaria a fila inteira justamente quem esteve fora.
 */
function ultimaOrdemDaBaseInva_(sheet, colunas, base, ignorarLinha) {
  const colBase = colunas[INVA_COL_BASE];
  const colOrdem = colunas[INVA_COL_ORDEM];
  if (!colBase || !colOrdem) return 0;
  const linhas = sheet.getDataRange().getValues();
  let maior = 0;
  for (let i = 1; i < linhas.length; i++) {
    if (ignorarLinha && (i + 1) === ignorarLinha) continue;
    if (!String(linhas[i][0] || '').trim()) continue;
    const daLinha = normalizarBaseInva_(linhas[i][colBase - 1]) || INVA_BASE_PADRAO;
    if (daLinha !== base) continue;
    const ordem = Number(linhas[i][colOrdem - 1]) || 0;
    if (ordem > maior) maior = ordem;
  }
  return maior;
}

/**
 * Reordena UMA base. Recebe a lista de nomes ja na ordem desejada e grava a
 * posicao 1..n, junto da propria base: um arraste que atravessa as duas
 * colunas muda as duas coisas, e faze-lo em duas chamadas deixaria a tela
 * meio certa se a segunda falhasse.
 *
 * A lista chega COMPLETA (a base inteira, nao so o que esta visivel na tela):
 * com a busca ativa, reordenar pelo subconjunto visivel apagaria a posicao de
 * quem esta filtrado. Quem monta a lista completa e o frontend.
 */
function handleSetInstructorOrder(data) {
  const lock = LockService.getScriptLock();
  try {
    // Duas pessoas reordenando a mesma base ao mesmo tempo escreveriam
    // posicoes intercaladas, e o resultado nao seria a ordem de nenhuma das
    // duas.
    lock.waitLock(30000);

    const base = normalizarBaseInva_((data || {}).base);
    const nomes = Array.isArray((data || {}).nomes) ? (data || {}).nomes : null;
    if (!base) {
      return createJsonResponse({status: 'error', message: 'Base inválida.'});
    }
    if (!nomes || !nomes.length) {
      return createJsonResponse({status: 'error', message: 'Informe a ordem dos instrutores.'});
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const instSheet = ss.getSheetByName('Instrutores');
    const colunas = mapaColunasInstrutores_(instSheet, true);

    // Resolve TODAS as linhas antes de escrever qualquer uma: um nome errado
    // no meio da lista deixaria a base metade reordenada e metade na ordem
    // velha, que e pior que recusar.
    const alvos = [];
    for (let i = 0; i < nomes.length; i++) {
      const nome = String(nomes[i] || '').trim();
      const linha = nome ? linhaDoInstrutorInva_(instSheet, nome) : 0;
      if (!linha) {
        return createJsonResponse({
          status: 'error',
          message: 'Instrutor "' + nome + '" não encontrado na planilha.'
        });
      }
      alvos.push({nome: nome, linha: linha});
    }

    alvos.forEach(function (alvo, i) {
      instSheet.getRange(alvo.linha, colunas[INVA_COL_BASE]).setValue(base);
      instSheet.getRange(alvo.linha, colunas[INVA_COL_ORDEM]).setValue(i + 1);
    });

    SpreadsheetApp.flush();
    return createJsonResponse({
      status: 'success',
      data: {
        base: base,
        ordem: alvos.map(function (alvo, i) { return {nome: alvo.nome, ordem: i + 1}; })
      }
    });
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/** Timestamp como TEXTO. Formato antes do valor, senao o Sheets vira Date. */
function gravarTextoInva_(sheet, linha, coluna, valor) {
  const celula = sheet.getRange(linha, coluna);
  celula.setNumberFormat('@');
  celula.setValue(valor);
}

function handleSetInstructorBase(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const nome = String((data || {}).nome || '').trim();
    const base = normalizarBaseInva_((data || {}).base);
    if (!nome) {
      return createJsonResponse({status: 'error', message: 'Informe o instrutor.'});
    }
    if (!base) {
      return createJsonResponse({
        status: 'error',
        message: 'Base inválida. Use ' + INVA_BASES.join(' ou ') + '.'
      });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const instSheet = ss.getSheetByName('Instrutores');
    const linha = linhaDoInstrutorInva_(instSheet, nome);
    if (!linha) {
      return createJsonResponse({
        status: 'error',
        message: 'Instrutor "' + nome + '" não encontrado na planilha.'
      });
    }

    const colunas = mapaColunasInstrutores_(instSheet, true);
    // Ordem ANTES da base: com a base ja trocada, o instrutor entraria na
    // contagem do proprio destino e ganharia a posicao de si mesmo.
    const ordem = ultimaOrdemDaBaseInva_(instSheet, colunas, base) + 1;
    gravarTextoInva_(instSheet, linha, colunas[INVA_COL_BASE], base);
    instSheet.getRange(linha, colunas[INVA_COL_ORDEM]).setValue(ordem);

    SpreadsheetApp.flush();
    return createJsonResponse({
      status: 'success',
      data: {nome: nome, base: base, ordem: ordem}
    });
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function handleSetInstructorRelease(data) {
  const lock = LockService.getScriptLock();
  try {
    // A senha e conferida ANTES do lock nao: dentro dele, para a resposta de
    // senha errada nao virar um jeito de medir concorrencia. Custo irrelevante.
    lock.waitLock(30000);

    const nome = String((data || {}).nome || '').trim();
    const liberar = (data || {}).liberado !== false;
    if (!nome) {
      return createJsonResponse({status: 'error', message: 'Informe o instrutor.'});
    }
    if (!verificarSenhaOprInva_((data || {}).senha)) {
      return createJsonResponse({status: 'error', message: 'Senha incorreta.'});
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const instSheet = ss.getSheetByName('Instrutores');
    const linha = linhaDoInstrutorInva_(instSheet, nome);
    if (!linha) {
      return createJsonResponse({
        status: 'error',
        message: 'Instrutor "' + nome + '" não encontrado na planilha.'
      });
    }

    const colunas = mapaColunasInstrutores_(instSheet, true);
    const autor = String((data || {}).autor || '').trim();
    const quando = liberar
      ? Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm')
      : '';

    instSheet.getRange(linha, colunas[INVA_COL_LIBERADO]).setValue(liberar);
    gravarTextoInva_(instSheet, linha, colunas[INVA_COL_LIBERADO_EM], quando);
    gravarTextoInva_(instSheet, linha, colunas[INVA_COL_LIBERADO_POR], liberar ? autor : '');

    SpreadsheetApp.flush();
    return createJsonResponse({
      status: 'success',
      data: {
        nome: nome,
        liberadoOpr: liberar,
        liberadoEm: quando,
        liberadoPor: liberar ? autor : ''
      }
    });
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/**
 * Inativa ou reativa um instrutor de voo.
 *
 * ⚠️ Nao apaga NADA. A linha continua na aba Instrutores e as horas seguem na
 * aba Horas. Apagar a linha perderia o historico de quem voou de verdade, e a
 * reconciliacao do CAVOK continuaria inserindo os voos antigos dele na aba
 * Horas sem instrutor para casar. Inativo e um ESTADO, nunca uma remocao.
 *
 * ⚠️ A ORDEM DE PRIORIDADE nao e tocada ao inativar: buraco na numeracao e
 * inofensivo e esperado (ver handleSetInstructorOrder). Na REATIVACAO o
 * instrutor entra no FIM da fila, mesma regra de quem chega pelo cadastro ou
 * pela troca de base. Duas razoes: quem saiu e voltou nao deve reaparecer como
 * primeira chamada por causa de um numero velho na celula, e o numero velho
 * pode ter sido reaproveitado por outra pessoa enquanto ele esteve fora.
 */
function handleSetInstructorActive(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const nome = String((data || {}).nome || '').trim();
    // ⚠️ Default explicito: `inativo` ausente NAO pode virar inativacao por
    // omissao. Precisa chegar exatamente true.
    const inativar = (data || {}).inativo === true;
    if (!nome) {
      return createJsonResponse({status: 'error', message: 'Informe o instrutor.'});
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const instSheet = ss.getSheetByName('Instrutores');
    const linha = linhaDoInstrutorInva_(instSheet, nome);
    if (!linha) {
      return createJsonResponse({
        status: 'error',
        message: 'Instrutor "' + nome + '" não encontrado na planilha.'
      });
    }

    const colunas = mapaColunasInstrutores_(instSheet, true);
    const autor = String((data || {}).autor || '').trim();
    const motivo = String((data || {}).motivo || '')
      .trim().substring(0, INVA_MOTIVO_INATIVO_MAX);
    const quando = inativar
      ? Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm')
      : '';

    instSheet.getRange(linha, colunas[INVA_COL_INATIVO]).setValue(inativar);
    gravarTextoInva_(instSheet, linha, colunas[INVA_COL_INATIVO_EM], quando);
    gravarTextoInva_(instSheet, linha, colunas[INVA_COL_INATIVO_POR], inativar ? autor : '');
    gravarTextoInva_(instSheet, linha, colunas[INVA_COL_INATIVO_MOTIVO], inativar ? motivo : '');

    let ordem = 0;
    if (!inativar) {
      const base = normalizarBaseInva_(
        instSheet.getRange(linha, colunas[INVA_COL_BASE]).getValue()
      ) || INVA_BASE_PADRAO;
      // ignorarLinha: sem excluir a propria linha do maximo, o numero velho
      // dela venceria e o instrutor voltaria para a frente da fila.
      ordem = ultimaOrdemDaBaseInva_(instSheet, colunas, base, linha) + 1;
      instSheet.getRange(linha, colunas[INVA_COL_ORDEM]).setValue(ordem);
    }

    SpreadsheetApp.flush();
    return createJsonResponse({
      status: 'success',
      data: {
        nome: nome,
        inativo: inativar,
        inativoEm: quando,
        inativoPor: inativar ? autor : '',
        inativoMotivo: inativar ? motivo : '',
        // Zero na inativacao: a tela sabe que nao houve mudanca de posicao.
        ordem: ordem
      }
    });
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/**
 * Manutencao, sem rota: roda pelo editor. Cria as colunas novas e carimba
 * INVA_BASE_PADRAO em quem ainda esta sem base, so para a planilha ficar
 * legivel a olho. A tela nao depende disso, ja le vazio como SJK.
 */
function preencherBasePadraoInva() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const instSheet = ss.getSheetByName('Instrutores');
  const colunas = mapaColunasInstrutores_(instSheet, true);
  const colBase = colunas[INVA_COL_BASE];
  const linhas = instSheet.getDataRange().getValues();
  const preenchidos = [];

  for (let i = 1; i < linhas.length; i++) {
    const nome = String(linhas[i][0] || '').trim();
    if (!nome) continue;
    if (normalizarBaseInva_(linhas[i][colBase - 1])) continue;
    gravarTextoInva_(instSheet, i + 1, colBase, INVA_BASE_PADRAO);
    preenchidos.push(nome);
  }

  SpreadsheetApp.flush();
  Logger.log('=== BASE PADRAO APLICADA (' + preenchidos.length + ') ===');
  Logger.log(preenchidos.length ? preenchidos.join('\n') : 'nenhum instrutor sem base');
  return preenchidos;
}

// ============================================================
// ETIQUETAS — catalogo proprio + lista de ids por instrutor
// ============================================================

/** Chave de paleta valida, ou o padrao. Nunca devolve hex. */
function normalizarCorEtiquetaInva_(valor) {
  const cor = String(valor || '').trim().toLowerCase();
  return INVA_ETIQUETA_CORES.indexOf(cor) >= 0 ? cor : INVA_ETIQUETA_COR_PADRAO;
}

/**
 * Id opaco para etiqueta criada na tela. Nao deriva do nome de proposito:
 * o id e a chave gravada em cada instrutor, entao renomear tem que ser de
 * graca. Os ids legiveis da semente sao a excecao, e existem porque a
 * migracao do Tipo precisa apontar para 'clt' e 'eventual'.
 */
function novoIdEtiquetaInva_(usados) {
  let id = '';
  do {
    id = 'et' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  } while (usados.indexOf(id) >= 0);
  return id;
}

/** A aba do catalogo, criada com cabecalho quando criar=true. */
function abaEtiquetasInva_(ss, criar) {
  let aba = ss.getSheetByName(INVA_ABA_ETIQUETAS);
  if (aba || !criar) return aba;
  aba = ss.insertSheet(INVA_ABA_ETIQUETAS);
  aba.getRange(1, 1, 1, INVA_ETIQUETAS_HEADER.length)
    .setValues([INVA_ETIQUETAS_HEADER])
    .setFontWeight('bold');
  aba.setFrozenRows(1);
  return aba;
}

/**
 * Le o catalogo. Aba ausente devolve lista vazia SEM criar nada: e o que o
 * handleGetData usa, e leitura que cria aba e escrita disfarcada.
 */
function lerEtiquetasInva_(ss) {
  const aba = abaEtiquetasInva_(ss, false);
  if (!aba) return [];
  const linhas = aba.getDataRange().getValues().slice(1);
  const lista = [];
  linhas.forEach(function (linha, i) {
    const id = String(linha[0] || '').trim();
    const nome = String(linha[1] || '').trim();
    if (!id || !nome) return;
    lista.push({
      id: id,
      nome: nome,
      cor: normalizarCorEtiquetaInva_(linha[2]),
      ordem: Number(linha[3]) || (i + 1)
    });
  });
  lista.sort(function (a, b) { return a.ordem - b.ordem; });
  return lista;
}

/** Reescreve a aba inteira a partir da lista. A ordem vira 1..n. */
function gravarEtiquetasInva_(ss, lista) {
  const aba = abaEtiquetasInva_(ss, true);
  const ultima = aba.getLastRow();
  if (ultima > 1) aba.getRange(2, 1, ultima - 1, INVA_ETIQUETAS_HEADER.length).clearContent();
  if (!lista.length) return;
  const valores = lista.map(function (etiqueta, i) {
    return [etiqueta.id, etiqueta.nome, etiqueta.cor, i + 1];
  });
  // Formato de texto antes do valor: um id como 'et1a2b' escapa, mas nome
  // tipo '1/2' viraria data. Mesma armadilha da DATA_NASCIMENTO e do avatar.
  const faixa = aba.getRange(2, 1, valores.length, INVA_ETIQUETAS_HEADER.length);
  faixa.setNumberFormat('@');
  faixa.setValues(valores);
}

/** Cria a aba e semeia o catalogo na primeira vez. Idempotente. */
function garantirEtiquetasInva_(ss) {
  const atual = lerEtiquetasInva_(ss);
  if (atual.length) return atual;
  const semente = INVA_ETIQUETAS_SEMENTE.map(function (etiqueta, i) {
    return {
      id: etiqueta.id,
      nome: etiqueta.nome,
      cor: normalizarCorEtiquetaInva_(etiqueta.cor),
      ordem: i + 1
    };
  });
  gravarEtiquetasInva_(ss, semente);
  return semente;
}

/** 'clt,ifr_aatd' -> ['clt','ifr_aatd']. Tolera ; e espaco como separador. */
function parseEtiquetasInva_(valor) {
  return String(valor || '')
    .split(/[,;]/)
    .map(function (id) { return id.trim(); })
    .filter(function (id) { return !!id; });
}

/**
 * Mantem so os ids que existem no catalogo, sem repetir e na ordem do
 * catalogo. Id orfao (etiqueta excluida por fora) simplesmente some, senao a
 * tela pintaria um chip sem nome nem cor.
 */
function sanearEtiquetasInva_(ids, catalogo) {
  const validos = {};
  catalogo.forEach(function (etiqueta) { validos[etiqueta.id] = true; });
  const vistos = {};
  const limpos = [];
  parseEtiquetasInva_(Array.isArray(ids) ? ids.join(',') : ids).forEach(function (id) {
    if (!validos[id] || vistos[id]) return;
    vistos[id] = true;
    limpos.push(id);
  });
  const posicao = {};
  catalogo.forEach(function (etiqueta, i) { posicao[etiqueta.id] = i; });
  limpos.sort(function (a, b) { return posicao[a] - posicao[b]; });
  return limpos;
}

/**
 * A coluna Tipo virou ESPELHO: quem manda e a etiqueta. Escrever nela mesmo
 * assim mantem a planilha legivel para quem abre no Sheets e nao quebra nada
 * que ainda leia a coluna. Casa por NOME (nao por id) para sobreviver a
 * alguem excluir e recriar a etiqueta CLT.
 */
function tipoEspelhoInva_(ids, catalogo) {
  const nomes = [];
  catalogo.forEach(function (etiqueta) {
    if (ids.indexOf(etiqueta.id) >= 0) nomes.push(etiqueta.nome.trim().toUpperCase());
  });
  if (nomes.indexOf('CLT') >= 0) return 'CLT';
  if (nomes.indexOf('EVENTUAL') >= 0) return 'Eventual';
  return '';
}

/** Grava as etiquetas de UMA linha da aba Instrutores. */
function gravarEtiquetasDoInstrutorInva_(sheet, linha, colunas, ids, catalogo) {
  gravarTextoInva_(sheet, linha, colunas[INVA_COL_ETIQUETAS], ids.join(','));
  const tipo = tipoEspelhoInva_(ids, catalogo);
  // So mexe no Tipo quando ha vinculo entre as etiquetas. Sem CLT nem
  // Eventual marcados, o valor antigo fica: apagar seria perder dado que
  // ninguem pediu para apagar.
  if (tipo) gravarTextoInva_(sheet, linha, 2, tipo);
}

function handleSaveLabel(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const nome = String((data || {}).nome || '').trim();
    if (!nome) {
      return createJsonResponse({status: 'error', message: 'Dê um nome para a etiqueta.'});
    }
    if (nome.length > INVA_ETIQUETA_NOME_MAX) {
      return createJsonResponse({
        status: 'error',
        message: 'O nome da etiqueta passa de ' + INVA_ETIQUETA_NOME_MAX + ' caracteres.'
      });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const catalogo = garantirEtiquetasInva_(ss);
    const id = String((data || {}).id || '').trim();
    const cor = normalizarCorEtiquetaInva_((data || {}).cor);

    // Nome repetido derrota o proposito da etiqueta: duas iguais na lista e
    // ninguem sabe qual marcar. Compara ignorando caixa, fora a propria.
    const chave = nome.toUpperCase();
    const repetida = catalogo.some(function (etiqueta) {
      return etiqueta.id !== id && etiqueta.nome.trim().toUpperCase() === chave;
    });
    if (repetida) {
      return createJsonResponse({status: 'error', message: 'Já existe uma etiqueta com esse nome.'});
    }

    if (id) {
      const alvo = catalogo.filter(function (e) { return e.id === id; })[0];
      if (!alvo) {
        return createJsonResponse({status: 'error', message: 'Etiqueta não encontrada.'});
      }
      alvo.nome = nome;
      alvo.cor = cor;
    } else {
      const usados = catalogo.map(function (e) { return e.id; });
      catalogo.push({
        id: novoIdEtiquetaInva_(usados),
        nome: nome,
        cor: cor,
        ordem: catalogo.length + 1
      });
    }

    gravarEtiquetasInva_(ss, catalogo);
    SpreadsheetApp.flush();
    return createJsonResponse({status: 'success', data: {etiquetas: catalogo}});
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function handleDeleteLabel(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const id = String((data || {}).id || '').trim();
    if (!id) {
      return createJsonResponse({status: 'error', message: 'Informe a etiqueta.'});
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const catalogo = garantirEtiquetasInva_(ss);
    const restante = catalogo.filter(function (etiqueta) { return etiqueta.id !== id; });
    if (restante.length === catalogo.length) {
      return createJsonResponse({status: 'error', message: 'Etiqueta não encontrada.'});
    }

    gravarEtiquetasInva_(ss, restante);

    // Excluir do catalogo sem limpar os instrutores deixaria id orfao na
    // planilha, que reapareceria como chip fantasma se alguem recriasse uma
    // etiqueta com o mesmo id.
    const instSheet = ss.getSheetByName('Instrutores');
    const colunas = mapaColunasInstrutores_(instSheet, true);
    const colEtiquetas = colunas[INVA_COL_ETIQUETAS];
    const linhas = instSheet.getDataRange().getValues();
    let limpos = 0;
    for (let i = 1; i < linhas.length; i++) {
      if (!String(linhas[i][0] || '').trim()) continue;
      const atuais = parseEtiquetasInva_(linhas[i][colEtiquetas - 1]);
      if (atuais.indexOf(id) < 0) continue;
      const novos = atuais.filter(function (item) { return item !== id; });
      gravarTextoInva_(instSheet, i + 1, colEtiquetas, novos.join(','));
      limpos++;
    }

    SpreadsheetApp.flush();
    return createJsonResponse({
      status: 'success',
      data: {etiquetas: restante, instrutoresAtualizados: limpos}
    });
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function handleSetInstructorLabels(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const nome = String((data || {}).nome || '').trim();
    if (!nome) {
      return createJsonResponse({status: 'error', message: 'Informe o instrutor.'});
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const instSheet = ss.getSheetByName('Instrutores');
    const linha = linhaDoInstrutorInva_(instSheet, nome);
    if (!linha) {
      return createJsonResponse({
        status: 'error',
        message: 'Instrutor "' + nome + '" não encontrado na planilha.'
      });
    }

    const catalogo = garantirEtiquetasInva_(ss);
    const ids = sanearEtiquetasInva_((data || {}).etiquetas, catalogo);
    const colunas = mapaColunasInstrutores_(instSheet, true);
    gravarEtiquetasDoInstrutorInva_(instSheet, linha, colunas, ids, catalogo);

    SpreadsheetApp.flush();
    return createJsonResponse({
      status: 'success',
      data: {nome: nome, etiquetas: ids, tipo: tipoEspelhoInva_(ids, catalogo)}
    });
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/**
 * PASSO MANUAL, rodado uma vez pelo editor (clasp run nao funciona neste
 * projeto). Cria a aba Etiquetas com a semente e converte a coluna Tipo de
 * cada instrutor na etiqueta CLT ou Eventual.
 *
 * Idempotente: quem ja tem etiqueta gravada nao e tocado, entao rodar de
 * novo nao desfaz marcacao feita na tela.
 */
function instalarEtiquetasInva() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const catalogo = garantirEtiquetasInva_(ss);
  const instSheet = ss.getSheetByName('Instrutores');
  const colunas = mapaColunasInstrutores_(instSheet, true);
  const colEtiquetas = colunas[INVA_COL_ETIQUETAS];
  const linhas = instSheet.getDataRange().getValues();
  const migrados = [];
  const semTipo = [];

  for (let i = 1; i < linhas.length; i++) {
    const nome = String(linhas[i][0] || '').trim();
    if (!nome) continue;
    // Ja tem etiqueta: nao mexe.
    if (parseEtiquetasInva_(linhas[i][colEtiquetas - 1]).length) continue;

    const tipo = String(linhas[i][1] || '').trim().toUpperCase();
    if (!tipo) { semTipo.push(nome); continue; }
    const id = tipo === 'CLT' ? 'clt' : 'eventual';
    // Se o id da semente nao existir (catalogo editado antes da migracao),
    // pula em vez de gravar id que a tela nao sabe pintar.
    if (!catalogo.some(function (e) { return e.id === id; })) { semTipo.push(nome); continue; }
    gravarTextoInva_(instSheet, i + 1, colEtiquetas, id);
    migrados.push(nome + ' -> ' + id);
  }

  SpreadsheetApp.flush();
  Logger.log('=== ETIQUETAS INSTALADAS ===');
  Logger.log('Catálogo: ' + catalogo.length + ' etiquetas');
  Logger.log('Migrados do Tipo (' + migrados.length + '):');
  Logger.log(migrados.length ? migrados.join('\n') : 'nenhum');
  Logger.log('Sem Tipo legível, ficaram sem etiqueta (' + semTipo.length + '):');
  Logger.log(semTipo.length ? semTipo.join('\n') : 'nenhum');
  return {catalogo: catalogo.length, migrados: migrados.length, semEtiqueta: semTipo.length};
}

// ============================================================
// COMENTARIOS — recado da operacao sobre cada instrutor
// ============================================================

/** Mesma chave usada pela aba Horas: casa por nome, sem acento de caixa. */
function chaveInstrutorInva_(nome) {
  return String(nome || '').trim().toUpperCase();
}

/** Id opaco. Nao deriva do texto: dois comentarios iguais sao dois registros. */
function novoIdComentarioInva_(usados) {
  let id = '';
  do {
    id = 'cm' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  } while (usados.indexOf(id) >= 0);
  return id;
}

/** A aba dos comentarios, criada com cabecalho quando criar=true. */
function abaComentariosInva_(ss, criar) {
  let aba = ss.getSheetByName(INVA_ABA_COMENTARIOS);
  if (aba || !criar) return aba;
  aba = ss.insertSheet(INVA_ABA_COMENTARIOS);
  aba.getRange(1, 1, 1, INVA_COMENTARIOS_HEADER.length)
    .setValues([INVA_COMENTARIOS_HEADER])
    .setFontWeight('bold');
  aba.setFrozenRows(1);
  return aba;
}

/**
 * Le todos os comentarios, agrupados por instrutor e em ordem cronologica.
 *
 * Aba ausente devolve {} SEM criar nada: e o que o handleGetData usa, e
 * leitura que cria aba e escrita disfarcada. Duas cargas de tela ao mesmo
 * tempo criariam a aba duas vezes.
 *
 * ⚠️ getDisplayValues, nao getValues: DATA e TEXTO sao gravados como texto,
 * mas basta alguem reformatar a coluna no Sheets para o getValues devolver um
 * Date deslocado pelo fuso. O que a pessoa ve na celula e a leitura confiavel.
 * Mesma decisao da coluna Data na reconciliacao e das datas do cadastro de
 * aluno no Hub.
 */
function lerComentariosInva_(ss) {
  const aba = abaComentariosInva_(ss, false);
  if (!aba) return {};
  const linhas = aba.getDataRange().getDisplayValues().slice(1);
  const porInstrutor = {};

  linhas.forEach(function (linha, i) {
    const id = String(linha[0] || '').trim();
    const instrutor = String(linha[1] || '').trim();
    const texto = String(linha[4] || '');
    if (!id || !instrutor || !texto.trim()) return;
    const chave = chaveInstrutorInva_(instrutor);
    if (!porInstrutor[chave]) porInstrutor[chave] = [];
    porInstrutor[chave].push({
      id: id,
      autor: String(linha[2] || '').trim(),
      data: String(linha[3] || '').trim(),
      texto: texto,
      iso: String(linha[5] || '').trim(),
      // Posicao na aba, so para desempatar quem nao tem ISO (comentario
      // gravado a mao no Sheets).
      _ordem: i
    });
  });

  // Cronologica de verdade, e nao apenas a ordem das linhas: alguem pode ter
  // ordenado a aba a mao, e ai a thread apareceria embaralhada na tela.
  Object.keys(porInstrutor).forEach(function (chave) {
    porInstrutor[chave].sort(function (a, b) {
      if (a.iso && b.iso && a.iso !== b.iso) return a.iso < b.iso ? -1 : 1;
      return a._ordem - b._ordem;
    });
    porInstrutor[chave].forEach(function (comentario) { delete comentario._ordem; });
  });

  return porInstrutor;
}

/** Todos os ids ja usados, para o gerador nao repetir. */
function idsComentariosInva_(porInstrutor) {
  const ids = [];
  Object.keys(porInstrutor).forEach(function (chave) {
    porInstrutor[chave].forEach(function (comentario) { ids.push(comentario.id); });
  });
  return ids;
}

function handleAddComment(data) {
  const lock = LockService.getScriptLock();
  try {
    // Le os ids existentes e so depois insere: sem a trava, dois envios
    // simultaneos leem a mesma lista e podem cunhar o mesmo id.
    lock.waitLock(30000);

    const nome = String((data || {}).nome || '').trim();
    const texto = String((data || {}).texto || '').trim();
    const autor = String((data || {}).autor || '').trim();

    if (!nome) {
      return createJsonResponse({status: 'error', message: 'Informe o instrutor.'});
    }
    if (!texto) {
      return createJsonResponse({status: 'error', message: 'Escreva o comentário antes de salvar.'});
    }
    if (texto.length > INVA_COMENTARIO_TEXTO_MAX) {
      return createJsonResponse({
        status: 'error',
        message: 'O comentário passa de ' + INVA_COMENTARIO_TEXTO_MAX + ' caracteres. Resuma ou divida em dois.'
      });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const instSheet = ss.getSheetByName('Instrutores');
    // Recusa comentario em quem nao existe: sem isto, um nome errado gravaria
    // uma linha que nunca aparece em tela nenhuma.
    if (!linhaDoInstrutorInva_(instSheet, nome)) {
      return createJsonResponse({
        status: 'error',
        message: 'Instrutor "' + nome + '" não encontrado na planilha.'
      });
    }

    const porInstrutor = lerComentariosInva_(ss);
    const aba = abaComentariosInva_(ss, true);
    const agora = new Date();
    const linha = [
      novoIdComentarioInva_(idsComentariosInva_(porInstrutor)),
      nome,
      autor,
      Utilities.formatDate(agora, INVA_FUSO, 'dd/MM/yyyy HH:mm'),
      texto,
      // ⚠️ Com milissegundos de proposito. Dois comentarios no mesmo segundo
      // sao normais (a pessoa cola um texto e manda o seguinte), e com
      // precisao de segundo eles empatariam: a ordem cairia na posicao da
      // linha, que e justamente o que este campo existe para nao depender.
      Utilities.formatDate(agora, INVA_FUSO, "yyyy-MM-dd'T'HH:mm:ss.SSS")
    ];

    // ⚠️ Formato de texto ANTES do valor, na faixa inteira. Sem isto o Sheets
    // interpreta a DATA como Date (e a leitura volta deslocada) e um texto
    // comecando com "=" viraria formula. Quinta vez que essa armadilha aparece
    // no projeto, depois do alvo no LOG da Escala CCO, da DATA_NASCIMENTO, do
    // data URI do avatar e do saldo inicial "5.8".
    const destino = aba.getRange(aba.getLastRow() + 1, 1, 1, INVA_COMENTARIOS_HEADER.length);
    destino.setNumberFormat('@');
    destino.setValues([linha]);

    SpreadsheetApp.flush();
    // Devolve a lista inteira do instrutor, ja recalculada pelo servidor: a
    // tela renderiza dela em vez de confiar no que fingiu enquanto esperava.
    const atualizados = lerComentariosInva_(ss)[chaveInstrutorInva_(nome)] || [];
    return createJsonResponse({
      status: 'success',
      data: {nome: nome, comentarios: atualizados}
    });
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function handleDeleteComment(data) {
  const lock = LockService.getScriptLock();
  try {
    // Apagar linha desloca as de baixo: com dois pedidos em paralelo, o
    // segundo apagaria a linha errada.
    lock.waitLock(30000);

    const id = String((data || {}).id || '').trim();
    const autor = String((data || {}).autor || '').trim();
    if (!id) {
      return createJsonResponse({status: 'error', message: 'Informe o comentário.'});
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const aba = abaComentariosInva_(ss, false);
    if (!aba) {
      return createJsonResponse({status: 'error', message: 'Comentário não encontrado.'});
    }

    const linhas = aba.getDataRange().getDisplayValues();
    let alvo = 0;
    let dono = '';
    let nome = '';
    for (let i = 1; i < linhas.length; i++) {
      if (String(linhas[i][0] || '').trim() !== id) continue;
      alvo = i + 1;
      nome = String(linhas[i][1] || '').trim();
      dono = String(linhas[i][2] || '').trim();
      break;
    }
    if (!alvo) {
      return createJsonResponse({status: 'error', message: 'Comentário não encontrado.'});
    }

    // ⚠️ Isto NAO e controle de acesso: este backend responde ao anonimo e o
    // autor chega no corpo do POST, como em todas as outras rotas daqui. E uma
    // trava contra apagar o comentario de outra pessoa por engano, e o que a
    // tela promete ao esconder o botao. Comentario antigo sem autor gravado
    // fica apagavel por qualquer um, de proposito: senao ninguem o removeria.
    if (dono && chaveInstrutorInva_(dono) !== chaveInstrutorInva_(autor)) {
      return createJsonResponse({
        status: 'error',
        message: 'Só quem escreveu o comentário pode apagá-lo.'
      });
    }

    aba.deleteRow(alvo);
    SpreadsheetApp.flush();
    const atualizados = lerComentariosInva_(ss)[chaveInstrutorInva_(nome)] || [];
    return createJsonResponse({
      status: 'success',
      data: {nome: nome, comentarios: atualizados}
    });
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// ============================================================
// INSTRUTORES DE SOLO — sem CAVOK, sem OPR, sem meta de horas
//
// Tres abas novas (InstrutoresSolo, EtiquetasSolo, ComentariosSolo), cada
// uma nascendo sozinha na primeira ESCRITA. Leitura nunca cria aba: e o
// mesmo cuidado das abas Etiquetas/Comentarios do mundo de voo, porque
// leitura que escreve e escrita disfarcada e duas cargas de tela ao mesmo
// tempo criariam a aba duas vezes.
// ============================================================

/**
 * Reconcilia o cabecalho da aba de solo com INVA_INSTRUTORES_SOLO_HEADER.
 *
 * ⚠️ Escrever o cabecalho SO na criacao da aba deixa para sempre sem as colunas
 * novas a aba que JA existe em producao, e foi exatamente essa a armadilha do
 * portalAba_ no Hub. A aba InstrutoresSolo nasceu com 4 colunas e ganhou as 4
 * de inativacao depois, entao o cabecalho tem que ser conferido a cada
 * ESCRITA. Aqui a leitura e por POSICAO fixa, e o cabecalho e so legibilidade
 * para quem abre a planilha, entao sobrescrever um titulo divergente e o certo.
 *
 * ⚠️ Nunca chamado na leitura: leitura que escreve e escrita disfarcada, e duas
 * cargas de tela ao mesmo tempo gravariam o cabecalho duas vezes. Na leitura a
 * coluna ausente volta undefined, que ja significa "ativo".
 */
function garantirCabecalhoSoloInva_(aba) {
  const alvo = INVA_INSTRUTORES_SOLO_HEADER;
  const faltamColunas = alvo.length - aba.getMaxColumns();
  if (faltamColunas > 0) aba.insertColumnsAfter(aba.getMaxColumns(), faltamColunas);

  const atual = aba.getRange(1, 1, 1, alvo.length).getValues()[0];
  for (let i = 0; i < alvo.length; i++) {
    if (normalizarHeaderInva_(atual[i]) === normalizarHeaderInva_(alvo[i])) continue;
    aba.getRange(1, i + 1).setValue(alvo[i]).setFontWeight('bold');
  }
}

/** A aba de instrutores de solo, criada com cabecalho quando criar=true. */
function abaInstrutoresSoloInva_(ss, criar) {
  let aba = ss.getSheetByName(INVA_ABA_INSTRUTORES_SOLO);
  if (aba && criar) garantirCabecalhoSoloInva_(aba);
  if (aba || !criar) return aba;
  aba = ss.insertSheet(INVA_ABA_INSTRUTORES_SOLO);
  aba.getRange(1, 1, 1, INVA_INSTRUTORES_SOLO_HEADER.length)
    .setValues([INVA_INSTRUTORES_SOLO_HEADER])
    .setFontWeight('bold');
  aba.setFrozenRows(1);
  return aba;
}

/** Numero da linha do instrutor de solo, ou 0 se nao existir (ou aba ausente). */
function linhaDoInstrutorSoloInva_(sheet, nome) {
  const chave = String(nome || '').trim().toUpperCase();
  if (!chave || !sheet) return 0;
  const linhas = sheet.getDataRange().getValues();
  for (let i = 1; i < linhas.length; i++) {
    if (String(linhas[i][0] || '').trim().toUpperCase() === chave) return i + 1;
  }
  return 0;
}

/**
 * Maior posicao ja usada numa base, para quem chega (cadastro novo ou
 * mudanca de base) entrar no FIM da fila. Mesma logica de
 * ultimaOrdemDaBaseInva_, adaptada para colunas fixas.
 */
function ultimaOrdemDaBaseSoloInva_(sheet, base, ignorarLinha) {
  if (!sheet) return 0;
  const linhas = sheet.getDataRange().getValues();
  let maior = 0;
  for (let i = 1; i < linhas.length; i++) {
    if (ignorarLinha && (i + 1) === ignorarLinha) continue;
    if (!String(linhas[i][0] || '').trim()) continue;
    const daLinha = normalizarBaseInva_(linhas[i][INVA_SOLO_COL_BASE - 1]) || INVA_BASE_PADRAO;
    if (daLinha !== base) continue;
    const ordem = Number(linhas[i][INVA_SOLO_COL_ORDEM - 1]) || 0;
    if (ordem > maior) maior = ordem;
  }
  return maior;
}

/** A aba do catalogo de solo, criada com cabecalho quando criar=true. */
function abaEtiquetasSoloInva_(ss, criar) {
  let aba = ss.getSheetByName(INVA_ABA_ETIQUETAS_SOLO);
  if (aba || !criar) return aba;
  aba = ss.insertSheet(INVA_ABA_ETIQUETAS_SOLO);
  aba.getRange(1, 1, 1, INVA_ETIQUETAS_HEADER.length)
    .setValues([INVA_ETIQUETAS_HEADER])
    .setFontWeight('bold');
  aba.setFrozenRows(1);
  return aba;
}

/** Le o catalogo de solo. Aba ausente devolve lista vazia SEM criar nada. */
function lerEtiquetasSoloInva_(ss) {
  const aba = abaEtiquetasSoloInva_(ss, false);
  if (!aba) return [];
  const linhas = aba.getDataRange().getValues().slice(1);
  const lista = [];
  linhas.forEach(function (linha, i) {
    const id = String(linha[0] || '').trim();
    const nome = String(linha[1] || '').trim();
    if (!id || !nome) return;
    lista.push({
      id: id,
      nome: nome,
      cor: normalizarCorEtiquetaInva_(linha[2]),
      ordem: Number(linha[3]) || (i + 1)
    });
  });
  lista.sort(function (a, b) { return a.ordem - b.ordem; });
  return lista;
}

/** Reescreve a aba de etiquetas de solo inteira a partir da lista. */
function gravarEtiquetasSoloInva_(ss, lista) {
  const aba = abaEtiquetasSoloInva_(ss, true);
  const ultima = aba.getLastRow();
  if (ultima > 1) aba.getRange(2, 1, ultima - 1, INVA_ETIQUETAS_HEADER.length).clearContent();
  if (!lista.length) return;
  const valores = lista.map(function (etiqueta, i) {
    return [etiqueta.id, etiqueta.nome, etiqueta.cor, i + 1];
  });
  // Formato de texto antes do valor, mesma armadilha do catalogo de voo.
  const faixa = aba.getRange(2, 1, valores.length, INVA_ETIQUETAS_HEADER.length);
  faixa.setNumberFormat('@');
  faixa.setValues(valores);
}

/** A aba de comentarios de solo, criada com cabecalho quando criar=true. */
function abaComentariosSoloInva_(ss, criar) {
  let aba = ss.getSheetByName(INVA_ABA_COMENTARIOS_SOLO);
  if (aba || !criar) return aba;
  aba = ss.insertSheet(INVA_ABA_COMENTARIOS_SOLO);
  aba.getRange(1, 1, 1, INVA_COMENTARIOS_HEADER.length)
    .setValues([INVA_COMENTARIOS_HEADER])
    .setFontWeight('bold');
  aba.setFrozenRows(1);
  return aba;
}

/** Le os comentarios de solo. Mesma logica de lerComentariosInva_. */
function lerComentariosSoloInva_(ss) {
  const aba = abaComentariosSoloInva_(ss, false);
  if (!aba) return {};
  const linhas = aba.getDataRange().getDisplayValues().slice(1);
  const porInstrutor = {};

  linhas.forEach(function (linha, i) {
    const id = String(linha[0] || '').trim();
    const instrutor = String(linha[1] || '').trim();
    const texto = String(linha[4] || '');
    if (!id || !instrutor || !texto.trim()) return;
    const chave = chaveInstrutorInva_(instrutor);
    if (!porInstrutor[chave]) porInstrutor[chave] = [];
    porInstrutor[chave].push({
      id: id,
      autor: String(linha[2] || '').trim(),
      data: String(linha[3] || '').trim(),
      texto: texto,
      iso: String(linha[5] || '').trim(),
      _ordem: i
    });
  });

  Object.keys(porInstrutor).forEach(function (chave) {
    porInstrutor[chave].sort(function (a, b) {
      if (a.iso && b.iso && a.iso !== b.iso) return a.iso < b.iso ? -1 : 1;
      return a._ordem - b._ordem;
    });
    porInstrutor[chave].forEach(function (comentario) { delete comentario._ordem; });
  });

  return porInstrutor;
}

/**
 * Monta {instrutores, etiquetas} de solo para o handleGetData. So leitura,
 * nao cria aba nenhuma: enquanto ninguem cadastrou o primeiro instrutor de
 * solo, sai tudo vazio e a tela mostra a lista vazia, nao um erro.
 */
function instrutoresSoloParaTela_(ss) {
  const catalogo = lerEtiquetasSoloInva_(ss);
  const sheet = abaInstrutoresSoloInva_(ss, false);
  if (!sheet) return {instrutores: [], etiquetas: catalogo};

  const comentarios = lerComentariosSoloInva_(ss);
  const linhas = sheet.getDataRange().getValues().slice(1);
  const instrutores = [];
  linhas.forEach(function (linha) {
    const nome = String(linha[0] || '').trim();
    if (!nome) return;
    instrutores.push({
      nome: nome,
      base: normalizarBaseInva_(linha[INVA_SOLO_COL_BASE - 1]) || INVA_BASE_PADRAO,
      etiquetas: sanearEtiquetasInva_(linha[INVA_SOLO_COL_ETIQUETAS - 1], catalogo),
      comentarios: comentarios[chaveInstrutorInva_(nome)] || [],
      ordem: Number(linha[INVA_SOLO_COL_ORDEM - 1]) || 0,
      // Coluna ausente (aba criada antes destas 4) volta undefined, que
      // inativoInva_ le como ativo. Sem migracao a fazer.
      inativo: inativoInva_(linha[INVA_SOLO_COL_INATIVO - 1]),
      inativoEm: String(linha[INVA_SOLO_COL_INATIVO_EM - 1] || ''),
      inativoPor: String(linha[INVA_SOLO_COL_INATIVO_POR - 1] || ''),
      inativoMotivo: String(linha[INVA_SOLO_COL_INATIVO_MOTIVO - 1] || '')
    });
  });
  return {instrutores: instrutores, etiquetas: catalogo};
}

function handleAddInstructorSolo(data) {
  const lock = LockService.getScriptLock();
  try {
    // Mesmo motivo do add_instructor de voo: sem a trava, dois cliques
    // seguidos rodam em paralelo e os dois inserem.
    lock.waitLock(30000);

    const nome = String((data || {}).nome || '').trim();
    if (!nome) {
      return createJsonResponse({status: 'error', message: 'Informe o nome do instrutor.'});
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const instSheet = abaInstrutoresSoloInva_(ss, true);

    // Mesma razao da versao de voo: o inativo nao aparece na lista, entao a
    // mensagem tem que dizer que ele existe e onde reativa-lo.
    const chave = nome.toUpperCase();
    const linhasAtuais = instSheet.getDataRange().getValues();
    for (let i = 1; i < linhasAtuais.length; i++) {
      if (String(linhasAtuais[i][0] || '').trim().toUpperCase() !== chave) continue;
      const estaInativo = inativoInva_(linhasAtuais[i][INVA_SOLO_COL_INATIVO - 1]);
      return createJsonResponse({
        status: 'error',
        message: estaInativo
          ? 'O instrutor de solo "' + nome + '" já existe e está INATIVO. Reative-o no '
            + 'bloco "Instrutores inativos", no fim da lista: assim ele volta com as '
            + 'etiquetas e os comentários que já tinha.'
          : 'Já existe um instrutor de solo cadastrado com o nome "' + nome + '".'
      });
    }

    const baseNova = normalizarBaseInva_(data.base) || INVA_BASE_PADRAO;
    // Ordem ANTES de gravar a base, mesma razao da versao de voo: com a base
    // ja gravada a propria linha nova entraria na contagem do destino.
    const ordemNova = ultimaOrdemDaBaseSoloInva_(instSheet, baseNova) + 1;
    const catalogo = lerEtiquetasSoloInva_(ss);
    const ids = sanearEtiquetasInva_(data.etiquetas, catalogo);

    // Nome pelo appendRow; BASE e ETIQUETAS depois, por gravarTextoInva_
    // (formato de texto ANTES do valor). ORDEM e numero puro.
    instSheet.appendRow([nome, '', '', ordemNova]);
    const linhaNova = instSheet.getLastRow();
    gravarTextoInva_(instSheet, linhaNova, INVA_SOLO_COL_BASE, baseNova);
    gravarTextoInva_(instSheet, linhaNova, INVA_SOLO_COL_ETIQUETAS, ids.join(','));

    SpreadsheetApp.flush();
    return createJsonResponse({status: 'success'});
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function handleSetInstructorBaseSolo(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const nome = String((data || {}).nome || '').trim();
    const base = normalizarBaseInva_((data || {}).base);
    if (!nome) {
      return createJsonResponse({status: 'error', message: 'Informe o instrutor.'});
    }
    if (!base) {
      return createJsonResponse({
        status: 'error',
        message: 'Base inválida. Use ' + INVA_BASES.join(' ou ') + '.'
      });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const instSheet = abaInstrutoresSoloInva_(ss, true);
    const linha = linhaDoInstrutorSoloInva_(instSheet, nome);
    if (!linha) {
      return createJsonResponse({
        status: 'error',
        message: 'Instrutor de solo "' + nome + '" não encontrado na planilha.'
      });
    }

    const ordem = ultimaOrdemDaBaseSoloInva_(instSheet, base) + 1;
    gravarTextoInva_(instSheet, linha, INVA_SOLO_COL_BASE, base);
    instSheet.getRange(linha, INVA_SOLO_COL_ORDEM).setValue(ordem);

    SpreadsheetApp.flush();
    return createJsonResponse({
      status: 'success',
      data: {nome: nome, base: base, ordem: ordem}
    });
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/**
 * Inativa ou reativa um instrutor de solo. Espelho de handleSetInstructorActive,
 * adaptado para as colunas de posicao fixa desta aba. As mesmas duas decisoes
 * valem aqui: nada e apagado, e a reativacao poe o instrutor no fim da fila.
 */
function handleSetInstructorActiveSolo(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const nome = String((data || {}).nome || '').trim();
    const inativar = (data || {}).inativo === true;
    if (!nome) {
      return createJsonResponse({status: 'error', message: 'Informe o instrutor.'});
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const instSheet = abaInstrutoresSoloInva_(ss, true);
    const linha = linhaDoInstrutorSoloInva_(instSheet, nome);
    if (!linha) {
      return createJsonResponse({
        status: 'error',
        message: 'Instrutor de solo "' + nome + '" não encontrado na planilha.'
      });
    }

    const autor = String((data || {}).autor || '').trim();
    const motivo = String((data || {}).motivo || '')
      .trim().substring(0, INVA_MOTIVO_INATIVO_MAX);
    const quando = inativar
      ? Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm')
      : '';

    instSheet.getRange(linha, INVA_SOLO_COL_INATIVO).setValue(inativar);
    gravarTextoInva_(instSheet, linha, INVA_SOLO_COL_INATIVO_EM, quando);
    gravarTextoInva_(instSheet, linha, INVA_SOLO_COL_INATIVO_POR, inativar ? autor : '');
    gravarTextoInva_(instSheet, linha, INVA_SOLO_COL_INATIVO_MOTIVO, inativar ? motivo : '');

    let ordem = 0;
    if (!inativar) {
      const base = normalizarBaseInva_(
        instSheet.getRange(linha, INVA_SOLO_COL_BASE).getValue()
      ) || INVA_BASE_PADRAO;
      ordem = ultimaOrdemDaBaseSoloInva_(instSheet, base, linha) + 1;
      instSheet.getRange(linha, INVA_SOLO_COL_ORDEM).setValue(ordem);
    }

    SpreadsheetApp.flush();
    return createJsonResponse({
      status: 'success',
      data: {
        nome: nome,
        inativo: inativar,
        inativoEm: quando,
        inativoPor: inativar ? autor : '',
        inativoMotivo: inativar ? motivo : '',
        ordem: ordem
      }
    });
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/** Reordena UMA base de solo. Mesma logica de handleSetInstructorOrder. */
function handleSetInstructorOrderSolo(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const base = normalizarBaseInva_((data || {}).base);
    const nomes = Array.isArray((data || {}).nomes) ? (data || {}).nomes : null;
    if (!base) {
      return createJsonResponse({status: 'error', message: 'Base inválida.'});
    }
    if (!nomes || !nomes.length) {
      return createJsonResponse({status: 'error', message: 'Informe a ordem dos instrutores.'});
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const instSheet = abaInstrutoresSoloInva_(ss, true);

    // Resolve TODAS as linhas antes de escrever qualquer uma, mesmo cuidado
    // da versao de voo: um nome errado no meio deixaria a base pela metade.
    const alvos = [];
    for (let i = 0; i < nomes.length; i++) {
      const nome = String(nomes[i] || '').trim();
      const linha = nome ? linhaDoInstrutorSoloInva_(instSheet, nome) : 0;
      if (!linha) {
        return createJsonResponse({
          status: 'error',
          message: 'Instrutor de solo "' + nome + '" não encontrado na planilha.'
        });
      }
      alvos.push({nome: nome, linha: linha});
    }

    alvos.forEach(function (alvo, i) {
      instSheet.getRange(alvo.linha, INVA_SOLO_COL_BASE).setValue(base);
      instSheet.getRange(alvo.linha, INVA_SOLO_COL_ORDEM).setValue(i + 1);
    });

    SpreadsheetApp.flush();
    return createJsonResponse({
      status: 'success',
      data: {
        base: base,
        ordem: alvos.map(function (alvo, i) { return {nome: alvo.nome, ordem: i + 1}; })
      }
    });
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function handleSaveLabelSolo(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const nome = String((data || {}).nome || '').trim();
    if (!nome) {
      return createJsonResponse({status: 'error', message: 'Dê um nome para a etiqueta.'});
    }
    if (nome.length > INVA_ETIQUETA_NOME_MAX) {
      return createJsonResponse({
        status: 'error',
        message: 'O nome da etiqueta passa de ' + INVA_ETIQUETA_NOME_MAX + ' caracteres.'
      });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const catalogo = lerEtiquetasSoloInva_(ss);
    const id = String((data || {}).id || '').trim();
    const cor = normalizarCorEtiquetaInva_((data || {}).cor);

    const chave = nome.toUpperCase();
    const repetida = catalogo.some(function (etiqueta) {
      return etiqueta.id !== id && etiqueta.nome.trim().toUpperCase() === chave;
    });
    if (repetida) {
      return createJsonResponse({status: 'error', message: 'Já existe uma etiqueta com esse nome.'});
    }

    if (id) {
      const alvo = catalogo.filter(function (e) { return e.id === id; })[0];
      if (!alvo) {
        return createJsonResponse({status: 'error', message: 'Etiqueta não encontrada.'});
      }
      alvo.nome = nome;
      alvo.cor = cor;
    } else {
      const usados = catalogo.map(function (e) { return e.id; });
      catalogo.push({
        id: novoIdEtiquetaInva_(usados),
        nome: nome,
        cor: cor,
        ordem: catalogo.length + 1
      });
    }

    gravarEtiquetasSoloInva_(ss, catalogo);
    SpreadsheetApp.flush();
    return createJsonResponse({status: 'success', data: {etiquetas: catalogo}});
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function handleDeleteLabelSolo(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const id = String((data || {}).id || '').trim();
    if (!id) {
      return createJsonResponse({status: 'error', message: 'Informe a etiqueta.'});
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const catalogo = lerEtiquetasSoloInva_(ss);
    const restante = catalogo.filter(function (etiqueta) { return etiqueta.id !== id; });
    if (restante.length === catalogo.length) {
      return createJsonResponse({status: 'error', message: 'Etiqueta não encontrada.'});
    }

    gravarEtiquetasSoloInva_(ss, restante);

    // Limpa o id orfao de quem tinha a etiqueta, senao ela reaparece como
    // chip fantasma se alguem recriar uma etiqueta com o mesmo id.
    const instSheet = abaInstrutoresSoloInva_(ss, false);
    let limpos = 0;
    if (instSheet) {
      const linhas = instSheet.getDataRange().getValues();
      for (let i = 1; i < linhas.length; i++) {
        if (!String(linhas[i][0] || '').trim()) continue;
        const atuais = parseEtiquetasInva_(linhas[i][INVA_SOLO_COL_ETIQUETAS - 1]);
        if (atuais.indexOf(id) < 0) continue;
        const novos = atuais.filter(function (item) { return item !== id; });
        gravarTextoInva_(instSheet, i + 1, INVA_SOLO_COL_ETIQUETAS, novos.join(','));
        limpos++;
      }
    }

    SpreadsheetApp.flush();
    return createJsonResponse({
      status: 'success',
      data: {etiquetas: restante, instrutoresAtualizados: limpos}
    });
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function handleSetInstructorLabelsSolo(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const nome = String((data || {}).nome || '').trim();
    if (!nome) {
      return createJsonResponse({status: 'error', message: 'Informe o instrutor.'});
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const instSheet = abaInstrutoresSoloInva_(ss, true);
    const linha = linhaDoInstrutorSoloInva_(instSheet, nome);
    if (!linha) {
      return createJsonResponse({
        status: 'error',
        message: 'Instrutor de solo "' + nome + '" não encontrado na planilha.'
      });
    }

    const catalogo = lerEtiquetasSoloInva_(ss);
    const ids = sanearEtiquetasInva_((data || {}).etiquetas, catalogo);
    // Sem espelho de Tipo aqui: a aba de solo nao tem essa coluna, e o
    // vinculo CLT/Eventual e exclusivo dos instrutores de voo.
    gravarTextoInva_(instSheet, linha, INVA_SOLO_COL_ETIQUETAS, ids.join(','));

    SpreadsheetApp.flush();
    return createJsonResponse({status: 'success', data: {nome: nome, etiquetas: ids}});
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function handleAddCommentSolo(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const nome = String((data || {}).nome || '').trim();
    const texto = String((data || {}).texto || '').trim();
    const autor = String((data || {}).autor || '').trim();

    if (!nome) {
      return createJsonResponse({status: 'error', message: 'Informe o instrutor.'});
    }
    if (!texto) {
      return createJsonResponse({status: 'error', message: 'Escreva o comentário antes de salvar.'});
    }
    if (texto.length > INVA_COMENTARIO_TEXTO_MAX) {
      return createJsonResponse({
        status: 'error',
        message: 'O comentário passa de ' + INVA_COMENTARIO_TEXTO_MAX + ' caracteres. Resuma ou divida em dois.'
      });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const instSheet = abaInstrutoresSoloInva_(ss, false);
    if (!instSheet || !linhaDoInstrutorSoloInva_(instSheet, nome)) {
      return createJsonResponse({
        status: 'error',
        message: 'Instrutor de solo "' + nome + '" não encontrado na planilha.'
      });
    }

    const porInstrutor = lerComentariosSoloInva_(ss);
    const aba = abaComentariosSoloInva_(ss, true);
    const agora = new Date();
    const linha = [
      novoIdComentarioInva_(idsComentariosInva_(porInstrutor)),
      nome,
      autor,
      Utilities.formatDate(agora, INVA_FUSO, 'dd/MM/yyyy HH:mm'),
      texto,
      Utilities.formatDate(agora, INVA_FUSO, "yyyy-MM-dd'T'HH:mm:ss.SSS")
    ];

    const destino = aba.getRange(aba.getLastRow() + 1, 1, 1, INVA_COMENTARIOS_HEADER.length);
    destino.setNumberFormat('@');
    destino.setValues([linha]);

    SpreadsheetApp.flush();
    const atualizados = lerComentariosSoloInva_(ss)[chaveInstrutorInva_(nome)] || [];
    return createJsonResponse({
      status: 'success',
      data: {nome: nome, comentarios: atualizados}
    });
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function handleDeleteCommentSolo(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const id = String((data || {}).id || '').trim();
    const autor = String((data || {}).autor || '').trim();
    if (!id) {
      return createJsonResponse({status: 'error', message: 'Informe o comentário.'});
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const aba = abaComentariosSoloInva_(ss, false);
    if (!aba) {
      return createJsonResponse({status: 'error', message: 'Comentário não encontrado.'});
    }

    const linhas = aba.getDataRange().getDisplayValues();
    let alvo = 0;
    let dono = '';
    let nome = '';
    for (let i = 1; i < linhas.length; i++) {
      if (String(linhas[i][0] || '').trim() !== id) continue;
      alvo = i + 1;
      nome = String(linhas[i][1] || '').trim();
      dono = String(linhas[i][2] || '').trim();
      break;
    }
    if (!alvo) {
      return createJsonResponse({status: 'error', message: 'Comentário não encontrado.'});
    }

    // Mesma trava contra apagar comentario de outra pessoa por engano, nao
    // controle de acesso, mesma nota da versao de voo.
    if (dono && chaveInstrutorInva_(dono) !== chaveInstrutorInva_(autor)) {
      return createJsonResponse({
        status: 'error',
        message: 'Só quem escreveu o comentário pode apagá-lo.'
      });
    }

    aba.deleteRow(alvo);
    SpreadsheetApp.flush();
    const atualizados = lerComentariosSoloInva_(ss)[chaveInstrutorInva_(nome)] || [];
    return createJsonResponse({
      status: 'success',
      data: {nome: nome, comentarios: atualizados}
    });
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function handleGetData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const instructorsSheet = ss.getSheetByName('Instrutores');
    const hoursSheet = ss.getSheetByName('Horas');

    // criar=false de proposito: leitura nao escreve na planilha. Enquanto as
    // colunas nao existirem, os campos saem no valor padrao.
    const colunas = mapaColunasInstrutores_(instructorsSheet, false);
    const colBase = colunas[INVA_COL_BASE];
    const colLiberado = colunas[INVA_COL_LIBERADO];
    const colLiberadoEm = colunas[INVA_COL_LIBERADO_EM];
    const colLiberadoPor = colunas[INVA_COL_LIBERADO_POR];
    const colEtiquetas = colunas[INVA_COL_ETIQUETAS];
    const colOrdem = colunas[INVA_COL_ORDEM];
    const colInativo = colunas[INVA_COL_INATIVO];
    const colInativoEm = colunas[INVA_COL_INATIVO_EM];
    const colInativoPor = colunas[INVA_COL_INATIVO_POR];
    const colInativoMotivo = colunas[INVA_COL_INATIVO_MOTIVO];
    // Idem: le o catalogo sem criar a aba. Antes do passo de instalacao a
    // lista sai vazia e a tela mostra "nenhuma etiqueta", nao um erro.
    const catalogo = lerEtiquetasInva_(ss);
    // Os comentarios viajam junto pelo mesmo motivo do catalogo: com ~10s de
    // latencia, uma segunda rota so para eles dobraria a espera da tela abrir.
    // Aba ausente devolve {} e cada instrutor sai com a lista vazia.
    const comentarios = lerComentariosInva_(ss);

    const instructors = instructorsSheet.getDataRange().getValues().slice(1);
    const hours = hoursSheet.getDataRange().getValues().slice(1);

    const instructorData = instructors.map(row => {
      const nome = row[0];
      const totalHoras = hours
        .filter(h => h[0] && h[0].toString().trim().toUpperCase() === nome.toString().trim().toUpperCase())
        .reduce((sum, h) => sum + Number(h[2] || 0), 0);

      return {
        nome: nome,
        tipo: row[1],
        totalHoras: totalHoras.toFixed(1),
        base: (colBase ? normalizarBaseInva_(row[colBase - 1]) : '') || INVA_BASE_PADRAO,
        liberadoOpr: colLiberado ? liberacaoInvaAtiva_(row[colLiberado - 1]) : false,
        liberadoEm: colLiberadoEm ? String(row[colLiberadoEm - 1] || '') : '',
        liberadoPor: colLiberadoPor ? String(row[colLiberadoPor - 1] || '') : '',
        etiquetas: colEtiquetas
          ? sanearEtiquetasInva_(String(row[colEtiquetas - 1] || ''), catalogo)
          : [],
        comentarios: comentarios[chaveInstrutorInva_(nome)] || [],
        ordem: colOrdem ? (Number(row[colOrdem - 1]) || 0) : 0,
        // ⚠️ Ativos e inativos viajam JUNTOS, com o sinalizador. Filtrar aqui
        // deixaria a tela sem como listar quem saiu (e sem como reativar), e
        // uma segunda rota so para isso custaria outros ~10s de espera.
        inativo: colInativo ? inativoInva_(row[colInativo - 1]) : false,
        inativoEm: colInativoEm ? String(row[colInativoEm - 1] || '') : '',
        inativoPor: colInativoPor ? String(row[colInativoPor - 1] || '') : '',
        inativoMotivo: colInativoMotivo ? String(row[colInativoMotivo - 1] || '') : ''
      };
    });

    // Instrutores de solo viajam na MESMA resposta, pelo mesmo motivo do
    // catalogo e dos comentarios acima: com ~10s de latencia, uma rota
    // propria so para eles dobraria a espera da tela abrir. Um backend
    // antigo (sem esta secao) nao manda `dataSolo`, e o frontend detecta
    // isso e some com a aba em vez de quebrar.
    const solo = instrutoresSoloParaTela_(ss);

    return createJsonResponse({
      status: 'success',
      data: instructorData,
      dataSolo: solo.instrutores,
      // O catalogo viaja junto com os dados de proposito: com ~10s de
      // latencia, uma segunda rota so para as etiquetas dobraria a espera da
      // tela abrir.
      meta: {
        bases: INVA_BASES,
        metaHoras: INVA_META_HORAS,
        etiquetas: catalogo,
        etiquetasSolo: solo.etiquetas
      }
    });
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

function handleAddInstructor(data) {
  const lock = LockService.getScriptLock();
  try {
    // Sem o lock, dois cliques seguidos (ou um retry do usuario) rodam em
    // paralelo, os dois leem a planilha sem enxergar o outro e os dois inserem.
    lock.waitLock(30000);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const instSheet = ss.getSheetByName('Instrutores');
    const hoursSheet = ss.getSheetByName('Horas');

    const nome = String(data.nome || '').trim();
    if (!nome) {
      return createJsonResponse({status: 'error', message: 'Informe o nome do instrutor.'});
    }

    // Recusa nome ja cadastrado, senao um reenvio duplica a linha.
    //
    // ⚠️ A mensagem precisa distinguir o INATIVO. Ele nao aparece na lista,
    // entao "ja existe um instrutor com esse nome" soa como defeito do sistema
    // justamente para quem esta tentando trazer de volta quem saiu, e a saida
    // obvia (cadastrar com o nome levemente diferente) criaria um segundo
    // instrutor que nao casa com as horas da aba Horas.
    const chave = nome.toUpperCase();
    const colunasAtuais = mapaColunasInstrutores_(instSheet, false);
    const colInativoAtual = colunasAtuais[INVA_COL_INATIVO];
    const linhasAtuais = instSheet.getDataRange().getValues();
    for (let i = 1; i < linhasAtuais.length; i++) {
      if (String(linhasAtuais[i][0] || '').trim().toUpperCase() !== chave) continue;
      const estaInativo = colInativoAtual
        ? inativoInva_(linhasAtuais[i][colInativoAtual - 1])
        : false;
      return createJsonResponse({
        status: 'error',
        message: estaInativo
          ? 'O instrutor "' + nome + '" já existe e está INATIVO. Reative-o no bloco '
            + '"Instrutores inativos", no fim da lista: assim ele volta com as horas, '
            + 'as etiquetas e os comentários que já tinha.'
          : 'Já existe um instrutor cadastrado com o nome "' + nome + '".'
      });
    }

    // O Tipo virou espelho das etiquetas CLT/Eventual. Vai vazio no appendRow
    // e e preenchido logo abaixo, junto com a coluna ETIQUETAS.
    instSheet.appendRow([nome, '']);

    // A base entra por NOME de coluna, depois do appendRow, porque a aba pode
    // ainda nao ter a coluna e o appendRow so preenche da esquerda para a
    // direita. Base ausente ou invalida cai no padrao.
    const colunas = mapaColunasInstrutores_(instSheet, true);
    const linhaNova = instSheet.getLastRow();
    const baseNova = normalizarBaseInva_(data.base) || INVA_BASE_PADRAO;
    // Ordem calculada ANTES de gravar a base: com a base ja gravada, a propria
    // linha nova entraria na contagem e o instrutor herdaria a posicao de si
    // mesmo. Ele entra no FIM da fila de prioridade, que e o unico lugar
    // honesto para quem a coordenacao ainda nao posicionou.
    const ordemNova = ultimaOrdemDaBaseInva_(instSheet, colunas, baseNova) + 1;
    gravarTextoInva_(instSheet, linhaNova, colunas[INVA_COL_BASE], baseNova);
    instSheet.getRange(linhaNova, colunas[INVA_COL_ORDEM]).setValue(ordemNova);

    const catalogo = garantirEtiquetasInva_(ss);
    const ids = sanearEtiquetasInva_(data.etiquetas, catalogo);
    gravarEtiquetasDoInstrutorInva_(instSheet, linhaNova, colunas, ids, catalogo);

    const saldoNumero = Number(data.saldoInicial);
    if (isFinite(saldoNumero) && saldoNumero > 0) {
      // Arredonda mantendo NUMERO. toFixed devolveria a string "5.8", e o Sheets
      // em pt-BR le "5.8" como a data 5 de agosto (grava o serial 46239).
      const saldo = Math.round(saldoNumero * 10) / 10;

      hoursSheet.appendRow([nome, "SALDO INICIAL", "", "SISTEMA"]);

      // Formato ANTES do valor: o Sheets so interpreta o que entra na celula
      // depois de saber o formato dela.
      const celula = hoursSheet.getRange(hoursSheet.getLastRow(), 3);
      celula.setNumberFormat('0.0');
      celula.setValue(saldo);
    }

    SpreadsheetApp.flush();
    return createJsonResponse({status: 'success'});
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// FAXINA DE DADOS (2026-07-28) - rodar pelo editor, sem rota
//
// Conserta o estrago dos dois bugs antigos:
//  a) saldo inicial gravado como string ("5.8") virou data no Sheets
//     (5 de agosto = serial 46239);
//  b) instrutor duplicado, porque a tela dizia erro num cadastro que
//     tinha dado certo e a pessoa tentava de novo.
//
// USO: rode inspecionarDadosInva() PRIMEIRO e leia o log. Só depois
// rode repararDadosInva(). A inspeção não escreve nada.
// ============================================================

/**
 * Converte um saldo corrompido de volta para o número digitado.
 * O Sheets leu a string "5.8" como dia 5 do mês 8, então a volta é
 * dia + "." + mes. Como o toFixed(1) antigo sempre gerava uma casa
 * decimal, o mês resultante é sempre 1 a 9.
 *
 * ⚠️ A inversão NÃO é injetora nas viradas de mês: um saldo de 29,2
 * (29 de fevereiro, que não existe em ano comum) cai no mesmo dia que
 * 1,3 (1 de março). Nesses casos devolve ambiguo=true com as duas
 * leituras, e o reparo automático se recusa a escolher.
 *
 * Devolve null quando o valor não é uma data disfarçada.
 */
function saldoOriginalDeDataInva_(valor) {
  var dia = null;
  var mes = null;

  if (valor instanceof Date) {
    dia = valor.getDate();
    mes = valor.getMonth() + 1;
  } else if (typeof valor === 'number' && valor > 10000 && valor % 1 === 0) {
    // Serial do Sheets: dia 0 = 30/12/1899. Conta em UTC para o fuso
    // da planilha não deslocar a data em um dia. Exige serial inteiro:
    // o bug gerava data sem hora, então fração aqui é outro problema.
    var base = Date.UTC(1899, 11, 30);
    var d = new Date(base + valor * 86400000);
    dia = d.getUTCDate();
    mes = d.getUTCMonth() + 1;
  } else {
    return null;
  }

  // 31 de setembro não existe e o Sheets rolou para 1 de outubro. Como o
  // toFixed(1) só gerava mês de 1 a 9, outubro só pode ter vindo de 31,9.
  if (mes === 10 && dia === 1) {
    return { valor: 31.9, ambiguo: false, alternativa: null };
  }
  if (mes < 1 || mes > 9) return null; // fora do que o bug conseguia gerar

  // Dias do mês anterior, para detectar o estouro que gera ambiguidade.
  // Fevereiro entra como 28: em ano bissexto o 29/02 existe e não estoura.
  var diasMesAnterior = {3: 28, 5: 30, 7: 30, 8: 31, 10: 30};
  var limite = diasMesAnterior[mes];
  var ambiguo = false;
  var alternativa = null;
  if (limite && dia <= (31 - limite)) {
    ambiguo = true;
    alternativa = Number((limite + dia) + '.' + (mes - 1));
  }

  return {
    valor: Number(dia + '.' + mes),
    ambiguo: ambiguo,
    alternativa: alternativa
  };
}

/**
 * Só lê e relata. Não altera nada.
 */
function inspecionarDadosInva() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var instSheet = ss.getSheetByName('Instrutores');
  var hoursSheet = ss.getSheetByName('Horas');

  var instrutores = instSheet.getDataRange().getValues();
  var vistos = {};
  var duplicados = [];
  for (var i = 1; i < instrutores.length; i++) {
    var nome = String(instrutores[i][0] || '').trim();
    if (!nome) continue;
    var chave = nome.toUpperCase();
    if (vistos[chave]) {
      duplicados.push('linha ' + (i + 1) + ': "' + nome + '" (1a vez na linha ' + vistos[chave] + ')');
    } else {
      vistos[chave] = i + 1;
    }
  }

  var horas = hoursSheet.getDataRange().getValues();
  var corrompidos = [];
  var saldosPorInstrutor = {};
  for (var j = 1; j < horas.length; j++) {
    if (String(horas[j][1] || '').trim().toUpperCase() !== 'SALDO INICIAL') continue;
    var dono = String(horas[j][0] || '').trim();
    var chaveDono = dono.toUpperCase();
    saldosPorInstrutor[chaveDono] = (saldosPorInstrutor[chaveDono] || 0) + 1;

    var atual = horas[j][2];
    var leitura = saldoOriginalDeDataInva_(atual);
    if (leitura) {
      corrompidos.push(
        'linha ' + (j + 1) + ': "' + dono + '" tem ' + atual + ' e deveria ser ' + leitura.valor +
        (leitura.ambiguo
          ? '  <-- AMBIGUO: pode ser ' + leitura.valor + ' ou ' + leitura.alternativa +
            '. O reparo NAO vai mexer nesta linha, corrija a mao.'
          : '')
      );
    }
  }

  var multiplos = [];
  for (var k in saldosPorInstrutor) {
    if (saldosPorInstrutor[k] > 1) {
      multiplos.push(k + ': ' + saldosPorInstrutor[k] + ' linhas de SALDO INICIAL');
    }
  }

  Logger.log('=== INSTRUTORES DUPLICADOS (' + duplicados.length + ') ===');
  Logger.log(duplicados.length ? duplicados.join('\n') : 'nenhum');
  Logger.log('=== SALDOS QUE VIRARAM DATA (' + corrompidos.length + ') ===');
  Logger.log(corrompidos.length ? corrompidos.join('\n') : 'nenhum');
  Logger.log('=== INSTRUTORES COM MAIS DE UM SALDO INICIAL (' + multiplos.length + ') ===');
  Logger.log(multiplos.length ? multiplos.join('\n') : 'nenhum');

  return {
    duplicados: duplicados,
    saldosCorrompidos: corrompidos,
    saldosDuplicados: multiplos
  };
}

/**
 * Aplica as correções. Rode inspecionarDadosInva() antes e confira o log.
 * Remove sempre a ocorrência REPETIDA, mantendo a primeira.
 */
function repararDadosInva() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var instSheet = ss.getSheetByName('Instrutores');
  var hoursSheet = ss.getSheetByName('Horas');
  var relatorio = [];

  // 1. Saldo que virou data volta a ser número, com o formato antes do valor
  var horas = hoursSheet.getDataRange().getValues();
  for (var j = 1; j < horas.length; j++) {
    if (String(horas[j][1] || '').trim().toUpperCase() !== 'SALDO INICIAL') continue;
    var leitura = saldoOriginalDeDataInva_(horas[j][2]);
    if (!leitura) continue;
    if (leitura.ambiguo) {
      relatorio.push('linha ' + (j + 1) + ' (' + horas[j][0] + ') NAO corrigida: ' + horas[j][2] +
        ' pode ser ' + leitura.valor + ' ou ' + leitura.alternativa + '. Corrija a mao.');
      continue;
    }
    var celula = hoursSheet.getRange(j + 1, 3);
    celula.setNumberFormat('0.0');
    celula.setValue(leitura.valor);
    relatorio.push('saldo da linha ' + (j + 1) + ' (' + horas[j][0] + '): ' + horas[j][2] + ' -> ' + leitura.valor);
  }

  // 2. SALDO INICIAL repetido para o mesmo instrutor: mantém o primeiro.
  //    De baixo para cima, senão apagar uma linha desloca as de baixo.
  horas = hoursSheet.getDataRange().getValues();
  var jaTemSaldo = {};
  var linhasParaApagar = [];
  for (var m = 1; m < horas.length; m++) {
    if (String(horas[m][1] || '').trim().toUpperCase() !== 'SALDO INICIAL') continue;
    var donoChave = String(horas[m][0] || '').trim().toUpperCase();
    if (jaTemSaldo[donoChave]) {
      linhasParaApagar.push(m + 1);
      relatorio.push('linha ' + (m + 1) + ' de Horas: SALDO INICIAL repetido de "' + horas[m][0] + '" removido');
    } else {
      jaTemSaldo[donoChave] = true;
    }
  }
  for (var n = linhasParaApagar.length - 1; n >= 0; n--) {
    hoursSheet.deleteRow(linhasParaApagar[n]);
  }

  // 3. Instrutor duplicado: mantém o primeiro
  var instrutores = instSheet.getDataRange().getValues();
  var vistos = {};
  var linhasInst = [];
  for (var i = 1; i < instrutores.length; i++) {
    var nome = String(instrutores[i][0] || '').trim();
    if (!nome) continue;
    var chave = nome.toUpperCase();
    if (vistos[chave]) {
      linhasInst.push(i + 1);
      relatorio.push('linha ' + (i + 1) + ' de Instrutores: "' + nome + '" duplicado removido');
    } else {
      vistos[chave] = true;
    }
  }
  for (var p = linhasInst.length - 1; p >= 0; p--) {
    instSheet.deleteRow(linhasInst[p]);
  }

  Logger.log('=== FAXINA CONCLUIDA (' + relatorio.length + ' alteracoes) ===');
  Logger.log(relatorio.length ? relatorio.join('\n') : 'nada a corrigir');
  return relatorio;
}

// ============================================================
// MANUTENCAO (2026-08-03) - rodar manutencao sem clique no editor.
//
// ⚠️ `clasp run` nao funciona neste projeto (nao esta publicado como
// "API executable"), entao instalar gatilho, gravar propriedade de
// script ou rodar migracao exigia abrir o editor e clicar em Run. Esta
// rota tira isso da frente: recebe o nome de uma funcao de manutencao,
// confere um token forte e executa.
//
// Mesmo desenho do Manutencao.gs do Hub, e as mesmas travas:
//   - lista FECHADA de funcoes;
//   - token so em Propriedade do script, nunca no codigo;
//   - sem token configurado, tudo e recusado (a mesma regra do
//     verificarSenhaOprInva_: backend anonimo nao pode ficar aberto
//     por esquecimento);
//   - o token vai no CORPO do POST, nunca na query string, para nao
//     cair em log de servidor nem no historico do terminal.
// ============================================================

var MANUTENCAO_PROP_TOKEN_INVA = 'MANUTENCAO_TOKEN';
var MANUTENCAO_MIN_TOKEN_INVA = 32;

var MANUTENCAO_FUNCOES_INVA = {
  // Gatilhos
  instalarAtualizacaoDiariaInva: 'Instala o gatilho diario das 05h (idempotente).',
  listarGatilhosInva:            'Lista os gatilhos do projeto.',
  removerGatilhosInva:           'Remove os gatilhos da sincronia.',

  // Etiquetas
  // ⚠️ Este era o passo humano pendente: cria a aba, semeia as 8
  // etiquetas e converte o Tipo de cada instrutor em clt/eventual.
  instalarEtiquetasInva: 'Cria a aba Etiquetas, semeia e migra o Tipo. Idempotente.',

  // Sincronia com o CAVOK
  simularReconciliacaoInva: 'Ensaio da reconciliacao: relata e NAO grava nada.',
  reconciliarVoosInva:      'Reconcilia a janela contra o CAVOK. GRAVA.',

  // Faxina e diagnostico
  inspecionarDadosInva:    'So le: acha SALDO INICIAL que virou data.',
  repararDadosInva:        'Desfaz o estrago do saldo virado data. GRAVA.',
  preencherBasePadraoInva: 'Carimba SJK em quem esta sem base.',
  diagnosticoHorasInva:    'Separa saldo inicial de linhas de voo, por instrutor.',
  limparVoosAteInva:       'Apaga linhas de voo ate a data. Args: ["aaaa-mm-dd", true]. Sem o true e ensaio.',

  // Fechamento de Horas / Instrutores
  handleGetHorasCategoriaInva: 'SO LEITURA. Horas do mes por instrutor em VFR/IFR/Simulador. Args: [ano, mes].',
  invaDefinirApelidoCavok: 'GRAVA. Apelido(s) que o CAVOK usa pro instrutor. Args: ["Nome Cadastro", "apelido1, apelido2"].',
};

function manutencaoTokenInva_() {
  return PropertiesService.getScriptProperties().getProperty(MANUTENCAO_PROP_TOKEN_INVA) || '';
}

function manutencaoTokensIguaisInva_(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;
  var dif = 0;
  for (var i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

function manutencaoMascararInva_(valor) {
  var s = String(valor == null ? '' : valor);
  if (!s) return '(vazio)';
  return s.slice(0, 3) + '…' + s.slice(-2) + ' (' + s.length + ' caracteres)';
}

function manutencaoAvisarInva_(assunto, corpo) {
  try {
    var para = Session.getEffectiveUser().getEmail();
    if (!para) return;
    MailApp.sendEmail({
      to: para,
      subject: '[Horas INVA] Manutencao: ' + assunto,
      body: corpo + '\n\nSe nao foi voce, rotacione o token agora.',
      name: 'Horas Voadas INVA',
    });
  } catch (e) {
    // Aviso e rede de seguranca, nao pode derrubar a operacao.
  }
}

function manutencaoSerializarInva_(v) {
  try {
    return JSON.parse(JSON.stringify(v === undefined ? null : v));
  } catch (e) {
    return String(v);
  }
}

function handleManutencaoInva(data) {
  data = data || {};
  var enviado = String(data.chave || '');
  var gravado = manutencaoTokenInva_();
  var op = String(data.op || 'chamar');

  if (op === 'bootstrap') {
    if (gravado) throw new Error('O token da manutencao ja existe. Use "rotacionar-token".');
    if (enviado.length < MANUTENCAO_MIN_TOKEN_INVA) {
      throw new Error('O token precisa de ao menos ' + MANUTENCAO_MIN_TOKEN_INVA + ' caracteres.');
    }
    PropertiesService.getScriptProperties().setProperty(MANUTENCAO_PROP_TOKEN_INVA, enviado);
    manutencaoAvisarInva_('token criado', 'A rota de manutencao foi ativada e ganhou o primeiro token.');
    return createJsonResponse({ status: 'success', data: { bootstrap: true } });
  }

  if (!gravado) throw new Error('Manutencao desativada: nao ha token configurado neste projeto.');
  if (!manutencaoTokensIguaisInva_(enviado, gravado)) {
    console.warn('Manutencao INVA: token recusado.');
    throw new Error('Token de manutencao invalido.');
  }

  var props = PropertiesService.getScriptProperties();

  if (op === 'catalogo') {
    var lista = [];
    for (var nomeFn in MANUTENCAO_FUNCOES_INVA) {
      if (!MANUTENCAO_FUNCOES_INVA.hasOwnProperty(nomeFn)) continue;
      lista.push({
        funcao: nomeFn,
        descricao: MANUTENCAO_FUNCOES_INVA[nomeFn],
        existe: typeof globalThis[nomeFn] === 'function',
      });
    }
    return createJsonResponse({ status: 'success', data: { funcoes: lista } });
  }

  if (op === 'propriedades') {
    var todas = props.getProperties();
    var revelar = String(data.revelar || '');
    var fora = {};
    for (var k in todas) {
      if (!todas.hasOwnProperty(k)) continue;
      fora[k] = k === revelar ? todas[k] : manutencaoMascararInva_(todas[k]);
    }
    return createJsonResponse({ status: 'success', data: { propriedades: fora } });
  }

  if (op === 'definir-propriedade') {
    // ⚠️ A propriedade alvo vem em `propriedade`, nao em `chave`:
    // `chave` ja e o token da rota, e reusar o campo trocaria o token
    // por um valor qualquer na primeira distracao.
    var alvoProp = String(data.propriedade || '').trim();
    if (!alvoProp) throw new Error('Informe a propriedade em "propriedade".');
    if (alvoProp === MANUTENCAO_PROP_TOKEN_INVA) {
      throw new Error('Use a operacao "rotacionar-token" para trocar o token.');
    }
    var valor = data.valor;
    if (valor === null || valor === undefined || valor === '') {
      props.deleteProperty(alvoProp);
      manutencaoAvisarInva_('propriedade apagada', 'Chave: ' + alvoProp);
      return createJsonResponse({ status: 'success', data: { chave: alvoProp, acao: 'apagada' } });
    }
    var tinha = props.getProperty(alvoProp) !== null;
    props.setProperty(alvoProp, String(valor));
    manutencaoAvisarInva_('propriedade gravada',
      'Chave: ' + alvoProp + '\nValor: ' + manutencaoMascararInva_(valor));
    return createJsonResponse({
      status: 'success',
      data: { chave: alvoProp, acao: tinha ? 'atualizada' : 'criada' },
    });
  }

  if (op === 'gatilhos') {
    var gs = ScriptApp.getProjectTriggers().map(function (t) {
      return { funcao: t.getHandlerFunction(), tipo: String(t.getEventType()), id: t.getUniqueId() };
    });
    return createJsonResponse({ status: 'success', data: gs });
  }

  if (op === 'rotacionar-token') {
    var novo = String(data.novoToken || '');
    if (novo.length < MANUTENCAO_MIN_TOKEN_INVA) {
      throw new Error('O token novo precisa de ao menos ' + MANUTENCAO_MIN_TOKEN_INVA + ' caracteres.');
    }
    props.setProperty(MANUTENCAO_PROP_TOKEN_INVA, novo);
    manutencaoAvisarInva_('token rotacionado', 'O token da rota de manutencao foi trocado.');
    return createJsonResponse({ status: 'success', data: { ok: true } });
  }

  if (op !== 'chamar') throw new Error('Operacao de manutencao desconhecida: ' + op);

  var nome = String(data.funcao || '');
  if (!MANUTENCAO_FUNCOES_INVA.hasOwnProperty(nome)) {
    throw new Error('Funcao fora da lista de manutencao: "' + nome + '". ' +
      'Para liberar, acrescente em MANUTENCAO_FUNCOES_INVA.');
  }
  var fn = globalThis[nome];
  if (typeof fn !== 'function') {
    throw new Error('A funcao "' + nome + '" esta na lista mas nao existe no projeto.');
  }

  var args = Array.isArray(data.args) ? data.args : [];
  var inicio = Date.now();
  var retorno = fn.apply(null, args);

  return createJsonResponse({
    status: 'success',
    data: {
      funcao: nome,
      args: args,
      duracaoMs: Date.now() - inicio,
      // ⚠️ Serializa aqui dentro. Funcao de manutencao pode devolver
      // objeto do Apps Script (Sheet, Trigger) que o JSON.stringify do
      // roteador nao daria conta, e a resposta viraria erro opaco
      // DEPOIS de a funcao ja ter rodado e mudado estado.
      retorno: manutencaoSerializarInva_(retorno),
    },
  });
}
