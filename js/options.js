$(document).ready(function() {
  $('#status').hide();
  chrome.storage.sync.get(function(s) {
    for (var key in s) {
      if (s.hasOwnProperty(key) && $('input#' + key).length) {
        console.log(s[key]);
        console.log(key);
        if ($('input#' + key).is(':checkbox')) {
          $('input#' + key).prop('checked', s[key]);
        } else {
         $('input#' + key).val(s[key]);
        }
      }
    }
  });
  $('input').change(function() {
    var updatedID = $(this).attr('id');
    var update = {};
    update[updatedID] = $(this).val();
    console.log(update);
    chrome.storage.sync.set(update, function() {
      $('#status').text($('label[for="' + updatedID + '"]').text() + ' updated...').show();
    });
  });
});