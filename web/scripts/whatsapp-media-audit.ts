import assert from "node:assert/strict";

import { extractIncomingEvolutionWebhookMessages } from "../lib/whatsapp/evolution-payload";

const payload = {
  event: "MESSAGES_UPSERT",
  instance: "awu-test",
  data: {
    messages: [
      {
        key: {
          id: "img-1",
          fromMe: false,
          remoteJid: "554499999999@s.whatsapp.net"
        },
        messageType: "imageMessage",
        message: {
          imageMessage: {
            base64: Buffer.from([255, 216, 255, 224]).toString("base64"),
            mimetype: "image/jpeg",
            caption: "farmacia no PicPay"
          }
        }
      },
      {
        key: {
          id: "aud-1",
          fromMe: false,
          remoteJid: "554488888888@s.whatsapp.net"
        },
        messageType: "audioMessage",
        message: {
          audioMessage: {
            base64: Buffer.from([79, 103, 103, 83]).toString("base64"),
            mimetype: "audio/ogg"
          }
        }
      },
      {
        key: {
          id: "vid-1",
          fromMe: false,
          remoteJid: "554477777777@s.whatsapp.net"
        },
        messageType: "videoMessage",
        message: {
          videoMessage: {
            base64: Buffer.from([0, 0, 0, 24]).toString("base64"),
            mimetype: "video/mp4",
            caption: "cupom em video"
          }
        }
      }
    ]
  }
};

const messages = extractIncomingEvolutionWebhookMessages(payload);

assert.equal(messages.length, 3);
assert.deepEqual(
  messages.map((message) => ({
    eventId: message.eventId,
    phoneNumber: message.phoneNumber,
    type: message.type,
    mimeType: message.mimeType,
    caption: message.caption
  })),
  [
    {
      eventId: "img-1",
      phoneNumber: "554499999999",
      type: "image",
      mimeType: "image/jpeg",
      caption: "farmacia no PicPay"
    },
    {
      eventId: "aud-1",
      phoneNumber: "554488888888",
      type: "audio",
      mimeType: "audio/ogg",
      caption: null
    },
    {
      eventId: "vid-1",
      phoneNumber: "554477777777",
      type: "video",
      mimeType: "video/mp4",
      caption: "cupom em video"
    }
  ]
);

console.log("WhatsApp Evolution media audit passed.");
