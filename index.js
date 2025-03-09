const os = require('os');
const randomUUID = require('crypto')
const qrcode = require('qrcode-terminal');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');


const { Client, LocalAuth, AuthStrategy , MessageMedia} = require('whatsapp-web.js');

const client = new Client({
  authStrategy: new LocalAuth()
});

const startsWithIgnoreCase = (str, prefix) => str.toLowerCase().startsWith(prefix.toLowerCase());

const app = express();
app.use(bodyParser.json());

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', async() => {
  console.log('Client is ready!');
});


async function convertOggToWav(oggPath, wavPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(oggPath)
      .toFormat("wav")
      .outputOptions("-acodec pcm_s16le")
      .output(wavPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}


client.on('message', async (msg) => {
  console.log(">><<><><><><><><><><><><><><><><>")
  if (msg.hasMedia) {
    try {
      console.log("*******************************************")
      const media = await msg.downloadMedia();
      if (!media || !media.mimetype.startsWith("audio/")) return;
      const mediaBuffer = Buffer.from(media.data, "base64");
      const tempdir = os.tmpdir();
      const oggPath = path.join(tempdir, randomUUID() + ".ogg");
      const wavFilename = randomUUID() + ".wav";
      const wavPath = path.join(tempdir, wavFilename);
      console.log("Wav file:", wavPath);
      fs.writeFileSync(oggPath, mediaBuffer);
      console.log("]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]WAV PATH:" , wavPath)

      try {
        await convertOggToWav(oggPath, wavPath);
      } catch (e) {
        console.log("Error:", e);
        fs.unlinkSync(oggPath);
        return {
          text: "",
          language
        };
      }
    } catch (e) {
      console.log("Error:",e );
    }   
    }
  try {
    const response = await axios.post('http://192.168.30.50:8998/messages', {
      client: "whatsapp",
      text: msg.body,
      user_number: msg.from,
      bot_number: msg.to,
      notifyName: msg._data.notifyName !== undefined ? msg._data.notifyName : "",
      timestamp: msg.timestamp,
      type: msg.type,
      author: msg.author !== undefined ? msg.author : "",
    });

    console.log(msg);

      const chat = await client.getChatById(msg.from);
      console.log(msg);

      if (startsWithIgnoreCase(response.data.message,"https://")) {
        const media = await MessageMedia.fromUrl(response.data.message);
        chat.sendMessage(media);
    } else {
        chat.sendMessage(response.data.message);
    }
      console.log("-----------------------------------------------------------");
      console.log(response.data);
      console.log("-----------------------------------------------------------");


    } catch (error) {
      console.error(error);
    }
  });

client.initialize();


// REST API to forward message to WhatsApp
app.post('/send', async (req, res) => {
  const { to, message } = req.body;
  try {
    const chat = await client.getChatById(to);
    chat.sendMessage(message);
    res.send('Message sent');
    console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   SEND MESSAGE ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^")
  } catch (error) {
    console.error(error);
    res.status(500).send('Error sending message');
  }
});

app.get('/participant', async (req, res) => {
  try {
    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup && chat.name);
    let data = [];

    for (const g of groups) {
      let groupData = {
        group_id: g.id._serialized,
        group_name: g.name,
        participants: []
      };

      for (const p of g.participants) {
        let c = await client.getContactById(p.id._serialized);
        let name = c.name || c.pushname;
        name = name ? name + " [" + c.number + "]" : c.number;

        groupData.participants.push({
          name: name,
          contact_id: p.id._serialized
        });
      }
      data.push(groupData);
    }
    let jsonString = JSON.stringify(data);
    res.send(jsonString);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error getting participant')
  }
});
  
app.listen(8000, () => {
  console.log('Server listening on port 8000');
});
 

