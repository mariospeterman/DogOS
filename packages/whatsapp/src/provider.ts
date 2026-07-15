export type DeliveryState = "queued" | "sent" | "delivered" | "read" | "failed";

export interface CanonicalInboundMessage {
  id: string;
  contactId: string;
  kind: "text" | "button" | "list" | "voice_transcript" | "media_placeholder";
  text: string;
  receivedAt: string;
}

export interface OutboundMessage {
  id: string;
  contactId: string;
  kind: "text" | "interactive" | "template" | "media";
  text: string;
  options: string[];
  state: DeliveryState;
}

export interface WhatsAppProvider {
  verifyWebhook(payload: string, signature: string): Promise<boolean>;
  parseInbound(payload: string): Promise<CanonicalInboundMessage[]>;
  sendText(contactId: string, text: string): Promise<OutboundMessage>;
  sendInteractive(
    contactId: string,
    text: string,
    options: string[],
  ): Promise<OutboundMessage>;
  sendTemplate(contactId: string, template: string): Promise<OutboundMessage>;
  sendMedia(
    contactId: string,
    mediaUrl: string,
    caption: string,
  ): Promise<OutboundMessage>;
}
