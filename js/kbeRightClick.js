function kbeEncyptText(info) {
  var data = info.selectionText;
  window.open(chrome.extension.getURL('kbe.html') + "?m=" + encodeURIComponent(window.btoa(data)), '_blank')
}

chrome.permissions.contains({
  permissions: ['contextMenus']
}, function(result) {
  if (result) {
    chrome.contextMenus.create({title: "Encrypt Selected Text", contexts:["selection"], onclick: kbeEncyptText});
  }
});
