function kbeEncyptText(info) {
  var data = info.selectionText;
  var popup = window.open(chrome.extension.getURL('kbe.html'), '_blank');
  $(popup.document).ready(function() {
    setTimeout(function(){
      chrome.runtime.sendMessage({
        from: 'background',
        data: data,
      });
    }, 100);

  });
}

chrome.permissions.contains({
  permissions: ['contextMenus']
}, function(result) {
  if (result) {
    chrome.contextMenus.create({title: "Encrypt Selected Text", contexts:["selection"], onclick: kbeEncyptText});
  }
});
