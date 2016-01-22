$(document).ready(function() {

  /**
   * Thanks to
   * http://www.jquerybyexample.net/2012/06/get-url-parameters-using-jquery.html
   * for the snippet!
   */
  var getUrlParameter = function getUrlParameter(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;
    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : sParameterName[1];
        }
    }
  };

  if (queryData = getUrlParameter('m')) {
    $('.to-encrypt').val(decodeURIComponent(window.atob(queryData)));
  }
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
          console.log(components);
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
          console.log(highestComponent);
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
                             '</span><span class="public-key-fingerprint fa fa-key">' +
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
    $('.has-error .error-text').text('');
    // Grab the account name and message.
    var account_name = $('.keybase-account').val();
    var data = $('.to-encrypt').val();

    // Set status message.
    $('.status').html('Grabbing Key...');

    // Grab public key from keybase.io
    $.get("https://keybase.io/" + account_name + "/key.asc", function(account_pgp_key) {
      // Update status message.
      $('.status').html($('.status').html() + ' Key found!');
      // Encrypt the data!
      encryptData(data, account_pgp_key, $('.pastebin-option').is(':checked'), $('.clipboard-option').is(':checked'));
    }).fail(function(error) {
      // Oh no...
      console.log(error);
      $('.error-text').text(account_name + ' does not have a public key...');
    });
  });
});

/**
 * Given a keybase.io public key and message return an encrypted pgp message.
 */
function encryptData(data, account_pgp_key, pastebin, clipboard) {
  var account = false;
  // Update status message.
  $('.status').html($('.status').html() + ' Importing key...');

  // Set up key manager and import key.
  kbpgp.KeyManager.import_from_armored_pgp({
    armored: account_pgp_key
  }, function(err, user) {
    if (!err) {
      // Update status and set account.
      $('.status').html($('.status').html() + ' Key Imported!');
      account = user;
    }
    else {
      // Oh no.. I don't see how this could happen but here is the catch if it does.
      console.log(err, user);
      $('.error-text').text('Oh no something bad happened... Please submit console log dump!');
    }
  });

  // Prevent message creation if account didn't load properly.
  if (account) {
    // Update status message.
    $('.status').html($('.status').html() + ' Creating encrypted message...');

    // Set kbpgp params.
    var params = {
      msg:         data,
      encrypt_for: account,
    };

    // Encrypt!
    kbpgp.box(params, function(err, result_armored, result_raw) {
      if (!err) {
        // Update status.
        $('.status').html($('.status').html() + ' Done!');
        // Send PGP encrypted message to the textarea
        $('.to-encrypt').val(result_armored);
        if (pastebin) {
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
              api_paste_code: result_armored,
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
        else {
          $('.pastebin').html('');
        }
        if (clipboard) {
          $('.to-encrypt').select();
          document.execCommand('copy', true);
        }
        $('.complete').animate({ opacity: 1 }, 200);
        $('.complete').delay(2000).animate({ opacity: 0 }, 1700);
      }
      else {
        // Oh no.. I don't see how this could happen but here is the catch if it does.
        console.log(err, result_armored, result_raw);
        $('.error-text').text('Oh no something bad happened... Please submit console log dump!');
      }
    });
  }
}

/*
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
    api_paste_code: 'testing woop woop!',
  },
  success: function(result) {
    console.log('https://pastebin.com/raw/' + result.substr(20));
  }
});
*/