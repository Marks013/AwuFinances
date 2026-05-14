import assert from "node:assert/strict";

type MockResponseInit = {
  status?: number;
  headers?: Record<string, string>;
};

function jsonResponse(body: unknown, init: MockResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });
}

async function main() {
  process.env.GEMINI_ENABLED = "true";
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.GEMINI_MODEL = "gemini-2.5-flash";
  process.env.WHATSAPP_ASSISTANT_ENABLED = "true";
  process.env.WHATSAPP_PROVIDER = "evolution";
  process.env.WHATSAPP_INBOUND_ONLY = "true";
  process.env.EVOLUTION_API_URL = "https://evolution.local";
  process.env.EVOLUTION_API_KEY = "test-evolution-key";
  process.env.EVOLUTION_INSTANCE = "awu-test";
  process.env.EVOLUTION_WEBHOOK_SECRET = "test-evolution-webhook-secret";
  process.env.DATABASE_URL ??= "postgresql://awufinances:awufinances@127.0.0.1:5432/awufinances";
  process.env.AUTH_SECRET ??= "test-auth-secret";
  process.env.AUTOMATION_CRON_SECRET ??= "test-automation-secret";

  const { extractIncomingEvolutionWebhookMessages } = await import("../lib/whatsapp/evolution-payload");
  const { buildCommandFromWhatsAppMedia } = await import("../lib/whatsapp/media-understanding");
  const { sanitizeAssistantText } = await import("../lib/whatsapp/text-sanitizer");

  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("generativelanguage.googleapis.com")) {
      const requestBody = typeof init?.body === "string" ? init.body : "";

      const parsed = requestBody ? JSON.parse(requestBody) : null;
      const promptText = parsed?.contents?.[0]?.parts?.[0]?.text ?? "";
      const isImage = promptText.includes("Leia a imagem como comprovante");

      const modelOutput = isImage
        ? {
            intent: "launch_request",
            command: "gastei 120,90 de farmacia no cartao PicPay 3x",
            summary: "Comprovante de compra com valor visivel.",
            confidence: 0.91
          }
        : {
            intent: "launch_request",
            command: "gastei 42,50 no mercado",
            summary: "Audio com lancamento de despesa identificado.",
            confidence: 0.88
          };

      return jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify(modelOutput)
                }
              ]
            }
          }
        ]
      });
    }

    throw new Error(`Unhandled fetch in whatsapp-webhook-e2e-sim: ${url}`);
  }) as typeof globalThis.fetch;

  try {
    const textPayload = {
      event: "MESSAGES_UPSERT",
      instance: "awu-test",
      data: {
        key: {
          id: "evo.text-001",
          fromMe: false,
          remoteJid: "554499999999@s.whatsapp.net"
        },
        messageType: "conversation",
        message: {
          conversation: "gastei 42,50 no mercado no PicPay"
        }
      }
    };

    const imagePayload = {
      event: "MESSAGES_UPSERT",
      instance: "awu-test",
      data: {
        key: {
          id: "evo.image-001",
          fromMe: false,
          remoteJid: "554488888888@s.whatsapp.net"
        },
        messageType: "imageMessage",
        message: {
          imageMessage: {
            base64: Buffer.from([255, 216, 255, 224]).toString("base64"),
            mimetype: "image/jpeg",
            caption: "farmacia no cartao PicPay 3x"
          }
        }
      }
    };

    const audioPayload = {
      event: "MESSAGES_UPSERT",
      instance: "awu-test",
      data: {
        key: {
          id: "evo.audio-001",
          fromMe: false,
          remoteJid: "554477777777@s.whatsapp.net"
        },
        messageType: "audioMessage",
        message: {
          audioMessage: {
            base64: Buffer.from([79, 103, 103, 83]).toString("base64"),
            mimetype: "audio/ogg"
          }
        }
      }
    };

    const fromMePayload = {
      event: "MESSAGES_UPSERT",
      data: {
        key: {
          id: "evo.outbound-001",
          fromMe: true,
          remoteJid: "554466666666@s.whatsapp.net"
        },
        messageType: "conversation",
        message: {
          conversation: "resposta do bot"
        }
      }
    };

    const groupPayload = {
      event: "MESSAGES_UPSERT",
      data: {
        key: {
          id: "evo.group-001",
          fromMe: false,
          remoteJid: "123456@g.us"
        },
        messageType: "conversation",
        message: {
          conversation: "grupo deve ser ignorado"
        }
      }
    };

    const parsedText = extractIncomingEvolutionWebhookMessages(textPayload);
    const parsedImage = extractIncomingEvolutionWebhookMessages(imagePayload);
    const parsedAudio = extractIncomingEvolutionWebhookMessages(audioPayload);

    assert.equal(parsedText.length, 1);
    assert.equal(parsedText[0]?.type, "text");
    assert.equal(parsedText[0]?.body, "gastei 42,50 no mercado no PicPay");

    assert.equal(parsedImage.length, 1);
    assert.equal(parsedImage[0]?.type, "image");
    assert.equal(parsedImage[0]?.mimeType, "image/jpeg");
    assert.equal(parsedImage[0]?.caption, "farmacia no cartao PicPay 3x");

    assert.equal(parsedAudio.length, 1);
    assert.equal(parsedAudio[0]?.type, "audio");
    assert.equal(parsedAudio[0]?.mimeType, "audio/ogg");

    assert.equal(extractIncomingEvolutionWebhookMessages(fromMePayload).length, 0);
    assert.equal(extractIncomingEvolutionWebhookMessages(groupPayload).length, 0);

    const imageCommand = await buildCommandFromWhatsAppMedia({
      mediaId: parsedImage[0]!.mediaId!,
      type: "image",
      mimeType: parsedImage[0]!.mimeType,
      caption: parsedImage[0]!.caption
    });

    assert.equal(imageCommand.ok, true);
    assert.match(imageCommand.ok ? imageCommand.command : "", /cartao PicPay/i);
    assert.match(imageCommand.ok ? imageCommand.command : "", /\b3x\b/i);

    const audioCommand = await buildCommandFromWhatsAppMedia({
      mediaId: parsedAudio[0]!.mediaId!,
      type: "audio",
      mimeType: parsedAudio[0]!.mimeType,
      caption: parsedAudio[0]!.caption
    });

    assert.equal(audioCommand.ok, true);
    assert.match(audioCommand.ok ? audioCommand.command : "", /gastei 42,50/i);

    const sanitized = sanitizeAssistantText(
      "\u00e2\u0161\u00a0\u00ef\u00b8\u008f N\u00c3\u00a3o foi poss\u00c3\u00advel lan\u00c3\u00a7ar o relat\u00c3\u00b3rio."
    );
    assert.equal(sanitized, "\u26a0\ufe0f N\u00e3o foi poss\u00edvel lan\u00e7ar o relat\u00f3rio.");

    console.log("WHATSAPP_EVOLUTION_WEBHOOK_E2E_SIM_OK");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
