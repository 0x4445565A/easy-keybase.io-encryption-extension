$(document).ready(function() {
    chrome.storage.sync.get([
      'enableSigning',
      'signUser',
    ], function(e) {
      if (e.enableSigning) {
        console.log('enabling signing...');
        $('.sign-option').prop('checked', true);
        $('.sign-ui').show();
        $('.sign-enable').hide();
      }
      $('.keybase-user').val(e.signUser);
    });
    $('.sign-option').change(function() {
      $('.keybase-passphrase').toggle(this.checked);
      $('.keybase-user').toggle(this.checked);
    });

  chrome.runtime.onMessage.addListener(function (msg, sender) {
    if ((msg.from === 'background')) {
      $('.to-encrypt').val(msg.data);
    }
  });

  $('.keybase-account').focus();
  /**
   * Set event listener on dynamic li items.
   */
  $('ul.kb-auto-complete').on('click', 'li', function() {
    // Set account name input to keybase.io username.
    $('.keybase-account').val($(this).attr('val'));

    // Clear autocomplete list items
    $('.kb-auto-complete').text('');

    // Hide empty autocomplete list
    $('ul.kb-auto-complete').hide();
  });

  /**
   * Take input changes and use it to create autocomplete list.
   */
  $('.keybase-account').on('input', function() {
    // Show autocomplete.
    $('ul.kb-auto-complete').show();
    var query = $(this).val();
    // Send Ajax get to the keybase.io API using the current input.
    $.ajax({
      url: "https://keybase.io/_/api/1.0/user/autocomplete.json",
      data: {
        q: query,
      },
      success: function(result) {
        // Clear out current list items.
        $('.kb-auto-complete').text('');

        // loop through all results
        for (var i in result.completions) {
          // Exit after 5 results otherwise it's a little much.
          if (i > 4) {
            break;
          }

          // Define quick use vars.
          var components = result.completions[i].components;
          var key_fingerprint = components.key_fingerprint.val.substr(-16).toUpperCase().replace(/(.{4})/g,"$1 ");
          var accountImage = result.completions[i].thumbnail != null ? result.completions[i].thumbnail : '/images/no_photo.png';
          var highestComponent = components.username;
          highestComponent.media = 'username';
          for (var i in components) {
            if (!highestComponent.hasOwnProperty('score')
                || (typeof components[i].hasOwnProperty('score') != 'undefined'
                    && components[i].score > highestComponent.score)) {
              highestComponent = components[i];
              highestComponent.media = i;
            }
          }
          var highestComponentSearch = highestComponent.val;
          var re = new RegExp(query, "i");
          highestComponentSearch = highestComponentSearch.replace(re, '<span class="search-highlight">' + query + '</span>');
          // Create HTML to be inserted into autocomplete list.
          switch (highestComponent.media) {
            case 'coinbase':
              var social_media_icon = 'btc';
              break;
            case 'full_name':
              var social_media_icon = 'user';
              break;
            case 'github':
              var social_media_icon = 'github';
              break;
            case 'hackernews':
              var social_media_icon = 'hacker-news';
              break;
            case 'reddit':
              var social_media_icon = 'reddit';
              break;
            case 'twitter':
              var social_media_icon = 'twitter';
              break;
            case 'key_fingerprint':
              var social_media_icon = 'key';
              break;
            case 'username':
              var social_media_icon = '';
              break;
            default:
              var social_media_icon = 'search';
          }
          var appendString = '<li val="' + components.username.val + '">' +
                             '<img src="' + accountImage + '">' +
                             '<span class="account-name">' +
                             components.username.val +
                             '</span><span class="account-search-info fa fa-' + social_media_icon + '"> ' +
                             highestComponentSearch +
                             '</span><span class="public-key-fingerprint fa fa-key"> ' +
                             key_fingerprint + '</span></li>';

          // Append list item to autocomplete list.
          $('.kb-auto-complete').append(appendString);
        }
      }
    });
  });

  /**
   * Grab public key and encrypt message upon clicking submit button.
   */
  $('button.encrypt-action').click(function() {
    console.log($(this));
    // Reset the error and status text.
    $('.has-error .error-text').text('');
    $('.status').html('');

    var data = grab_encypt_info();

    deferMagic(data);
  });

  function process_request() {
    var deferredReady = $.Deferred();
    deferredReady.resolve();
    return deferredReady.promise();
  }

  function deferMagic(data) {
    update_status('Grabbing Keys.');
    var public_key_request = null,
        private_key_request = null;
    if (data.for_account != '') {
      public_key_request = $.get("https://keybase.io/" + data.for_account + "/key.asc")
    }
    if (data.sign) {
      private_key_request = $.get("https://keybase.io/_/api/1.0/user/lookup.json", {
        usernames: data.sign_account,
        fields: 'private_keys'
      });
    }

    var grab_accounts = function(response, public_key_request, private_key_request) {
      update_status('Loading account.');
      if (public_key_request) {
        kbpgp.KeyManager.import_from_armored_pgp({
          armored: public_key_request[0]
        }, function(err, keyManager) {
          data['account'] = keyManager;
          if (!data.sign) {
            create_pgp_block(data);
          }
        });
      }
      if (data.sign) {
        console.log(private_key_request);
        update_status('Unpacking private key.');
        if (private_key_request[0].them[0] == null
          || typeof private_key_request[0].them[0].private_keys.primary == 'undefined') {
          update_error('Cannot find user/private key!');
          throw new Error("Unable to import private key.  Check username and that key is hosted on keybase.io.");
        }
        private_key = private_key_request[0].them[0].private_keys.primary;
        kbpgp.KeyManager.import_from_p3skb({armored: private_key.bundle}, function (err, keyManager) {
          if (err) {
            console.log(err);
            update_error('Cannot find user/private key!');
            throw new Error("Unable to import private key.  Check username and that key is hosted on keybase.io.");
          }
          update_status('Unlocking.');
          keyManager.unlock_p3skb({passphrase: data.sign_passphrase}, function(err) {
            if (err) {
              console.log(err);
              update_error('Cannot unpack key, check password!');
              throw new Error("Unable to unpack key.  Wrong password?.");     
            }
            data['sign_account'] = keyManager;
            create_pgp_block(data);
          });

        });
      }
    };

    $.when( process_request(), public_key_request, private_key_request).fail(function() {
      console.log('fail args', arguments);
      update_error('Cannot find user!');
      throw new Error("Unable to find user. WTF mate."); 
    })
    .done(grab_accounts);
  }


  function create_pgp_block(data) {
    var params = {
      msg: data['msg'],
      
    };
    if (data['account']) {
      params['encrypt_for'] = data['account'];
    }
    if (data.sign) {
      params['sign_with'] = data['sign_account'];
    }
    data['sign_passphrase'] = null;
    data['sign_account'] = null;
    update_status('Doing PGP magic.');
    kbpgp.box(params, function(err, result_armored, result_raw) {
      if (err) {
        console.log('fail args', arguments);
        update_error('Unable to encrypt text!');
        throw new Error("Please submit error report with console log!."); 
      }
      update_status('Done!');
      $('.to-encrypt').val(result_armored);
      if (data.pastebin) {
        update_status('Uploading to PasteBin.');
        upload_pastebin(result_armored);
      }
      else {
        $('.pastebin').html('');
      }
      if (data.clipboard) {
        copy_to_clipboard();
      }
    });
  }

  function grab_encypt_info() {
    // Grab post info
    var data = {
      for_account: $('.keybase-account').val(),
      msg: $('.to-encrypt').val(),
      sign: false,
      clipboard: $('.clipboard-option').is(':checked'),
      pastebin: $('.pastebin-option').is(':checked'),
    };
    if (data.msg == '') {
      update_error('Message cannot be empty');
      throw new Error("Message cannot be empty!");
    }
    if ($('.sign-option').prop('checked')) {
      data['sign_account'] = $('.keybase-user').val();
      data['sign_passphrase'] = $('.keybase-passphrase').val();
      data['sign'] = true;
    }
    return data;
  }


  function update_error(text) {
    $('.error-text').text(text);
  }

  function update_status(text) {
    $('.status').html($('.status').html() + ' ' + text);
  }

  function copy_to_clipboard() {
    $('.to-encrypt').select();
    document.execCommand('copy', true);
  }

  function upload_pastebin(data) {
    $.ajax({
      url: "https://pastebin.com/api/api_post.php",
      method: "POST",
      data: {
        api_option: 'paste',
        api_user_key: '',
        api_dev_key: 'a32102de661252014f679a114ee67688',
        api_paste_private: '1',
        api_paste_expire_date: 'N',
        api_paste_format: 'text',
        api_paste_name: '',
        api_paste_code: data,
      },
      success: function(result) {
        var pastebin_url = 'https://pastebin.com/raw/' + result.substr(20);
        $('.to-encrypt').val($('.to-encrypt').val() + "\n" + 'to decrypt simply run the following...' + "\n" + 'curl ' + pastebin_url + " | keybase pgp decrypt\n--------------------------");
        $('.pastebin').html('<a href="' + pastebin_url + '" target="_blank">' + pastebin_url + '</a>');
        var pastebin_text = $('<textarea/>');
        pastebin_text.text(pastebin_url);
        $('body').append(pastebin_text);
        pastebin_text.select();
        document.execCommand('copy', true);
        pastebin_text.remove();
       }
    });
  }
});