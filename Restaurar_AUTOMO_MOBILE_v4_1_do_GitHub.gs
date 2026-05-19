/**
 * Cole este arquivo sozinho no Apps Script e execute:
 *   restaurarAutomoMobileV41DoGitHub()
 *
 * Ele substitui o arquivo "Código" do projeto atual
 * pela versão mobile mais completa, com cards/alertas/cartão,
 * restaurada a partir do GitHub.
 *
 * Depois:
 * 1. Recarregue o editor
 * 2. Abra o Web App
 * 3. Se estiver certo, faça uma nova implantação
 */

function restaurarAutomoMobileV41DoGitHub() {
  var sourceUrl = 'https://raw.githubusercontent.com/diogolejardam-commits/fincontrol360/main/AUTOMO_MOBILE_v4_1_pro_favicon.gs';
  var codigo = UrlFetchApp.fetch(sourceUrl, { muteHttpExceptions: true }).getContentText();

  if (!codigo || codigo.indexOf('function doGet(e)') === -1 || codigo.indexOf('webCarregarDados') === -1) {
    throw new Error('Não consegui baixar a versão mobile completa do GitHub.');
  }

  var scriptId = ScriptApp.getScriptId();
  var token = ScriptApp.getOAuthToken();
  var apiUrl = 'https://script.googleapis.com/v1/projects/' + scriptId + '/content';

  var respGet = UrlFetchApp.fetch(apiUrl, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });

  if (respGet.getResponseCode() !== 200) {
    throw new Error('GET ' + respGet.getResponseCode() + ': ' + respGet.getContentText().substring(0, 300));
  }

  var projeto = JSON.parse(respGet.getContentText());
  var files = projeto.files || [];
  var idx = -1;

  for (var i = 0; i < files.length; i++) {
    if (files[i].name === 'Código' || files[i].name === 'Codigo') {
      idx = i;
      break;
    }
  }

  var novoArquivo = {
    name: 'Código',
    type: 'SERVER_JS',
    source: codigo
  };

  if (idx >= 0) {
    files[idx] = novoArquivo;
  } else {
    files.push(novoArquivo);
  }

  var respPut = UrlFetchApp.fetch(apiUrl, {
    method: 'put',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ files: files }),
    muteHttpExceptions: true
  });

  if (respPut.getResponseCode() !== 200) {
    throw new Error('PUT ' + respPut.getResponseCode() + ': ' + respPut.getContentText().substring(0, 500));
  }

  Logger.log('OK: Web App mobile restaurado do GitHub.');
  Logger.log('Recarregue o editor e teste o Web App.');
}
