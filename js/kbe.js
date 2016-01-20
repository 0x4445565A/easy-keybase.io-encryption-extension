$(document).ready(function() {
  $('ul.kb-auto-complete').on('click', 'li', function() {
    $('.keybase-account').val($(this).attr('val'));
    $('.kb-auto-complete').text('');
    $('ul.kb-auto-complete').hide();
  });
  $('.keybase-account').on('input', function() {
    $('ul.kb-auto-complete').show();
    $.ajax({
      url: "https://keybase.io/_/api/1.0/user/autocomplete.json",
      data: {
        q: $(this).val(),
      },
      success: function(result) {
        $('.kb-auto-complete').text('');
        for (var i in result.completions) {
          if (i > 4) {
            break;
          }
          var components = result.completions[i].components;
          var key_fingerprint = components.key_fingerprint.val.substr(-16).toUpperCase().replace(/(.{4})/g,"$1 ");
          console.log(key_fingerprint);
          var accountImage = result.completions[i].thumbnail != null ? result.completions[i].thumbnail : '/images/no_photo.png';
          appendString = '<li val="' + components.username.val + '"><img src="' + accountImage + '"><span class="account-name">' + components.username.val + '</span><span class="public-key-fingerprint">' + key_fingerprint + '</span></li>';
          $('.kb-auto-complete').append(appendString);
        }
      }
    });
  })
  $('button.encrypt-action').click(function() {
    var account_name = $('.keybase-account').val();
    var data = $('.to-encrypt').val();
    $('.status').html('Grabbing Key...');
    $.get("https://keybase.io/" + account_name + "/key.asc", function(account_pgp_key) {
      $('.status').html($('.status').html() + ' Key found!');
      encryptData(data, account_pgp_key);
    }).fail(function(error) {
      console.log(error);
      $('.error-text').text(account_name + ' does not have a public key...');
    });
  });
  $('button.copy').click(function() {
    console.log($('.result').text());
  });
});

function encryptData(data, account_pgp_key) {
  $('.status').html($('.status').html() + ' Importing key...');
  var account = false;
  kbpgp.KeyManager.import_from_armored_pgp({
    armored: account_pgp_key
  }, function(err, user) {
    if (!err) {
      $('.status').html($('.status').html() + ' Key Imported!');
      account = user;
    }
    else {
      console.log(err, user);
      $('.error-text').text('Oh no something bad happened... Please submit console log dump!');
    }
  });
  if (account) {
    $('.status').html($('.status').html() + ' Creating encrypted message...');
    var params = {
      msg:         data,
      encrypt_for: account,
    };
    kbpgp.box(params, function(err, result_armored, result_raw) {
      if (!err) {
        $('.status').html($('.status').html() + ' Done!');
        $('.result').text(result_armored);
        $('.result').show();
      }
      else {
        console.log(err, result_armored, result_raw);
        $('.error-text').text('Oh no something bad happened... Please submit console log dump!');
      }
    });
  }
}