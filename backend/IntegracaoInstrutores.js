// API v1 da pagina Instrutores. Credencial somente no backend da VPS.
// Colunas acrescentadas no fim, sem deslocar as colunas legadas.
var INVA_API_HEADERS = ['ID_INTEGRACAO', 'NOMES_ANTERIORES', 'ULTIMA_REQ_INTEGRACAO'];
var INVA_API_HUB_URL = 'https://script.google.com/macros/s/AKfycbxpOGXgEJ5qBl46iy0JIoli9Ugl8O5-cS-iSxeeLEjsnnB0Pl50fGxSV3H2_DVNie6FsQ/exec';

function invaApiErro_(codigo, mensagem) {
  var erro = new Error(mensagem);
  erro.codigo = codigo;
  throw erro;
}

function invaApiHash_(valor) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(valor), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

function invaApiAutenticar_(chave) {
  var esperado = PropertiesService.getScriptProperties().getProperty('INVA_PARCEIRO_SHA256') || '';
  if (!/^[a-f0-9]{64}$/.test(esperado) || typeof chave !== 'string' || chave.length < 32 || chave.length > 256) {
    invaApiErro_('NAO_AUTORIZADO', 'Credencial da integracao invalida ou desativada.');
  }
  var recebido = invaApiHash_(chave);
  var diferenca = 0;
  for (var i = 0; i < esperado.length; i++) diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  if (diferenca) invaApiErro_('NAO_AUTORIZADO', 'Credencial da integracao invalida ou desativada.');
}

// Rotas legadas de escrita exigem uma sessao real do Hub. Chave do parceiro
// nao substitui o token. Falha de rede ou resposta desconhecida fecha o acesso.
function invaApiExigirHub_(token, acao) {
  if (typeof token !== 'string' || !token || token.length > 256) throw new Error('Sessao expirada. Entre novamente.');
  var resposta = UrlFetchApp.fetch(INVA_API_HUB_URL, {
    method: 'post', contentType: 'text/plain', followRedirects: true, muteHttpExceptions: true,
    payload: JSON.stringify({ action: 'autorizar-inva', token: token, dados: { acao: acao } })
  });
  var corpo;
  try { corpo = JSON.parse(resposta.getContentText()); } catch (e) { throw new Error('Nao foi possivel validar a sessao do Hub.'); }
  if (resposta.getResponseCode() !== 200 || !corpo.ok || !corpo.data || corpo.data.autorizado !== true) {
    throw new Error(corpo.error || 'Acesso nao autorizado pelo Hub.');
  }
}

function invaApiColunas_(aba, criar) {
  var largura = Math.max(aba.getLastColumn(), 1);
  var mapa = {};
  aba.getRange(1, 1, 1, largura).getValues()[0].forEach(function (nome, i) {
    mapa[normalizarHeaderInva_(nome)] = i + 1;
  });
  if (criar) INVA_API_HEADERS.forEach(function (nome) {
    if (mapa[nome]) return;
    largura++;
    if (largura > aba.getMaxColumns()) aba.insertColumnsAfter(aba.getMaxColumns(), 1);
    aba.getRange(1, largura).setValue(nome);
    mapa[nome] = largura;
  });
  return mapa;
}

function invaApiAnteriores_(row, colunas) {
  var texto = colunas.NOMES_ANTERIORES ? row[colunas.NOMES_ANTERIORES - 1] : '';
  if (!texto) return [];
  var nomes = JSON.parse(String(texto));
  if (!Array.isArray(nomes) || nomes.some(function (n) { return typeof n !== 'string'; })) throw new Error('Historico de nomes invalido.');
  return nomes;
}

function invaApiIdentificarLinha_(aba, linha) {
  var cols = invaApiColunas_(aba, true);
  var celula = aba.getRange(linha, cols.ID_INTEGRACAO);
  if (!celula.getValue()) celula.setNumberFormat('@').setValue(Utilities.getUuid());
  return String(celula.getValue());
}

function instalarIntegracaoInstrutores() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var total = 0;
    [ss.getSheetByName('Instrutores'), abaInstrutoresSoloInva_(ss, false)].forEach(function (aba) {
      if (!aba) return;
      invaApiColunas_(aba, true);
      var rows = aba.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) if (rows[i][0]) { invaApiIdentificarLinha_(aba, i + 1); total++; }
    });
    SpreadsheetApp.flush();
    return { instrutores: total };
  } finally { lock.releaseLock(); }
}

// Somente manutencao autenticada. Remove no maximo dois registros descartaveis
// da verificacao de ativacao, nunca um cadastro operacional.
function limparTesteIntegracaoInstrutores(ids) {
  if (!Array.isArray(ids) || ids.length > 2 || !ids.length || new Set(ids).size !== ids.length) {
    throw new Error('Informe um ou dois IDs distintos de teste.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var lista = invaApiListar_().instrutores;
    var alvos = ids.map(function (id) {
      var item = lista.find(function (inst) { return inst.id === id; });
      if (!item || !/^TESTE API INSTRUTORES /.test(item.nome) ||
          item.nomesAnteriores.some(function (n) { return !/^TESTE API INSTRUTORES /.test(n); }) ||
          item.etiquetas.length || item.comentarios.length || Number(item.totalHoras || 0) ||
          item.liberadoOpr || item.inativo) throw new Error('Cadastro nao e um teste descartavel da API.');
      return invaApiBuscarId_(ss, id);
    }).sort(function (a, b) { return b.linha - a.linha; });
    var log = invaApiLogAba_(ss, true);
    alvos.forEach(function (alvo) {
      var id = String(alvo.row[alvo.cols.ID_INTEGRACAO - 1]);
      alvo.aba.deleteRow(alvo.linha);
      log.getRange(log.getLastRow() + 1, 1, 1, 9).setNumberFormat('@').setValues([[
        'limpeza_' + Utilities.getUuid(), '', id, alvo.modalidade, 'limpar_teste',
        JSON.stringify({ nome: alvo.row[0] }), 'null', 'manutencao-autenticada', new Date().toISOString()
      ]]);
    });
    SpreadsheetApp.flush();
    return { removidos: ids.length };
  } finally { lock.releaseLock(); }
}

// Nomes antigos continuam reservados para a mesma pessoa. Leituras nao gravam.
function invaApiMapaNomes_(ss, modalidade, cavok) {
  var aba = modalidade === 'voo' ? ss.getSheetByName('Instrutores') : abaInstrutoresSoloInva_(ss, false);
  var mapa = {};
  if (!aba) return mapa;
  var cols = invaApiColunas_(aba, false);
  aba.getDataRange().getValues().slice(1).forEach(function (row) {
    var atual = String(row[0] || '').trim();
    if (!atual) return;
    var nomes = [atual].concat(invaApiAnteriores_(row, cols));
    if (cavok && cols.APELIDOS_CAVOK) nomes = nomes.concat(String(row[cols.APELIDOS_CAVOK - 1] || '').split(','));
    nomes.forEach(function (nome) {
      var chave = invaChaveTexto_(nome);
      if (!chave) return;
      if (mapa[chave] && mapa[chave] !== atual) throw new Error('Conflito de nomes no cadastro de instrutores.');
      mapa[chave] = atual;
    });
  });
  return mapa;
}

function invaApiMetaLinha_(row, cols) {
  return {
    id: cols.ID_INTEGRACAO ? String(row[cols.ID_INTEGRACAO - 1] || '') : '',
    nomesAnteriores: invaApiAnteriores_(row, cols),
    versao: invaApiHash_(JSON.stringify(row))
  };
}

function invaApiListar_() {
  var corpo = JSON.parse(handleGetData().getContent());
  if (corpo.status !== 'success') throw new Error(corpo.message || 'Falha ao consultar instrutores.');
  var instrutores = corpo.data.map(function (inst) {
    return Object.assign({}, inst, { modalidade: 'voo', flagVerde: Number(inst.totalHoras) >= corpo.meta.metaHoras || inst.liberadoOpr === true });
  }).concat(corpo.dataSolo.map(function (inst) { return Object.assign({}, inst, { modalidade: 'solo' }); }));
  if (instrutores.some(function (inst) { return !inst.id; })) invaApiErro_('INSTALACAO_PENDENTE', 'Execute instalarIntegracaoInstrutores antes de liberar a API.');
  return { instrutores: instrutores, meta: Object.assign({}, corpo.meta, {
    acessoCompleto: PropertiesService.getScriptProperties().getProperty('INVA_PARCEIRO_ACESSO_COMPLETO') === 'true',
    diretrizEventuais: [
      { curso: 'Curso de Piloto Privado', fases: { 'Pre-Solo': ['PS01', 'PS02', 'PS03', 'PS07', 'PS08', 'PS13'], Aperfeicoamento: ['AP01', 'AP02', 'AP03', 'AP05'], Noturno: ['NOT01'], Navegacao: ['NAV01', 'NAV03', 'NAV04', 'NAV05'] } },
      { curso: 'Curso de Piloto Comercial', fases: { Adaptacao: ['AD01'], Aperfeicoamento: ['AP01'], Navegacao: ['Todas as NAVs, exceto NAV X1 e NAV X2'], Noturno: ['NOT01'] } },
      { curso: 'Curso de Instrutor de Voo', missoes: [] },
      { curso: 'Curso de Formacao de Instrutor - CFI', missoes: [] },
      { curso: 'Aperfeicoamento Continuo', missoes: ['Todas, exceto missoes de avaliacao'] },
      { curso: 'Voos Administrativos', missoes: ['Voo de Incentivo'] }
    ]
  }) };
}

function invaApiCampos_(obj, permitidos) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) invaApiErro_('DADOS_INVALIDOS', 'Informe um objeto JSON.');
  Object.keys(obj).forEach(function (campo) {
    if (permitidos.indexOf(campo) < 0) invaApiErro_('CAMPO_PROIBIDO', 'Campo nao permitido: ' + campo);
  });
}

function invaApiNome_(nome) {
  if (typeof nome !== 'string') invaApiErro_('DADOS_INVALIDOS', 'Informe o nome do instrutor.');
  nome = nome.trim().replace(/\s+/g, ' ');
  if (!nome || nome.length > 120 || /[\x00-\x1f,]/.test(nome) || /^[=+@-]/.test(nome)) {
    invaApiErro_('DADOS_INVALIDOS', 'Nome invalido. Use ate 120 caracteres, sem virgulas ou formulas.');
  }
  return nome;
}

function invaApiLogAba_(ss, criar) {
  var aba = ss.getSheetByName('INTEGRACAO_INSTRUTORES_LOG');
  if (!aba && criar) {
    aba = ss.insertSheet('INTEGRACAO_INSTRUTORES_LOG');
    aba.appendRow(['REQUEST_ID', 'HASH', 'INSTRUTOR_ID', 'MODALIDADE', 'OPERACAO', 'ANTES', 'DEPOIS', 'AUTOR', 'DATA']);
  }
  return aba;
}

function invaApiBuscarId_(ss, id) {
  var encontrados = [];
  ['voo', 'solo'].forEach(function (modalidade) {
    var aba = modalidade === 'voo' ? ss.getSheetByName('Instrutores') : abaInstrutoresSoloInva_(ss, false);
    if (!aba) return;
    var cols = invaApiColunas_(aba, false);
    if (!cols.ID_INTEGRACAO) return;
    aba.getDataRange().getValues().slice(1).forEach(function (row, i) {
      if (String(row[cols.ID_INTEGRACAO - 1] || '') === id) encontrados.push({ aba: aba, cols: cols, row: row, linha: i + 2, modalidade: modalidade });
    });
  });
  if (encontrados.length !== 1) invaApiErro_('NAO_ENCONTRADO', 'ID inexistente ou duplicado.');
  return encontrados[0];
}

function invaApiRepeticao_(ss, requestId, hash) {
  var requests = ss.getSheetByName('INTEGRACAO_INSTRUTORES_REQUESTS');
  if (requests && requests.getDataRange().getValues().slice(1).some(function (r) { return r[0] === requestId; })) {
    invaApiErro_('REQUEST_ID_REUTILIZADO', 'Use um novo requestId para uma operacao diferente.');
  }
  var log = invaApiLogAba_(ss, false);
  var registro = log ? log.getDataRange().getValues().slice(1).find(function (r) { return r[0] === requestId; }) : null;
  if (registro) {
    if (registro[1] !== hash) invaApiErro_('REQUEST_ID_REUTILIZADO', 'Use um novo requestId para uma operacao diferente.');
    return String(registro[2]);
  }
  // A linha principal e gravada antes do log. Se a resposta ou o log falhar,
  // o comprovante na propria linha evita repetir a criacao ou a edicao.
  var id = '';
  ['voo', 'solo'].forEach(function (modalidade) {
    var aba = modalidade === 'voo' ? ss.getSheetByName('Instrutores') : abaInstrutoresSoloInva_(ss, false);
    if (!aba) return;
    var cols = invaApiColunas_(aba, false);
    if (!cols.ULTIMA_REQ_INTEGRACAO) return;
    aba.getDataRange().getValues().slice(1).forEach(function (row) {
      var raw = row[cols.ULTIMA_REQ_INTEGRACAO - 1];
      if (!raw) return;
      var req = JSON.parse(String(raw));
      if (req.id !== requestId) return;
      if (req.hash !== hash) invaApiErro_('REQUEST_ID_REUTILIZADO', 'Use um novo requestId para uma operacao diferente.');
      id = String(row[cols.ID_INTEGRACAO - 1]);
      if (Array.isArray(req.auditoria)) {
        var logRecuperado = invaApiLogAba_(ss, true);
        logRecuperado.getRange(logRecuperado.getLastRow() + 1, 1, 1, 9).setNumberFormat('@').setValues([req.auditoria]);
      }
    });
  });
  return id;
}

// Lista fechada das mesmas acoes oferecidas pela pagina. Nunca resolve uma
// funcao pelo nome recebido e nunca disponibiliza manutencao ou outros modulos.
function invaApiAcoesCompletas_() {
  return {
    add_instructor: [handleAddInstructor, ['nome', 'base', 'etiquetas', 'saldoInicial']],
    add_instructor_solo: [handleAddInstructorSolo, ['nome', 'base', 'etiquetas']],
    set_instructor_base: [handleSetInstructorBase, ['instrutorId', 'nome', 'base']],
    set_instructor_base_solo: [handleSetInstructorBaseSolo, ['instrutorId', 'nome', 'base']],
    set_instructor_order: [handleSetInstructorOrder, ['base', 'nomes']],
    set_instructor_order_solo: [handleSetInstructorOrderSolo, ['base', 'nomes']],
    set_instructor_release: [handleSetInstructorRelease, ['instrutorId', 'nome', 'liberado', 'senha']],
    set_instructor_active: [handleSetInstructorActive, ['instrutorId', 'nome', 'inativo', 'motivo']],
    set_instructor_active_solo: [handleSetInstructorActiveSolo, ['instrutorId', 'nome', 'inativo', 'motivo']],
    save_label: [handleSaveLabel, ['id', 'nome', 'cor']],
    save_label_solo: [handleSaveLabelSolo, ['id', 'nome', 'cor']],
    delete_label: [handleDeleteLabel, ['id']],
    delete_label_solo: [handleDeleteLabelSolo, ['id']],
    set_instructor_labels: [handleSetInstructorLabels, ['instrutorId', 'nome', 'etiquetas']],
    set_instructor_labels_solo: [handleSetInstructorLabelsSolo, ['instrutorId', 'nome', 'etiquetas']],
    add_comment: [handleAddComment, ['instrutorId', 'nome', 'texto']],
    add_comment_solo: [handleAddCommentSolo, ['instrutorId', 'nome', 'texto']],
    delete_comment: [handleDeleteComment, ['id']],
    delete_comment_solo: [handleDeleteCommentSolo, ['id']],
    sync_cavok: [function () { return reconciliarVoosInva(); }, []]
  };
}

function invaApiCanonico_(valor) {
  if (Array.isArray(valor)) return valor.map(invaApiCanonico_);
  if (valor && typeof valor === 'object') {
    var ordenado = {};
    Object.keys(valor).sort().forEach(function (k) { ordenado[k] = invaApiCanonico_(valor[k]); });
    return ordenado;
  }
  return valor;
}

function invaApiExecutar_(p) {
  if (PropertiesService.getScriptProperties().getProperty('INVA_PARCEIRO_ACESSO_COMPLETO') !== 'true') {
    invaApiErro_('OPERACAO_PROIBIDA', 'Acesso completo de Instrutores nao habilitado.');
  }
  var acoes = invaApiAcoesCompletas_();
  if (!Object.prototype.hasOwnProperty.call(acoes, p.acao)) invaApiErro_('OPERACAO_PROIBIDA', 'Acao fora da pagina Instrutores.');
  var config = acoes[p.acao];
  invaApiCampos_(p.dados, config[1]);
  if (typeof p.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(p.requestId)) invaApiErro_('DADOS_INVALIDOS', 'Informe requestId unico, de 8 a 120 caracteres.');
  var hash = invaApiHash_(JSON.stringify(invaApiCanonico_([p.acao, p.dados, p.autor || ''])));
  var dados = Object.assign({}, p.dados, { autor: p.autor || 'Parceiro VPS' });
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (dados.instrutorId !== undefined) {
    var alvo = invaApiBuscarId_(ss, String(dados.instrutorId));
    var modalidade = /_solo$/.test(p.acao) ? 'solo' : 'voo';
    if (alvo.modalidade !== modalidade || (dados.nome !== undefined && dados.nome !== alvo.row[0])) {
      invaApiErro_('DADOS_INVALIDOS', 'ID, nome ou modalidade divergentes.');
    }
    dados.nome = String(alvo.row[0]);
    delete dados.instrutorId;
  }
  if (config[1].indexOf('base') >= 0 && !normalizarBaseInva_(dados.base)) invaApiErro_('DADOS_INVALIDOS', 'Informe base SJK ou CPQ.');
  if (config[1].indexOf('nome') >= 0 && dados.nome === undefined) invaApiErro_('DADOS_INVALIDOS', 'Informe nome ou instrutorId.');
  if (dados.nome !== undefined) dados.nome = invaApiNome_(dados.nome);
  ['inativo', 'liberado'].forEach(function (k) {
    if (config[1].indexOf(k) >= 0 && typeof dados[k] !== 'boolean') invaApiErro_('DADOS_INVALIDOS', 'Informe ' + k + ' como booleano.');
  });
  if (/^set_instructor_labels/.test(p.acao) && !Array.isArray(dados.etiquetas)) invaApiErro_('DADOS_INVALIDOS', 'Informe etiquetas como lista de IDs.');
  if (dados.etiquetas !== undefined && (!Array.isArray(dados.etiquetas) || dados.etiquetas.some(function (id) { return typeof id !== 'string'; }))) {
    invaApiErro_('DADOS_INVALIDOS', 'etiquetas deve ser uma lista de IDs.');
  }
  if (config[1].indexOf('nomes') >= 0 && (!Array.isArray(dados.nomes) || !dados.nomes.length || new Set(dados.nomes).size !== dados.nomes.length || dados.nomes.some(function (n) { return typeof n !== 'string'; }))) {
    invaApiErro_('DADOS_INVALIDOS', 'Informe nomes distintos para ordenar.');
  }
  if (dados.saldoInicial !== undefined && (typeof dados.saldoInicial !== 'number' || !isFinite(dados.saldoInicial) || dados.saldoInicial < 0)) {
    invaApiErro_('DADOS_INVALIDOS', 'Saldo inicial deve ser um numero nao negativo.');
  }

  // Reserva antes de chamar os handlers, que possuem suas proprias travas.
  // Se houver interrupcao depois da escrita, o retry nunca repete a mutacao.
  var lock = LockService.getScriptLock();
  var linha;
  var requests;
  lock.waitLock(30000);
  try {
    requests = ss.getSheetByName('INTEGRACAO_INSTRUTORES_REQUESTS');
    if (requests) {
      var rows = requests.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][0] !== p.requestId) continue;
        if (rows[i][1] !== hash) invaApiErro_('REQUEST_ID_REUTILIZADO', 'Use novo requestId para outra operacao.');
        if (!rows[i][3]) invaApiErro_('RESULTADO_INDETERMINADO', 'Operacao em andamento ou interrompida. Consulte os dados antes de tentar outra vez.');
        var repetida = JSON.parse(String(rows[i][3]));
        repetida.repetida = true;
        return repetida;
      }
    }
    if (invaApiRepeticao_(ss, p.requestId, hash)) invaApiErro_('REQUEST_ID_REUTILIZADO', 'Use novo requestId para outra operacao.');
    if (!requests) {
      requests = ss.insertSheet('INTEGRACAO_INSTRUTORES_REQUESTS');
      requests.appendRow(['REQUEST_ID', 'HASH', 'ACAO', 'RESPOSTA', 'AUTOR', 'DATA']);
    }
    linha = requests.getLastRow() + 1;
    requests.getRange(linha, 1, 1, 6).setNumberFormat('@').setValues([[
      p.requestId, hash, p.acao, '', dados.autor, new Date().toISOString()
    ]]);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }

  var resposta = JSON.parse(config[0](dados).getContent());
  var resultado = { status: resposta.status, apiVersion: 1, repetida: false };
  if (resposta.status === 'success') resultado.data = resposta.data || resposta;
  else { resultado.code = 'REGRA_NEGOCIO'; resultado.message = resposta.message || 'Acao recusada.'; }
  var serializado = JSON.stringify(resultado);
  if (serializado.length > 45000) serializado = JSON.stringify({ status: resultado.status, apiVersion: 1, repetida: false, data: { consultarNovamente: true } });
  lock.waitLock(30000);
  try {
    requests.getRange(linha, 4).setNumberFormat('@').setValue(serializado);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  return resultado;
}

function invaApiGravar_(p) {
  var criar = p.operacao === 'cadastrar';
  invaApiCampos_(p.dados, criar ? ['modalidade', 'nome', 'base'] : ['id', 'nome', 'base', 'versao']);
  if (typeof p.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(p.requestId)) invaApiErro_('DADOS_INVALIDOS', 'Informe requestId unico, de 8 a 120 caracteres.');
  var nome = p.dados.nome === undefined && !criar ? null : invaApiNome_(p.dados.nome);
  var base = p.dados.base === undefined && !criar ? null : normalizarBaseInva_(p.dados.base);
  if (base === '') invaApiErro_('DADOS_INVALIDOS', 'Base permitida: SJK ou CPQ.');
  if (!criar && nome === null && base === null) invaApiErro_('DADOS_INVALIDOS', 'Informe nome ou base para editar.');
  var hash = invaApiHash_(JSON.stringify([p.operacao, p.dados.id || '', p.dados.modalidade || '', nome, base, p.dados.versao || '', p.autor || '']));
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var repetido = invaApiRepeticao_(ss, p.requestId, hash);
    if (repetido) return { id: repetido, repetida: true };
    // Recusa antes de gravar se a migracao dos IDs ainda nao terminou.
    invaApiListar_();
    var alvo;
    if (criar) {
      if (['voo', 'solo'].indexOf(p.dados.modalidade) < 0) invaApiErro_('DADOS_INVALIDOS', 'Modalidade permitida: voo ou solo.');
      var aba = p.dados.modalidade === 'voo' ? ss.getSheetByName('Instrutores') : abaInstrutoresSoloInva_(ss, true);
      if (!aba) throw new Error('Aba de instrutores ausente.');
      if (p.dados.modalidade === 'voo') mapaColunasInstrutores_(aba, true);
      var cols = invaApiColunas_(aba, true);
      alvo = { aba: aba, cols: cols, row: new Array(aba.getLastColumn()).fill(''), linha: aba.getLastRow() + 1, modalidade: p.dados.modalidade };
      alvo.row[cols.ID_INTEGRACAO - 1] = Utilities.getUuid();
    } else {
      if (typeof p.dados.id !== 'string' || !p.dados.id) invaApiErro_('DADOS_INVALIDOS', 'Informe o ID do instrutor.');
      alvo = invaApiBuscarId_(ss, p.dados.id);
      if (typeof p.dados.versao !== 'string' || p.dados.versao !== invaApiMetaLinha_(alvo.row, alvo.cols).versao) {
        invaApiErro_('CONFLITO', 'O cadastro mudou. Consulte novamente antes de editar.');
      }
      var comprovante = alvo.row[alvo.cols.ULTIMA_REQ_INTEGRACAO - 1];
      if (comprovante) {
        var anteriorReq = JSON.parse(String(comprovante));
        // Recupera eventual log pendente antes de substituir o comprovante.
        invaApiRepeticao_(ss, anteriorReq.id, anteriorReq.hash);
      }
    }
    var antes = criar ? null : { nome: alvo.row[0], base: alvo.row[alvo.cols.BASE - 1] || INVA_BASE_PADRAO };
    nome = nome === null ? String(alvo.row[0]) : nome;
    base = base === null ? normalizarBaseInva_(alvo.row[alvo.cols.BASE - 1]) || INVA_BASE_PADRAO : base;
    var mapa = invaApiMapaNomes_(ss, alvo.modalidade, alvo.modalidade === 'voo');
    var dono = mapa[invaChaveTexto_(nome)];
    if (dono && (criar || dono !== alvo.row[0])) invaApiErro_('NOME_DUPLICADO', 'Nome ja utilizado por um instrutor, inclusive inativo ou nome anterior.');
    var anteriores = invaApiAnteriores_(alvo.row, alvo.cols);
    if (!criar && alvo.row[0] !== nome && anteriores.indexOf(String(alvo.row[0])) < 0) anteriores.push(String(alvo.row[0]));
    if (criar || base !== antes.base) {
      var ordem = alvo.modalidade === 'voo'
        ? ultimaOrdemDaBaseInva_(alvo.aba, alvo.cols, base, criar ? 0 : alvo.linha)
        : ultimaOrdemDaBaseSoloInva_(alvo.aba, base, criar ? 0 : alvo.linha);
      alvo.row[alvo.cols.ORDEM_PRIORIDADE - 1] = ordem + 1;
    }
    alvo.row[0] = nome;
    alvo.row[alvo.cols.BASE - 1] = base;
    alvo.row[alvo.cols.NOMES_ANTERIORES - 1] = JSON.stringify(anteriores);
    var id = String(alvo.row[alvo.cols.ID_INTEGRACAO - 1]);
    var auditoria = [
      p.requestId, hash, id, alvo.modalidade, p.operacao, JSON.stringify(antes), JSON.stringify({ nome: nome, base: base }),
      JSON.stringify({ sistema: 'parceiro-vps', usuarioInformado: p.autor || '' }), new Date().toISOString()
    ];
    alvo.row[alvo.cols.ULTIMA_REQ_INTEGRACAO - 1] = JSON.stringify({ id: p.requestId, hash: hash, auditoria: auditoria });
    // Prepara o log antes da mutacao. Nunca inclui a credencial.
    var log = invaApiLogAba_(ss, true);
    alvo.aba.getRange(alvo.linha, 1, 1, alvo.row.length).setValues([alvo.row]);
    SpreadsheetApp.flush();
    log.getRange(log.getLastRow() + 1, 1, 1, 9).setNumberFormat('@').setValues([auditoria]);
    return { id: id, repetida: false };
  } finally { lock.releaseLock(); }
}

function handleIntegracaoInstrutores(p) {
  try {
    invaApiAutenticar_(p.chave);
    invaApiCampos_(p, ['action', 'chave', 'operacao', 'acao', 'dados', 'requestId', 'autor']);
    if (p.autor !== undefined && (typeof p.autor !== 'string' || p.autor.length > 200)) invaApiErro_('DADOS_INVALIDOS', 'Autor invalido.');
    if (p.operacao === 'executar') return createJsonResponse(invaApiExecutar_(p));
    if (p.acao !== undefined) invaApiErro_('CAMPO_PROIBIDO', 'acao somente e aceita em executar.');
    if (p.operacao === 'listar') {
      if (p.dados !== undefined) invaApiCampos_(p.dados, []);
      return createJsonResponse({ status: 'success', apiVersion: 1, data: invaApiListar_() });
    }
    if (['cadastrar', 'editar'].indexOf(p.operacao) < 0) invaApiErro_('OPERACAO_PROIBIDA', 'Operacoes permitidas: listar, cadastrar e editar.');
    var resultado = invaApiGravar_(p);
    var item = invaApiListar_().instrutores.find(function (inst) { return inst.id === resultado.id; });
    return createJsonResponse({ status: 'success', apiVersion: 1, data: { instrutor: item, repetida: resultado.repetida } });
  } catch (erro) {
    return createJsonResponse({ status: 'error', apiVersion: 1, code: erro.codigo || 'ERRO_INTERNO', message: erro.codigo ? erro.message : 'Nao foi possivel concluir. Repita com o mesmo requestId ou consulte os dados.' });
  }
}
