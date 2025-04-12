document.addEventListener('DOMContentLoaded', function() {
  // UI elements
  const searchButton = document.getElementById('searchButton');
  const saveSettingsButton = document.getElementById('saveSettings');
  const status = document.getElementById('status');
  const songInfo = document.getElementById('songInfo');
  const songTitle = document.getElementById('songTitle');
  const artistName = document.getElementById('artistName');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const results = document.getElementById('results');
  const errorMessage = document.getElementById('errorMessage');
  const lyricsContent = document.getElementById('lyricsContent');
  const meaningContent = document.getElementById('meaningContent');
  const lyricsTabBtn = document.getElementById('lyricsTabBtn');
  const meaningTabBtn = document.getElementById('meaningTabBtn');
  const lyricsTab = document.getElementById('lyricsTab');
  const meaningTab = document.getElementById('meaningTab');
  const geminiApiKeyInput = document.getElementById('geminiApiKey');
  const perplexityApiKeyInput = document.getElementById('perplexityApiKey');

  // Load saved API keys
  chrome.storage.local.get(['geminiApiKey', 'perplexityApiKey'], function(data) {
    if (data.geminiApiKey) {
      geminiApiKeyInput.value = data.geminiApiKey;
    }
    if (data.perplexityApiKey) {
      perplexityApiKeyInput.value = data.perplexityApiKey;
    }
  });

  // Save API keys
  saveSettingsButton.addEventListener('click', function() {
    const geminiApiKey = geminiApiKeyInput.value.trim();
    const perplexityApiKey = perplexityApiKeyInput.value.trim();
    
    chrome.storage.local.set({
      geminiApiKey: geminiApiKey,
      perplexityApiKey: perplexityApiKey
    }, function() {
      alert('API keys saved successfully!');
    });
  });

  // Tab switching
  lyricsTabBtn.addEventListener('click', function() {
    lyricsTabBtn.classList.add('active');
    meaningTabBtn.classList.remove('active');
    lyricsTab.classList.remove('hidden');
    meaningTab.classList.add('hidden');
  });

  meaningTabBtn.addEventListener('click', function() {
    meaningTabBtn.classList.add('active');
    lyricsTabBtn.classList.remove('active');
    meaningTab.classList.remove('hidden');
    lyricsTab.classList.add('hidden');
  });

  // Main search function
  searchButton.addEventListener('click', function() {
    // Reset UI
    status.textContent = 'Analyzing Spotify tab...';
    status.classList.remove('hidden');
    songInfo.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');
    results.classList.add('hidden');
    errorMessage.classList.add('hidden');
    
    // Check for API keys
    chrome.storage.local.get(['geminiApiKey', 'perplexityApiKey'], function(data) {
      if (!data.geminiApiKey || !data.perplexityApiKey) {
        showError('Please enter both API keys in the settings section below.');
        return;
      }
      
      // Capture screenshot of the active tab
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        
        // Check if current tab is Spotify
        if (!currentTab.url.includes('open.spotify.com')) {
          showError('Please navigate to Spotify web player before using this extension.');
          return;
        }
        
        chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
          if (chrome.runtime.lastError) {
            showError('Error capturing screenshot: ' + chrome.runtime.lastError.message);
            return;
          }
          
          status.textContent = 'Identifying song...';
          
          // Send the screenshot to the background script for processing
          chrome.runtime.sendMessage({
            action: 'processSongInfo',
            screenshot: dataUrl,
            geminiApiKey: data.geminiApiKey,
            perplexityApiKey: data.perplexityApiKey
          }, function(response) {
            loadingSpinner.classList.add('hidden');
            
            if (response.error) {
              showError(response.error);
              return;
            }
            
            // Display song info
            if (response.songInfo) {
              const parts = response.songInfo.split(' by ');
              if (parts.length === 2) {
                songTitle.textContent = parts[0];
                artistName.textContent = parts[1];
                songInfo.classList.remove('hidden');
              }
            }
            
            // Display lyrics and meaning
            if (response.lyrics && response.lyrics !== 'Unable to find lyrics' && 
                response.lyrics !== 'Unable to find song' && 
                response.lyrics !== 'Invalid Input') {
              
              lyricsContent.textContent = response.lyrics;
              
              // Check if meaning exists
              if (response.meaning && response.meaning !== '') {
                meaningContent.textContent = response.meaning;
                meaningTabBtn.disabled = false;
              } else {
                meaningContent.textContent = 'No meaning analysis available for this song.';
                meaningTabBtn.disabled = true;
              }
              
              results.classList.remove('hidden');
              status.classList.add('hidden');
            } else {
              showError(`Could not find lyrics: ${response.lyrics}`);
            }
          });
        });
      });
    });
  });

  function showError(message) {
    loadingSpinner.classList.add('hidden');
    status.classList.add('hidden');
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }
});
