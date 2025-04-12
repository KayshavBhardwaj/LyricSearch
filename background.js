// Background script for LyricSearch extension

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'processSongInfo') {
    processSongInfo(
      message.screenshot, 
      message.geminiApiKey, 
      message.perplexityApiKey
    ).then(sendResponse);
    return true; // Indicates async response
  }
});

// Process the screenshot to identify song and get lyrics
async function processSongInfo(screenshotDataUrl, geminiApiKey, perplexityApiKey) {
  try {
    // 1. Identify song using Gemini API
    const songInfo = await identifySongWithGemini(screenshotDataUrl, geminiApiKey);
    
    if (songInfo === 'Unable to Find Song') {
      return { 
        error: 'Could not identify a song playing on Spotify. Make sure a song is currently playing and visible.' 
      };
    }
    
    // 2. Get lyrics and meaning using Perplexity API
    const lyricsData = await getLyricsWithPerplexity(songInfo, perplexityApiKey);
    
    return {
      songInfo: songInfo,
      lyrics: lyricsData.lyrics,
      meaning: lyricsData.meaning
    };
    
  } catch (error) {
    console.error('Error processing song info:', error);
    return { 
      error: error.message || 'An error occurred while processing your request.' 
    };
  }
}

// Function to identify song using Gemini 2.0 Flash API
async function identifySongWithGemini(screenshotDataUrl, apiKey) {
  // Convert base64 data URL to binary
  const base64Data = screenshotDataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Create a blob from the binary data
  const blob = new Blob([bytes], { type: 'image/png' });
  
  // Convert blob to base64 (for API request)
  const imageBase64 = await blobToBase64(blob);
  
  // Create Gemini API request with updated model name for Gemini 2.0 Flash
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const promptText = "make your response as short as possible. literally give me only a few words. really short. just tell me what is the song name and the artist that is currently being played from the spotify tab in the screenshot. just format your output like so: [SONG NAME] by [ARTIST]. If you are unable to find a song name off of the tab, then give your response exactly like the following: 'Unable to Find Song'";
  
  const requestData = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: "image/png",
              data: imageBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 100
    }
  };
  
  // Make the API request
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
  }
  
  const data = await response.json();
  
  // Extract the text response
  if (data.candidates && data.candidates[0] && data.candidates[0].content && 
      data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
    return data.candidates[0].content.parts[0].text.trim();
  } else {
    throw new Error('Unexpected Gemini API response format');
  }
}

// Function to get lyrics and meaning using Perplexity API
async function getLyricsWithPerplexity(songInfo, apiKey) {
  const apiUrl = 'https://api.perplexity.ai/chat/completions';
  
  const prompt = `search up online and tell me the lyrics to the following song "${songInfo}". tell me the lyrics you find and give them to me. if you can't find the lyrics, then explicitly say so. it is of utmost importance that you ABSOLUTELY DO NOT hallucinate. do not make up lyrics. if you find them, then tell me them. if you don't, then tell me that. do NOT give any other text other than the lyrics of the song. make your response as short as possible, and only tell me the lyrics. if you can't find the lyrics, or if they seem to be incomplete, then simply say "unable to find lyrics". if you can't find the song, then simply say "unable to find song" if the song name is "Unable to Find Song", then say "Invalid Input" thats it.
  
  THIS NEXT PART IS IMPORTANT. then, after that, only if the lyrics have been found, then do the following. print out <MEANING>. then look online and find the meaning to those lyrics. if you find the meaning of those lyrics somewhere, then give me the meaning of the lyrics. if you can't find it, then take the lyrics, and give me your own analysis. tell me what you think the lyrics mean.`;
  
  const requestData = {
    model: 'sonar',
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.1,
    max_tokens: 2000
  };
  
  // Make the API request
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestData)
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Perplexity API error: ${errorData.error?.message || response.statusText}`);
  }
  
  const data = await response.json();
  
  // Process the response to extract lyrics and meaning
  let lyrics = '';
  let meaning = '';
  
  if (data.choices && data.choices[0] && data.choices[0].message.content) {
    const content = data.choices[0].message.content;
    
    // Check if this is a "unable to find" message
    if (content.includes('unable to find lyrics') || 
        content.includes('Unable to find song') || 
        content.includes('Invalid Input')) {
      return {
        lyrics: content.trim(),
        meaning: ''
      };
    }
    
    // Split by meaning marker if it exists
    const parts = content.split('<MEANING>');
    
    if (parts.length > 1) {
      lyrics = parts[0].trim();
      meaning = parts[1].trim();
    } else {
      lyrics = content.trim();
    }
  } else {
    throw new Error('Unexpected Perplexity API response format');
  }
  
  return {
    lyrics: lyrics,
    meaning: meaning
  };
}

// Helper function to convert blob to base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}