document.addEventListener('DOMContentLoaded', function() {
  // UI elements
  const searchButton = document.getElementById('searchButton');
  const status = document.getElementById('status');
  const songInfo = document.getElementById('songInfo');
  const songTitle = document.getElementById('songTitle');
  const artistName = document.getElementById('artistName');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const results = document.getElementById('results');
  const errorMessage = document.getElementById('errorMessage');
  const lyricsContent = document.getElementById('lyricsContent');
  const meaningContent = document.getElementById('meaningContent');
  const similarContent = document.getElementById('similarContent');
  const lyricsTabBtn = document.getElementById('lyricsTabBtn');
  const meaningTabBtn = document.getElementById('meaningTabBtn');
  const similarTabBtn = document.getElementById('similarTabBtn');
  const lyricsTab = document.getElementById('lyricsTab');
  const meaningTab = document.getElementById('meaningTab');
  const similarTab = document.getElementById('similarTab');

  // Tab switching for Lyrics
  lyricsTabBtn.addEventListener('click', function() {
    lyricsTabBtn.classList.add('active');
    meaningTabBtn.classList.remove('active');
    similarTabBtn.classList.remove('active');
    lyricsTab.classList.remove('hidden');
    meaningTab.classList.add('hidden');
    similarTab.classList.add('hidden');
  });

  // Tab switching for Meaning
  meaningTabBtn.addEventListener('click', function() {
    meaningTabBtn.classList.add('active');
    lyricsTabBtn.classList.remove('active');
    similarTabBtn.classList.remove('active');
    meaningTab.classList.remove('hidden');
    lyricsTab.classList.add('hidden');
    similarTab.classList.add('hidden');
  });

  // Tab switching for Similar Songs
  similarTabBtn.addEventListener('click', function() {
    similarTabBtn.classList.add('active');
    lyricsTabBtn.classList.remove('active');
    meaningTabBtn.classList.remove('active');
    similarTab.classList.remove('hidden');
    lyricsTab.classList.add('hidden');
    meaningTab.classList.add('hidden');
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
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const currentTab = tabs[0];
      
      if (!currentTab.url.includes('open.spotify.com')) {
        showError('Please navigate to Spotify web player before using this extension.');
        return;
      }
      
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, function(dataUrl) {
        if (chrome.runtime.lastError) {
          showError('Error capturing screenshot: ' + chrome.runtime.lastError.message);
          return;
        }
        
        status.textContent = 'Identifying song...';
        
        chrome.runtime.sendMessage({
          action: 'processSongInfo',
          screenshot: dataUrl
        }, function(response) {
          loadingSpinner.classList.add('hidden');
          
          if (response.error) {
            showError(response.error);
            return;
          }
          
          if (response.songInfo) {
            const parts = response.songInfo.split(' by ');
            if (parts.length === 2) {
              songTitle.textContent = parts[0];
              artistName.textContent = parts[1];
              songInfo.classList.remove('hidden');
            }
          }
          
          // Populate Lyrics tab
          lyricsContent.textContent = response.lyrics || 'No lyrics found.';
          
          // Populate Meaning tab
          meaningContent.textContent = response.meaning || 'No meaning analysis available.';
          
          // Populate Similar Songs tab: split by newlines and convert to individual paragraphs
          if (response.similarSongs && response.similarSongs !== '') {
            // Split the response by line breaks and join them with a bullet or new paragraph
            const lines = response.similarSongs.split('\n').filter(line => line.trim() !== '');
            similarContent.innerHTML = lines.map(line => `<p>${line.trim()}</p>`).join('');
          } else {
            similarContent.textContent = 'No similar songs found.';
          }
          
          // Ensure all tabs are enabled
          lyricsTabBtn.disabled = false;
          meaningTabBtn.disabled = false;
          similarTabBtn.disabled = false;
          
          results.classList.remove('hidden');
          status.classList.add('hidden');
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
