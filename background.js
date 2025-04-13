// Background script for LyricSearch extension

// Hardcoded API keys (replace with your actual keys)
const geminiApiKey = "YOUR_API_KEY";
const perplexityApiKey = "YOUR_API_KEY";

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'processSongInfo') {
    processSongInfo(
      message.screenshot,
      geminiApiKey,
      perplexityApiKey
    ).then(sendResponse);
    return true; // Indicates async response
  }
});

// Process the screenshot to identify song, get lyrics, meaning, and similar songs
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
    
    let similarSongsData = {};
    // If lyrics indicate no lyrics found, do not query for similar songs.
    if (lyricsData.lyrics.toLowerCase().includes("unable to find lyrics")) {
      similarSongsData = { similarSongs: "Unable to find lyrics" };
    } else {
      // 3. Get similar songs
      similarSongsData = await getSimilarSongs(songInfo, perplexityApiKey);
    }
    
    return {
      songInfo: songInfo,
      lyrics: lyricsData.lyrics,
      meaning: lyricsData.meaning,
      similarSongs: similarSongsData.similarSongs
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
  const base64Data = screenshotDataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const blob = new Blob([bytes], { type: 'image/png' });
  const imageBase64 = await blobToBase64(blob);
  
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
  
  const prompt = `Search online for the complete lyrics to the following song: "${songInfo}".
- If the lyrics are found, then respond exactly in the format below:
<LYRICS>
[the complete lyrics exactly as found, do not add any commentary or formatting]
</LYRICS>
<MEANING>
[an analysis or explanation of the meaning of these lyrics; if a published meaning is not available, provide a brief analysis]
</MEANING>

- If you are unable to find the lyrics, then respond exactly in the following format:
<LYRICS>
Unable to find lyrics
</LYRICS>
<MEANING>
Unable to find lyrics
</MEANING>

Do not include any other text beyond what is specified.`;
  
  const requestData = {
    model: 'sonar',
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 2000
  };
  
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
  let lyrics = '';
  let meaning = '';
  
  if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
    const content = data.choices[0].message.content;
    const lyricsMatch = content.match(/<LYRICS>\s*([\s\S]*?)\s*<\/LYRICS>/i);
    const meaningMatch = content.match(/<MEANING>\s*([\s\S]*?)\s*<\/MEANING>/i);
    
    if (lyricsMatch && lyricsMatch[1]) {
      lyrics = lyricsMatch[1].trim();
    } else {
      lyrics = content.trim();
    }
    
    if (meaningMatch && meaningMatch[1]) {
      meaning = meaningMatch[1].trim();
    } else {
      meaning = "";
    }
    
  } else {
    throw new Error('Unexpected Perplexity API response format');
  }
  
  return { lyrics, meaning };
}

// Function to get similar songs using Perplexity API
async function getSimilarSongs(songInfo, apiKey) {
  const apiUrl = 'https://api.perplexity.ai/chat/completions';
  
  const prompt = `Search online for 5 to 10 songs whose overall meaning is similar to the following song: "${songInfo}".
Return your answer in the exact format below, with one song per line numbered sequentially, without any bold (like *text*) or similar formatting:
<SIMILAR>
1. Song Name 1 - Artist Name 1: One sentence summary of the song's meaning.
2. Song Name 2 - Artist Name 2: One sentence summary of the song's meaning.
3. Song Name 3 - Artist Name 3: One sentence summary of the song's meaning.
...
</SIMILAR>
Do not include any additional text. If no similar songs are found, respond with exactly:
<SIMILAR>No similar songs found</SIMILAR>`;
  
  const requestData = {
    model: 'sonar',
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 1000
  };
  
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
  let similarSongs = '';
  
  if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
    const content = data.choices[0].message.content;
    const similarMatch = content.match(/<SIMILAR>\s*([\s\S]*?)\s*<\/SIMILAR>/i);
    if (similarMatch && similarMatch[1]) {
      similarSongs = similarMatch[1].trim();
    } else {
      similarSongs = content.trim();
    }
    
  } else {
    throw new Error('Unexpected Perplexity API response format');
  }
  
  return { similarSongs };
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
