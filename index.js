require('dotenv').config();
const express = require('express');
const { HfInference } = require('@huggingface/inference');
const cors = require('cors');

const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 9005;
const apiKey = process.env.HUGGING_FACE_API_KEY;

if (!apiKey) {
  console.error('Please set your HUGGING_FACE_API_KEY in the .env file');
  process.exit(1);
}

// Initialize the store file
const storeFilePath = path.join(__dirname, 'store.json');
if (!fs.existsSync(storeFilePath)) {
  fs.writeFileSync(storeFilePath, JSON.stringify({}));
}


// Middleware to track and limit requests by IP
app.use((req, res, next) => {
  const ip = req.ip;
  const store = JSON.parse(fs.readFileSync(storeFilePath, 'utf8'));

  if (!store[ip]) {
    store[ip] = 0;
  }

  // Check if the IP limit has been reached if no token is provided
  if (store[ip] >= 10) {
    return res.status(429).send({ error: 'Request limit exceeded' });
  }

  next();
});


const hf = new HfInference(apiKey);

app.use(express.json());
app.use(cors());

let conversationHistory = []; // Store conversation history

app.post('/chat', async (req, res) => {
  const { inputs } = req.body;

  if (!inputs) {
    return res.status(400).send({ error: 'Invalid input data' });
  }
  

  // Add user input to conversation history
  conversationHistory.push(`User: ${inputs}`);

  // Prepare the context
  const context = conversationHistory.join('\n') + '\nBot:';

  try {
    const response = await hf.textGeneration({
      model: 'facebook/blenderbot-400M-distill', // Use the BlenderBot model
      inputs: context,
      parameters: {
        max_new_tokens: 150,
        temperature: 0.7,
        top_p: 0.9,
      },
    });

    const generatedText = response.generated_text || '';
    const reply = generatedText.split('Bot:')[1] ? generatedText.split('Bot:')[1].trim() : generatedText;

    // Add model's reply to conversation history
    conversationHistory.push(`Bot: ${reply}`);

    res.send({ reply });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: 'Failed to generate response' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
